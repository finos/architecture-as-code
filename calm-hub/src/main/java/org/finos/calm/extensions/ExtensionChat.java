package org.finos.calm.extensions;

import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.finos.calm.resources.ResourceValidationConstants;
import org.finos.calm.security.CalmHubPermissionChecker;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * The chat contract of hubApi 0. Hub checks each message before it goes to the chat route, and builds the body that the
 * extension gets, so the extension can trust the context in it. Hub passes back a citation only when the caller can open
 * it, with the check that Hub does for the page that the citation names.
 */
final class ExtensionChat {

    static final int MAX_MESSAGES = 100;
    static final int MAX_MESSAGE_CHARS = 16_000;
    static final int MAX_ELEMENT_CHARS = 256;
    /** The longest citation label that the chat shows. */
    static final int MAX_LABEL_CHARS = 200;
    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$");
    private static final Pattern NAMESPACE = Pattern.compile(ResourceValidationConstants.NAMESPACE_REGEX);
    private static final Pattern VERSION = Pattern.compile(ResourceValidationConstants.SNAPSHOT_VERSION_OR_SHA_REGEX);
    private static final Pattern RESOURCE_ID = Pattern.compile("^(?:\\d{1,9}|[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*)$");
    private static final Pattern CONTROL = Pattern.compile("\\p{Cc}");
    private static final Set<String> ROLES = Set.of("user", "assistant");
    /** The resource types whose document Hub can send. */
    private static final Set<String> RESOURCE_TYPES = Set.of("architectures", "patterns");
    /** The events that end a chat reply. Hub then ends the stream, so an old reply cannot reach a later attempt. */
    static final Set<String> TERMINAL_EVENTS = Set.of("done", "error");
    // Hub passes on the event data as it came, so the data that Hub checks must be the data that the browser reads.
    private static final ObjectReader CITATION_READER = JsonMapper.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .build()
            .reader();

    private final CalmHubPermissionChecker permissions;
    private final ExtensionHubData hubData;

    ExtensionChat(CalmHubPermissionChecker permissions, ExtensionHubData hubData) {
        this.permissions = permissions;
        this.hubData = hubData;
    }

    /**
     * The body for the chat route: the conversation and message ids, the messages and, only when the caller shared one,
     * the context with the document of that version. Hub reads the document with the caller's read scope.
     */
    byte[] body(SecurityIdentity identity, byte[] request) {
        JsonObject in = parse(new String(request, StandardCharsets.UTF_8));
        String conversationId = in.getValue("conversationId") instanceof String s && ID.matcher(s).matches() ? s : null;
        String messageId = in.getValue("messageId") instanceof String s && ID.matcher(s).matches() ? s : null;
        if (conversationId == null || messageId == null) {
            throw new ExtensionProxyException(400, "The chat message needs a conversationId and a messageId");
        }
        JsonObject out = new JsonObject()
                .put("hubApi", 0)
                .put("conversationId", conversationId)
                .put("messageId", messageId)
                .put("messages", messages(in.getValue("messages")));
        Object context = in.getValue("context");
        if (context != null) {
            out.put("context", context(identity, context));
        }
        return out.encode().getBytes(StandardCharsets.UTF_8);
    }

    private static JsonObject parse(String text) {
        try {
            return new JsonObject(text);
        } catch (DecodeException | ClassCastException e) {
            throw new ExtensionProxyException(400, "The chat message must be a JSON object");
        }
    }

    private static JsonArray messages(Object value) {
        if (!(value instanceof JsonArray messages) || messages.isEmpty() || messages.size() > MAX_MESSAGES) {
            throw new ExtensionProxyException(400, "The chat message needs 1 to " + MAX_MESSAGES + " messages");
        }
        JsonArray out = new JsonArray();
        for (Object item : messages) {
            if (!(item instanceof JsonObject message) || !(message.getValue("role") instanceof String role)
                    || !ROLES.contains(role) || !(message.getValue("content") instanceof String content)
                    || content.isBlank() || content.length() > MAX_MESSAGE_CHARS) {
                throw new ExtensionProxyException(400, "Each chat message needs a role of user or assistant, and content "
                        + "of 1 to " + MAX_MESSAGE_CHARS + " characters");
            }
            out.add(new JsonObject().put("role", role).put("content", content));
        }
        if (!"user".equals(out.getJsonObject(out.size() - 1).getString("role"))) {
            throw new ExtensionProxyException(400, "The last chat message must be from the user");
        }
        return out;
    }

    private JsonObject context(SecurityIdentity identity, Object value) {
        if (!(value instanceof JsonObject context)
                || !(context.getValue("namespace") instanceof String namespace) || !NAMESPACE.matcher(namespace).matches()
                || !(context.getValue("resourceType") instanceof String resourceType) || !RESOURCE_TYPES.contains(resourceType)
                || !(context.getValue("resourceId") instanceof String resourceId) || !RESOURCE_ID.matcher(resourceId).matches()
                || !(context.getValue("version") instanceof String version) || !VERSION.matcher(version).matches()) {
            throw new ExtensionProxyException(400, "The chat context must name the namespace, resourceType (architectures "
                    + "or patterns), resourceId and version of a resource");
        }
        Object element = context.getValue("selectedElement");
        if (element != null && (!(element instanceof String text) || text.isEmpty() || text.length() > MAX_ELEMENT_CHARS
                || CONTROL.matcher(text).find())) {
            throw new ExtensionProxyException(400, "The selectedElement of the chat context is not valid");
        }
        // The same check as the page of the resource, so a shared context never names what the caller cannot read.
        if (!permissions.canRead(identity, namespace)) {
            throw new ExtensionProxyException(403, "You do not have read access to the resource that you shared");
        }
        JsonObject document = hubData.read(namespace, resourceType, resourceId, version)
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such resource version"));
        JsonObject out = new JsonObject()
                .put("namespace", namespace)
                .put("resourceType", resourceType)
                .put("resourceId", resourceId)
                .put("version", version);
        if (element != null) {
            out.put("selectedElement", element);
        }
        return out.put("document", document);
    }

    /** Passes every event except a citation that is not valid or that names a namespace the caller cannot read. */
    Predicate<ExtensionEventStream.Event> citations(SecurityIdentity identity) {
        return event -> !"citation".equals(event.name()) || canOpen(identity, event.data());
    }

    private boolean canOpen(SecurityIdentity identity, String data) {
        JsonNode citation;
        try {
            citation = CITATION_READER.readTree(data);
        } catch (IOException e) {
            return false;
        }
        if (citation == null || !(citation.get("label") instanceof TextNode label) || label.asText().isBlank()
                || label.asText().length() > MAX_LABEL_CHARS) {
            return false;
        }
        // The same READ check as the page that the citation opens.
        return ExtensionDestinations.link(citation)
                .map(namespaces -> namespaces.stream().allMatch(namespace -> permissions.canRead(identity, namespace)))
                .orElse(false);
    }
}
