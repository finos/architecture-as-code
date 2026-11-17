package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.resources.ResourceValidationConstants;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * Calls a {@code search-provider} route for a caller (ADR 0010). Hub owns the request and the reply: it sends the
 * query, checks each result, and leaves out a result that names a namespace the caller cannot read, before any title,
 * summary or count leaves Hub. The provider filters its own records by the caller ({@code sub}).
 */
@ApplicationScoped
public class ExtensionSearch {

    /** The results that Hub asks for in one page. A reply with more is not valid. */
    public static final int PAGE_SIZE = 10;
    /**
     * The most bytes in the request line for a page, {@code GET <path>?q=<query>&cursor=<cursor> HTTP/1.1}. The HTTP
     * server refuses a line of more than 4096 bytes with 414 before this endpoint runs; the rest is room for a root
     * path or a proxy prefix. Hub checks the request for the next page when a provider sends {@code next}, so the UI
     * can always send a cursor back.
     */
    public static final int MAX_REQUEST_LINE = 3584;
    static final int MAX_QUERY_LENGTH = 200;
    static final int MAX_ID_LENGTH = 256;
    static final int MAX_TITLE_LENGTH = 300;
    static final int MAX_SUMMARY_LENGTH = 1000;

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionSearch.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Pattern NAMESPACE = Pattern.compile(ResourceValidationConstants.NAMESPACE_REGEX);
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}]");

    private final ExtensionRegistry registry;
    private final ExtensionProxyService proxy;
    private final CalmHubPermissionChecker permissions;

    @Inject
    public ExtensionSearch(ExtensionRegistry registry, ExtensionProxyService proxy, CalmHubPermissionChecker permissions) {
        this.registry = registry;
        this.proxy = proxy;
        this.permissions = permissions;
    }

    /**
     * One page of results, as {@code {"results": [...], "next": "<cursor>"}}. Throws {@link ExtensionProxyException}
     * when Hub refuses the call, or when the provider fails, is too slow or sends a reply that is not valid.
     */
    public ObjectNode search(SecurityIdentity identity, String extensionId, String providerId, String query, String cursor) {
        RegisteredExtension extension = registry.find(extensionId)
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such search provider"));
        ExtensionManifest manifest = extension.manifest();
        List<ExtensionManifest.RouteContribution> providers = manifest.contributes().searchProvider();
        ExtensionManifest.Route route = (providers == null ? List.<ExtensionManifest.RouteContribution>of() : providers).stream()
                .filter(provider -> provider.id().equals(providerId))
                .findFirst()
                .flatMap(provider -> manifest.route(provider.route()))
                .orElseThrow(() -> new ExtensionProxyException(404, "There is no such search provider"));
        if (query == null || query.isBlank() || characters(query) > MAX_QUERY_LENGTH || CONTROL.matcher(query).find()) {
            throw new ExtensionProxyException(400, "The query must have 1 to " + MAX_QUERY_LENGTH
                    + " characters and no control characters");
        }
        if (cursor != null && !isCursor(cursor)) {
            throw new ExtensionProxyException(400, "The cursor is not valid");
        }
        if (requestLine(extensionId, providerId, query, cursor) > MAX_REQUEST_LINE) {
            throw new ExtensionProxyException(400, "The query and the cursor are too long");
        }
        ObjectNode body = MAPPER.createObjectNode()
                .put("hubApi", manifest.hubApi())
                .put("query", query)
                .put("limit", PAGE_SIZE);
        if (cursor != null) {
            body.put("cursor", cursor);
        }
        ExtensionProxyResponse reply = proxy.callDedicated(identity, new ExtensionProxyRequest(extensionId, "POST",
                route.path(), null, "application/json", "application/json", null,
                new ByteArrayInputStream(body.toString().getBytes(StandardCharsets.UTF_8))), route.id(), null);
        if (reply.status() != 200) {
            LOG.warn("Extension {} search provider {} returned status {}", extension.id(), providerId, reply.status());
            throw new ExtensionProxyException(502, "The search provider failed");
        }
        return page(identity, extension, providerId, query, reply.body());
    }

    private ObjectNode page(SecurityIdentity identity, RegisteredExtension extension, String providerId, String query,
                            byte[] reply) {
        JsonNode root;
        try {
            root = MAPPER.readTree(reply);
        } catch (IOException e) {
            root = null;
        }
        JsonNode results = root == null ? null : root.get("results");
        JsonNode next = root == null ? null : root.get("next");
        if (root == null || !root.isObject() || !root.path("hubApi").isInt()
                || root.path("hubApi").intValue() != extension.manifest().hubApi()
                || results == null || !results.isArray() || results.size() > PAGE_SIZE
                || (next != null && !next.isNull() && !(next.isTextual() && isCursor(next.textValue())))) {
            LOG.warn("Extension {} search provider {} sent a reply that is not valid", extension.id(), providerId);
            throw new ExtensionProxyException(502, "The search provider sent a reply that CALM Hub cannot read");
        }
        // Without next, the UI would show part of the results as if they were all of them.
        int nextRequest = next != null && next.isTextual() ? requestLine(extension.id(), providerId, query, next.textValue()) : 0;
        if (nextRequest > MAX_REQUEST_LINE) {
            LOG.warn("Extension {} search provider {} sent a cursor that makes the request for the next page {} bytes, more than {}",
                    extension.id(), providerId, nextRequest, MAX_REQUEST_LINE);
            throw new ExtensionProxyException(502, "The search provider sent a cursor that is too long to send back");
        }
        Map<String, Boolean> readable = new HashMap<>();
        Predicate<String> canRead = namespace -> readable.computeIfAbsent(namespace, ns -> permissions.canRead(identity, ns));
        Set<String> ids = new HashSet<>();
        ArrayNode kept = MAPPER.createArrayNode();
        for (JsonNode result : results) {
            ObjectNode copy = result(result, canRead);
            // The UI keys a result by its id, so a second result with the same id is left out.
            if (copy != null && ids.add(copy.get("id").textValue())) {
                kept.add(copy);
            }
        }
        ObjectNode page = MAPPER.createObjectNode();
        page.set("results", kept);
        // An empty page with a cursor would show that the provider found results that Hub left out.
        if (next != null && next.isTextual() && (!kept.isEmpty() || results.isEmpty())) {
            page.put("next", next.textValue());
        }
        return page;
    }

    /**
     * A copy of a result with only the fields that Hub knows, or null when the result is not valid or names a
     * namespace that the caller cannot read. Hub cannot check a record with no namespace: the provider must.
     */
    private static ObjectNode result(JsonNode result, Predicate<String> canRead) {
        if (!result.isObject() || !isText(result.get("id"), MAX_ID_LENGTH) || !isText(result.get("title"), MAX_TITLE_LENGTH)
                || !optional(result.get("summary"), MAX_SUMMARY_LENGTH)) {
            return null;
        }
        ObjectNode copy = MAPPER.createObjectNode()
                .put("id", result.get("id").textValue())
                .put("title", result.get("title").textValue());
        copyText(result, copy, "summary");
        JsonNode namespace = result.get("namespace");
        if (namespace != null && !namespace.isNull()) {
            if (!isNamespace(namespace) || !canRead.test(namespace.textValue())) {
                return null;
            }
            copy.put("namespace", namespace.textValue());
        }
        JsonNode link = result.get("link");
        if (link != null && !link.isNull()) {
            // The schema refuses unknown fields, so a link that passes is copied whole.
            Optional<Set<String>> namespaces = ExtensionDestinations.destination(link);
            if (namespaces.isEmpty() || !namespaces.get().stream().allMatch(canRead)) {
                return null;
            }
            copy.set("link", link.deepCopy());
        }
        return copy;
    }

    private static void copyText(JsonNode from, ObjectNode to, String field) {
        JsonNode value = from.get(field);
        if (value != null && value.isTextual()) {
            to.put(field, value.textValue());
        }
    }

    private static boolean isNamespace(JsonNode value) {
        return isText(value, MAX_ID_LENGTH) && NAMESPACE.matcher(value.textValue()).matches();
    }

    private static boolean optional(JsonNode value, int maxLength) {
        return value == null || value.isNull() || isText(value, maxLength);
    }

    private static boolean isText(JsonNode value, int maxLength) {
        return value != null && value.isTextual() && isText(value.textValue(), maxLength);
    }

    private static boolean isText(String value, int maxLength) {
        return !value.isBlank() && characters(value) <= maxLength && !CONTROL.matcher(value).find();
    }

    /** The UI sends the cursor back in a URL, where a lone surrogate cannot go: encodeURIComponent() throws. */
    private static boolean isCursor(String value) {
        if (!isText(value, Integer.MAX_VALUE)) {
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

    /** The bytes of the request line for a page, with the query and the cursor (if any) encoded by {@link #encoded}. */
    private static int requestLine(String extensionId, String providerId, String query, String cursor) {
        int length = "GET /api/calm/extensions/".length() + encoded(extensionId) + "/search/".length() + encoded(providerId)
                + "?q=".length() + encoded(query) + " HTTP/1.1".length();
        return cursor == null ? length : length + "&cursor=".length() + encoded(cursor);
    }

    /**
     * The percent-encoded length of a value. A UTF-8 byte other than A-Z, a-z, 0-9, '-', '.' and '_' counts as three,
     * the most that any encoder uses, so the result is never shorter than what a browser or another client sends.
     */
    private static int encoded(String value) {
        int length = 0;
        for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
            boolean plain = (b >= 'A' && b <= 'Z') || (b >= 'a' && b <= 'z') || (b >= '0' && b <= '9')
                    || b == '-' || b == '.' || b == '_';
            length += plain ? 1 : 3;
        }
        return length;
    }

    /** Code points, as JSON Schema {@code maxLength} and {@link ExtensionDestinations} count: '𝄞' is one character. */
    private static int characters(String value) {
        return value.codePointCount(0, value.length());
    }
}
