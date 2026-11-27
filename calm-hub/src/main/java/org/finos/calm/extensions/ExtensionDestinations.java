package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.Validator;
import org.finos.calm.resources.ResourceValidationConstants;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.IDN;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The server check of a link that an extension sends and Hub passes on to the UI, such as a search result or a chat
 * citation. {@code blocks.schema.json} ({@code $defs/destination} and {@code $defs/link}) gives the shape. This class
 * adds the limits that the schema cannot express. calm-hub-ui {@code navigation/destinations.ts}
 * ({@code isDestination}, {@code SCREEN_STATE_LIMITS}) applies the same limits in the browser. Both count a length in
 * Unicode code points, as the schema's {@code maxLength} does.
 */
public final class ExtensionDestinations {
    /** Screen params (names without a dot) in {@code screen.params}. */
    public static final int MAX_SCREEN_PARAMS = 8;
    /** Table keys ({@code <table>.filter|q|page}) in {@code screen.params}. */
    public static final int MAX_TABLE_KEYS = 12;
    /**
     * The form-encoded length of the resource context and the screen params, which the screen route gets in its query:
     * the extension's budget inside Hub's request-line limit of 4096 bytes, which also holds the route path.
     */
    public static final int MAX_ROUTE_QUERY = 2048;

    private static final String SCHEMA_PATH = "META-INF/calm-extensions/schema/0/blocks.schema.json";
    private static final Pattern NAMESPACE = Pattern.compile(ResourceValidationConstants.NAMESPACE_REGEX);
    private static final Pattern CONTROL = Pattern.compile("[\\x00-\\x1f\\x7f]");
    // Leading zeros do not count: a browser reads "0080" as 80.
    private static final Pattern PORT = Pattern.compile("0*[0-9]{0,5}");
    private static final Validator DESTINATION = validator("destination");
    private static final Validator LINK = validator("link");

    private ExtensionDestinations() {
    }

    /**
     * Checks a destination: exactly one of {@code href}, {@code hub} or {@code screen}, such as a search result link.
     *
     * @return the namespaces that the caller must be able to read, or empty when Hub must not send the destination
     */
    public static Optional<Set<String>> destination(JsonNode destination) {
        return check(DESTINATION, destination);
    }

    /** Checks a link: a destination with a {@code label}, such as a chat citation. The result is as for a destination. */
    public static Optional<Set<String>> link(JsonNode link) {
        return check(LINK, link);
    }

    private static Optional<Set<String>> check(Validator validator, JsonNode node) {
        if (node == null || !node.isObject() || !Boolean.TRUE.equals(validator.validate(new JsonObject(node.toString())).getValid())) {
            return Optional.empty();
        }
        if (node.has("href")) {
            return isHref(node.get("href").asText()) ? Optional.of(Set.of()) : Optional.empty();
        }
        if (node.has("hub")) {
            JsonNode hub = node.get("hub");
            return isResource(hub) ? Optional.of(Set.of(hub.get("namespace").asText())) : Optional.empty();
        }
        JsonNode screen = node.get("screen");
        JsonNode context = screen.get("context");
        if (context != null && !isResource(context)) {
            return Optional.empty();
        }
        Map<String, String> sent = screenParams(screen.get("params"));
        if (sent == null) {
            return Optional.empty();
        }
        if (context != null) {
            sent.putAll(resourceContext(context));
        }
        if (formLength(sent) > MAX_ROUTE_QUERY) {
            return Optional.empty();
        }
        return Optional.of(context == null ? Set.of() : Set.of(context.get("namespace").asText()));
    }

