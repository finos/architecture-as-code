package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.domain.extensions.ExtensionManifest.Form;
import org.finos.calm.resources.ResourceValidationConstants;

import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Submits a form (ADR 0013). Hub checks the target and the input against the manifest form, then calls the form route
 * through {@link ExtensionProxyService}, so the scope, read-only, audit, limit and identity rules of the proxy apply.
 * The backend gets {@code {submission, context, input}}: the context is the target that the UI pinned, and the input is
 * only the values that the fields accept. Only this service can call a form route ({@link ExtensionManifest#dedicatedRoutes()}).
 */
@ApplicationScoped
public class ExtensionFormService {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final Pattern PATH_PARAM = Pattern.compile("\\{([^}]+)}");
    private static final Pattern NAMESPACE = Pattern.compile(ResourceValidationConstants.NAMESPACE_REGEX);
    private static final Pattern CONTROL_CHARACTER = Pattern.compile("[\\x00-\\x1f\\x7f]");
    private static final Set<String> RESOURCE_TYPES = Set.of("architectures", "patterns");
    private static final Set<String> SUBMISSION_FIELDS = Set.of("submission", "context", "input");
    private static final int MAX_CONTEXT_VALUE_LENGTH = 256;
    private static final String BAD_TARGET = "The form target is missing or not valid";

    private final ExtensionRegistry registry;
    private final ExtensionProxyService proxy;

    @Inject
    public ExtensionFormService(ExtensionRegistry registry, ExtensionProxyService proxy) {
        this.registry = registry;
        this.proxy = proxy;
    }

    /** Throws {@link ExtensionProxyException} when Hub refuses the submission or the backend fails. */
    public ExtensionProxyResponse submit(SecurityIdentity identity, String extensionId, String formId, String contentType,
                                         String acceptLanguage, String sourceIp, InputStream body) {
        RegisteredExtension extension = registry.find(extensionId)
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such extension"));
        // The full manifest, not the read-only view, so a write form on a read-only Hub gets the proxy's 405.
        Form form = extension.manifest().form(formId)
                .orElseThrow(() -> new ExtensionProxyException(404, "The extension has no such form"));
        ExtensionManifest.Route route = extension.manifest().route(form.route())
                .orElseThrow(() -> new ExtensionProxyException(404, "The extension has no such form"));
        if (!ExtensionProxyService.isJson(contentType)) {
            throw new ExtensionProxyException(415, "The request must be JSON");
        }
        JsonNode submission = read(body, extension.limits().maxRequestBytes());
        for (Iterator<String> names = submission.fieldNames(); names.hasNext(); ) {
            if (!SUBMISSION_FIELDS.contains(names.next())) {
                throw new ExtensionProxyException(400, "The request has a field that a form submission does not have");
            }
        }
        String submissionId = submissionId(submission.get("submission"));
        Map<String, String> target = target(form, submission.get("context"));
        String path = path(route.path(), target);

        ExtensionProxyRequest request = new ExtensionProxyRequest(extensionId, route.method(), path, null,
                "application/json", "application/json", acceptLanguage, null, null, sourceIp, null);
        // The proxy builds the body after its scope check, so a caller with no scope learns nothing from the input check.
        return proxy.callDedicated(identity, request, route.id(), () -> body(form, submissionId, target, submission.get("input")));
    }

    private static byte[] body(Form form, String submissionId, Map<String, String> target, JsonNode input) {
        Map<String, String> errors = new LinkedHashMap<>();
        ObjectNode checked = ExtensionForms.checkInput(form, input, errors);
        if (!errors.isEmpty()) {
            throw new ExtensionFormInputException(errors);
        }
        ObjectNode sent = JsonNodeFactory.instance.objectNode();
        sent.put("submission", submissionId);
        ObjectNode context = sent.putObject("context");
        target.forEach(context::put);
        sent.set("input", checked);
        try {
            return MAPPER.writeValueAsBytes(sent);
        } catch (IOException e) {
            throw new ExtensionProxyException(400, "The request body cannot be read");
        }
    }

    private static JsonNode read(InputStream body, int maxBytes) {
        try {
            byte[] bytes = body == null ? new byte[0] : body.readNBytes((int) Math.min(Integer.MAX_VALUE - 8L, maxBytes + 1L));
            if (bytes.length > maxBytes) {
                throw new ExtensionProxyException(413, "The request body is too large for this extension");
            }
            JsonNode json = MAPPER.readTree(bytes);
            if (json == null || !json.isObject()) {
                throw new ExtensionProxyException(400, "The request must be a JSON object");
            }
            return json;
        } catch (IOException e) {
            throw new ExtensionProxyException(400, "The request must be a JSON object");
        }
    }

    /** A UUID that the UI keeps across a retry with the same target and input, so a backend can find a duplicate. */
    private static String submissionId(JsonNode value) {
        if (value != null && value.isTextual()) {
            try {
                String id = value.asText();
                if (UUID.fromString(id).toString().equals(id)) {
                    return id;
                }
            } catch (IllegalArgumentException e) {
                // Refused below.
            }
        }
        throw new ExtensionProxyException(400, "The submission must be a UUID in lower case");
    }

    /**
     * The context of the form target. Hub takes only the names that the target gives, and derives {@code resource},
     * so that a caller cannot send a context that disagrees with itself.
     */
    private static Map<String, String> target(Form form, JsonNode context) {
        List<String> names = ExtensionForms.TARGET_PARAMS.get(form.target());
        Map<String, String> target = new LinkedHashMap<>();
        if (context == null || context.isNull()) {
            context = JsonNodeFactory.instance.objectNode();
        }
        if (!context.isObject()) {
            throw new ExtensionProxyException(400, BAD_TARGET);
        }
        boolean resourceTarget = !names.isEmpty();
        for (Iterator<Map.Entry<String, JsonNode>> fields = context.fields(); fields.hasNext(); ) {
            Map.Entry<String, JsonNode> field = fields.next();
            String name = field.getKey();
            // A resource target can name a selected node; the UI also sends the resource that it derived.
            boolean known = names.contains(name) || (resourceTarget && (name.equals("selectedElement") || name.equals("resource")));
            if (!known || !field.getValue().isTextual() || !isContextValue(field.getValue().asText())) {
                throw new ExtensionProxyException(400, BAD_TARGET);
            }
        }
        if (!resourceTarget) {
            return target;
        }
        for (String name : names) {
            JsonNode value = context.get(name);
            if (value == null) {
                throw new ExtensionProxyException(400, BAD_TARGET);
            }
            target.put(name, value.asText());
        }
        if (!NAMESPACE.matcher(target.get("namespace")).matches() || !RESOURCE_TYPES.contains(target.get("resourceType"))) {
            throw new ExtensionProxyException(400, BAD_TARGET);
        }
        String resource = target.get("resourceType") + "/" + target.get("resourceId");
        if (context.has("resource") && !context.get("resource").asText().equals(resource)) {
            throw new ExtensionProxyException(400, BAD_TARGET);
        }
        Map<String, String> ordered = new LinkedHashMap<>();
        ordered.put("namespace", target.get("namespace"));
        ordered.put("resource", resource);
        ordered.put("resourceType", target.get("resourceType"));
        ordered.put("resourceId", target.get("resourceId"));
        ordered.put("version", target.get("version"));
        if (context.has("selectedElement")) {
            ordered.put("selectedElement", context.get("selectedElement").asText());
        }
        return ordered;
    }

    private static boolean isContextValue(String value) {
        return !value.isEmpty() && value.length() <= MAX_CONTEXT_VALUE_LENGTH && !CONTROL_CHARACTER.matcher(value).find()
                && value.codePoints().noneMatch(c -> c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE);
    }

    /** Fills the route path from the target, as the UI fills a designer tab path. The proxy checks the result again. */
    private static String path(String template, Map<String, String> target) {
        Matcher matcher = PATH_PARAM.matcher(template);
        StringBuilder path = new StringBuilder();
        while (matcher.find()) {
            String value = target.get(matcher.group(1));
            String encoded = value == null ? null : ExtensionPaths.encodePathValue(value);
            if (encoded == null || value.equals(".") || ExtensionPaths.hasForbiddenPart(encoded)) {
                throw new ExtensionProxyException(400, "The form target cannot fill the path of the form route");
            }
            matcher.appendReplacement(path, Matcher.quoteReplacement(encoded));
        }
        matcher.appendTail(path);
        return path.toString();
    }
}
