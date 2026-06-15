package org.finos.calm.resources;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.ResourceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

import static org.finos.calm.resources.ResourceValidationConstants.*;

/**
 * Parses, validates, and rewrites {@code $id} values in CALM documents for the name-based
 * ({@code /calm}) endpoints.
 *
 * <p>Extracted from {@link MappingControllerResource} to keep HTTP handling separate from
 * document-ID logic and to enable fast unit testing without a Quarkus boot.</p>
 */
@ApplicationScoped
public class CalmDocumentParser {

    private static final Logger logger = LoggerFactory.getLogger(CalmDocumentParser.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** Maps the plural URL path segment (e.g. {@code "patterns"}) to {@link ResourceType}. */
    public static final Map<String, ResourceType> TYPE_MAP = Map.of(
            "patterns",      ResourceType.PATTERN,
            "architectures", ResourceType.ARCHITECTURE,
            "flows",         ResourceType.FLOW,
            "standards",     ResourceType.STANDARD,
            "interfaces",    ResourceType.INTERFACE
    );

    /** Maps {@link ResourceType} back to its plural URL segment. */
    public static final Map<ResourceType, String> TYPE_PLURAL_MAP = Map.of(
            ResourceType.PATTERN,      "patterns",
            ResourceType.ARCHITECTURE, "architectures",
            ResourceType.FLOW,         "flows",
            ResourceType.STANDARD,     "standards",
            ResourceType.INTERFACE,    "interfaces"
    );

    @ConfigProperty(name = "calm.hub.base-url", defaultValue = "http://localhost:8080")
    String baseUrl;

    // -------------------------------------------------------------------------
    // Public records / sealed hierarchy exposed to MappingControllerResource
    // -------------------------------------------------------------------------

    /**
     * Carries the version string determined from the document's {@code $id} or URL path.
     *
     * @param version  always non-null; a version is always required.
     * @param explicit always {@code true}; kept for compatibility with existing call-sites.
     */
    public record VersionSpec(String version, boolean explicit) {}

    /**
     * Parsed representation of a fully-qualified versioned canonical {@code $id} for a
     * namespace resource.
     */
    public record CanonicalId(String namespace, ResourceType resourceType, String type, String name, String version) {}

    /** Sealed hierarchy for parsed domain-control {@code $id} values. */
    public sealed interface DomainControlId permits ControlRequirementId, ControlConfigId {}

    /**
     * A control requirement {@code $id}:
     * {@code {base}/calm/domains/{domain}/controls/{controlName}/requirement/versions/{version}}
     */
    public record ControlRequirementId(String domain, String controlName, String version) implements DomainControlId {}

    /**
     * A configuration {@code $id}:
     * {@code {base}/calm/domains/{domain}/controls/{controlName}/configurations/{configName}/versions/{version}}
     */
    public record ControlConfigId(String domain, String controlName, String configName, String version) implements DomainControlId {}

    // -------------------------------------------------------------------------
    // Base-URL helpers
    // -------------------------------------------------------------------------

    /** Returns the configured base URL trimmed and without a trailing slash. */
    public String normalizeBase() {
        String b = baseUrl == null ? "" : baseUrl.trim();
        return b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
    }

    /**
     * Returns the domain-control URL prefix: {@code {normalizedBase}/calm/domains/}.
     * Used to dispatch between namespace and domain-control resources in {@code POST /calm}.
     */
    public String domainPrefix() {
        return normalizeBase() + "/calm/domains/";
    }

    // -------------------------------------------------------------------------
    // $id extraction
    // -------------------------------------------------------------------------

    /**
     * Extracts the raw {@code $id} string from a JSON document without full validation.
     * Returns {@code null} if absent, non-string, or the document cannot be parsed.
     */
    public String extractIdFromJson(String json) {
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                JsonNode node = tree.get("$id");
                if (node != null && !node.isNull() && node.isTextual()) {
                    return node.asText();
                }
            }
        } catch (JsonProcessingException ignored) {
            // fall through
        }
        return null;
    }

    /**
     * Extracts a named string field from a JSON document.
     * Returns an empty string if the field is absent or cannot be parsed.
     */
    public String extractStringField(String json, String fieldName) {
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                JsonNode node = tree.get(fieldName);
                if (node != null && !node.isNull() && node.isTextual()) {
                    return node.asText();
                }
            }
        } catch (JsonProcessingException ignored) {
            // fall through
        }
        return "";
    }

    // -------------------------------------------------------------------------
    // $id parsing / validation
    // -------------------------------------------------------------------------

    /**
     * Parses and validates the document's {@code $id} field, extracting namespace,
     * resource type, name, and version from the canonical versioned URL.
     *
     * <p>The {@code $id} must match
     * {@code {baseUrl}/calm/namespaces/{namespace}/{type}/{name}/versions/{version}}.
     * A versionless or missing {@code $id} is rejected.</p>
     *
     * @throws IllegalArgumentException if the {@code $id} is missing, malformed, or versionless.
     * @throws JsonProcessingException  if the body cannot be parsed as JSON.
     */
    public CanonicalId parseCanonicalId(String json) throws JsonProcessingException {
        String id = readIdField(json);
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("$id is required");
        }
        String expectedPrefix = normalizeBase() + "/calm/namespaces/";
        if (!id.startsWith(expectedPrefix)) {
            throw new IllegalArgumentException(
                    "$id must start with: " + expectedPrefix + "{namespace}/{type}/{name}/versions/{version}");
        }
        // remainder: {namespace}/{type}/{name}/versions/{version}
        String remainder = id.substring(expectedPrefix.length());
        String[] parts = remainder.split("/", -1);
        if (parts.length < 5 || !"versions".equals(parts[3])) {
            throw new IllegalArgumentException(
                    "$id must include a version: " + expectedPrefix
                            + "{namespace}/{type}/{name}/versions/{version}");
        }
        String namespace = parts[0];
        String type      = parts[1];
        String name      = parts[2];
        String version   = parts[4];

        if (!namespace.matches(NAMESPACE_REGEX)) {
            throw new IllegalArgumentException("Invalid namespace in $id: " + namespace);
        }
        if (!name.matches(CUSTOM_ID_REGEX)) {
            throw new IllegalArgumentException("Invalid resource name in $id: " + name);
        }
        if ("versions".equals(name)) {
            throw new IllegalArgumentException(
                    "'versions' is a reserved path segment and cannot be used as a resource name");
        }
        if (!version.matches(VERSION_REGEX)) {
            throw new IllegalArgumentException("Invalid version in $id: " + version);
        }
        ResourceType resourceType = TYPE_MAP.get(type.toLowerCase());
        if (resourceType == null) {
            throw new IllegalArgumentException(
                    "Unsupported resource type in $id: " + type
                            + ". Supported: patterns, architectures, flows, standards, interfaces");
        }
        return new CanonicalId(namespace, resourceType, type, name, version);
    }

    /**
     * Parses a {@code $id} that matches one of the domain-control canonical URL patterns:
     * <ul>
     *   <li>{@code {base}/calm/domains/{domain}/controls/{controlName}/requirement/versions/{version}}</li>
     *   <li>{@code {base}/calm/domains/{domain}/controls/{controlName}/configurations/{configName}/versions/{version}}</li>
     * </ul>
     *
     * @throws IllegalArgumentException if the {@code $id} is missing, malformed, or does not match.
     * @throws JsonProcessingException  if the body cannot be parsed as JSON.
     */
    public DomainControlId parseDomainControlId(String json) throws JsonProcessingException {
        String id = readIdField(json);
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("$id is required");
        }
        String prefix = domainPrefix();
        if (!id.startsWith(prefix)) {
            throw new IllegalArgumentException("$id must start with: " + prefix);
        }
        // remainder: {domain}/controls/{controlName}/requirement/versions/{version}
        //         OR {domain}/controls/{controlName}/configurations/{configName}/versions/{version}
        String remainder = id.substring(prefix.length());
        String[] parts = remainder.split("/", -1);

        if (parts.length < 6 || !"controls".equals(parts[1])) {
            throw new IllegalArgumentException("Invalid domain control $id: " + id);
        }

        String domain      = parts[0];
        String controlName = parts[2];

        if ("requirement".equals(parts[3]) && "versions".equals(parts[4]) && parts.length == 6) {
            String version = parts[5];
            validateDomainSlug(domain, "domain");
            validateDomainSlug(controlName, "control name");
            validateVersion(version);
            return new ControlRequirementId(domain, controlName, version);
        } else if ("configurations".equals(parts[3]) && parts.length == 7 && "versions".equals(parts[5])) {
            String configName = parts[4];
            String version    = parts[6];
            validateDomainSlug(domain, "domain");
            validateDomainSlug(controlName, "control name");
            validateDomainSlug(configName, "config name");
            validateVersion(version);
            return new ControlConfigId(domain, controlName, configName, version);
        }
        throw new IllegalArgumentException("Invalid domain control $id format: " + id);
    }

    /**
     * Verifies that the document's {@code $id} equals the canonical versioned URL for the
     * given path parameters.
     *
     * @throws IllegalArgumentException if the {@code $id} is missing or does not match.
     * @throws JsonProcessingException  if the body cannot be parsed as JSON.
     */
    public VersionSpec resolveAndVerify(String json, String namespace, String typePath,
                                        String name, String pathVersion)
            throws JsonProcessingException {
        String id = readIdField(json);
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("$id is required");
        }
        String expected = normalizeBase() + "/calm/namespaces/" + namespace + "/" + typePath
                + "/" + name + "/versions/" + pathVersion;
        if (!id.equals(expected)) {
            throw new IllegalArgumentException(
                    "$id does not match the expected URL. Expected: " + expected);
        }
        return new VersionSpec(pathVersion, true);
    }

    // -------------------------------------------------------------------------
    // Document manipulation
    // -------------------------------------------------------------------------

    /**
     * Rewrites the {@code $id} field in the returned JSON to the canonical URL.
     *
     * @param version {@code null} for the versionless (latest) form; a semver string for the
     *                versioned form.
     */
    public String rewriteId(String json, String namespace, String typePath, String name, String version) {
        String configuredBase = baseUrl == null ? null : baseUrl.trim();
        if (configuredBase == null || configuredBase.isEmpty()) {
            return json;
        }
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject()) {
                String normalizedBase = configuredBase.endsWith("/")
                        ? configuredBase.substring(0, configuredBase.length() - 1)
                        : configuredBase;
                String canonicalUrl = normalizedBase + "/calm/namespaces/" + namespace
                        + "/" + typePath + "/" + name;
                if (version != null) {
                    canonicalUrl = canonicalUrl + "/versions/" + version;
                }
                ((ObjectNode) tree).put("$id", canonicalUrl);
                return OBJECT_MAPPER.writeValueAsString(tree);
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not rewrite $id in JSON, using original", e);
        }
        return json;
    }

    /**
     * Returns the document with any top-level {@code $id} field removed.
     *
     * <p>The {@code $id} is verified against the canonical URL before persistence, but it must not
     * be stored: MongoDB rejects documents carrying a top-level {@code $}-prefixed field (a bare
     * {@code $id} is only valid inside a DBRef, raising write error code 55), and the canonical
     * {@code $id} is re-derived on read via {@link #rewriteId}. Stripping keeps a single source of
     * truth (the storage coordinates) and behaves identically across the Mongo and Nitrite stores.</p>
     *
     * <p>Returns the original JSON unchanged when it is blank, not a JSON object, or has no
     * {@code $id} field.</p>
     */
    public String stripId(String json) {
        if (json == null || json.isBlank()) {
            return json;
        }
        try {
            JsonNode tree = OBJECT_MAPPER.readTree(json);
            if (tree.isObject() && tree.has("$id")) {
                ((ObjectNode) tree).remove("$id");
                return OBJECT_MAPPER.writeValueAsString(tree);
            }
        } catch (JsonProcessingException e) {
            logger.warn("Could not strip $id from JSON, using original", e);
        }
        return json;
    }

    // -------------------------------------------------------------------------
    // Type helpers
    // -------------------------------------------------------------------------

    /**
     * Maps a plural URL path segment (e.g. {@code "patterns"}) to the corresponding
     * {@link ResourceType}, or {@code null} if unrecognised.
     */
    public ResourceType parseTypePlural(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        return TYPE_MAP.get(type.toLowerCase());
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** Reads the raw {@code $id} text node from a JSON string. Returns {@code null} if absent. */
    private String readIdField(String json) throws JsonProcessingException {
        JsonNode tree = OBJECT_MAPPER.readTree(json);
        if (tree.isObject()) {
            JsonNode node = tree.get("$id");
            if (node != null && !node.isNull()) {
                return node.asText();
            }
        }
        return null;
    }

    private void validateDomainSlug(String value, String label) {
        if (!value.matches(DOMAIN_REGEX)) {
            throw new IllegalArgumentException("Invalid " + label + " in $id: " + value);
        }
    }

    private void validateVersion(String version) {
        if (!version.matches(VERSION_REGEX)) {
            throw new IllegalArgumentException("Invalid version in $id: " + version);
        }
    }
}