    /**
     * Whether a browser can open the URL. The schema allows only http and https. A browser's URL parser fails only on
     * the authority: it needs a host and a port of at most 65535, and it percent-encodes the path, query and fragment.
     * This check is stricter than a browser for a host that is not a DNS name, such as one with "_": Hub drops the link.
     */
    private static boolean isHref(String href) {
        int start = href.indexOf("://") + 3;
        int end = start;
        while (end < href.length() && "/?#\\".indexOf(href.charAt(end)) < 0) {
            end++;
        }
        String authority = href.substring(start, end);
        String hostAndPort = authority.substring(authority.lastIndexOf('@') + 1);
        int colon = hostAndPort.lastIndexOf(':');
        if (colon > hostAndPort.lastIndexOf(']')) {
            String port = hostAndPort.substring(colon + 1);
            if (!PORT.matcher(port).matches() || (!port.isEmpty() && Integer.parseInt(port) > 65535)) {
                return false;
            }
            hostAndPort = hostAndPort.substring(0, colon);
        }
        try {
            // A browser converts an internationalised name to ASCII before it checks it.
            String host = hostAndPort.startsWith("[") ? hostAndPort : IDN.toASCII(hostAndPort, IDN.ALLOW_UNASSIGNED);
            return new URI("https://" + host + "/").parseServerAuthority().getHost() != null;
        } catch (URISyntaxException | IllegalArgumentException e) {
            return false;
        }
    }

    // A namespace that is not valid in Hub has no READ check, and no Hub page.
    private static boolean isResource(JsonNode target) {
        if (!NAMESPACE.matcher(target.get("namespace").asText()).matches()) {
            return false;
        }
        for (String field : new String[]{"namespace", "type", "id", "version", "element"}) {
            if (target.has(field) && !isQueryValue(target.get(field).asText())) {
                return false;
            }
        }
        return true;
    }

    /** The screen params to send, or null when there are more of a kind than its limit. The schema checked each name. */
    private static Map<String, String> screenParams(JsonNode params) {
        Map<String, String> sent = new LinkedHashMap<>();
        int tableKeys = 0;
        if (params != null) {
            for (Map.Entry<String, JsonNode> entry : params.properties()) {
                String value = entry.getValue().asText();
                if (entry.getKey().contains(".")) {
                    tableKeys++;
                } else if (isQueryValue(value)) {
                    sent.put(entry.getKey(), value);
                } else {
                    return null;
                }
            }
        }
        return sent.size() <= MAX_SCREEN_PARAMS && tableKeys <= MAX_TABLE_KEYS ? sent : null;
    }

    // The names that the UI sends for a resource context (resourceContext() in destinations.ts).
    private static Map<String, String> resourceContext(JsonNode target) {
        Map<String, String> context = new LinkedHashMap<>();
        context.put("namespace", target.get("namespace").asText());
        context.put("resource", target.get("type").asText() + "/" + target.get("id").asText());
        context.put("resourceType", target.get("type").asText());
        context.put("resourceId", target.get("id").asText());
        context.put("version", target.get("version").asText());
        if (target.has("element")) {
            context.put("selectedElement", target.get("element").asText());
        }
        return context;
    }

    // URLEncoder encodes as the browser's URLSearchParams does: the same safe characters, and a space as "+".
    private static int formLength(Map<String, String> query) {
        int length = Math.max(0, query.size() - 1);
        for (Map.Entry<String, String> entry : query.entrySet()) {
            length += URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8).length() + 1
                    + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8).length();
        }
        return length;
    }

    // No control character and no lone surrogate, as isQueryValue() in the UI: neither can go in a URL.
    private static boolean isQueryValue(String value) {
        if (CONTROL.matcher(value).find()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isHighSurrogate(c) && i + 1 < value.length() && Character.isLowSurrogate(value.charAt(i + 1))) {
                i++;
            } else if (Character.isSurrogate(c)) {
                return false;
            }
        }
        return true;
    }

    private static Validator validator(String definition) {
        JsonObject blocks = new JsonObject(read());
        JsonObject schema = new JsonObject()
                .put("$schema", blocks.getString("$schema"))
                .put("$id", blocks.getString("$id"))
                .put("$defs", blocks.getJsonObject("$defs"))
                .put("$ref", "#/$defs/" + definition);
        return Validator.create(JsonSchema.of(schema), new JsonSchemaOptions()
                .setDraft(Draft.DRAFT202012)
                .setBaseUri(blocks.getString("$id"))
                .setOutputFormat(OutputFormat.Basic));
    }

    private static String read() {
        try (InputStream in = ExtensionDestinations.class.getClassLoader().getResourceAsStream(SCHEMA_PATH)) {
            if (in == null) {
                throw new IllegalStateException("No classpath resource " + SCHEMA_PATH);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read classpath resource " + SCHEMA_PATH, e);
        }
    }
}
