package org.finos.calm.mcp.tools;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_NAME_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_REGEX;

/**
 * Shared input validation for MCP tool methods. Returns a human-readable
 * error string when validation fails, or {@code null} when the input is valid.
 */
final class McpValidationHelper {

    static final String MCP_DISABLED_MESSAGE =
            "Error: MCP tools are currently disabled. Set the environment variable CALM_MCP_ENABLED=true to enable.";

    private static final int MAX_DESCRIPTION_LENGTH = 1024;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private McpValidationHelper() {
    }

    static String checkEnabled(boolean mcpEnabled) {
        return mcpEnabled ? null : MCP_DISABLED_MESSAGE;
    }

    static String validateNamespace(String namespace) {
        if (namespace == null || namespace.isBlank()) {
            return "Error: Namespace must not be blank.";
        }
        if (!namespace.matches(NAMESPACE_REGEX)) {
            return "Error: Invalid namespace format '" + namespace + "'. Must be alphanumeric with optional hyphens/dots.";
        }
        return null;
    }

    static String validateVersion(String version) {
        if (version == null || version.isBlank()) {
            return "Error: Version must not be blank.";
        }
        if (!version.matches(VERSION_REGEX)) {
            return "Error: Invalid version format '" + version + "'. Expected semantic version (e.g. '1.0.0').";
        }
        return null;
    }

    static String validateDomain(String domain) {
        if (domain == null || domain.isBlank()) {
            return "Error: Domain must not be blank.";
        }
        if (!domain.matches(DOMAIN_NAME_REGEX)) {
            return "Error: Invalid domain format '" + domain + "'. Must be alphanumeric with optional hyphens.";
        }
        return null;
    }

    static String validateNotBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return "Error: " + fieldName + " must not be blank.";
        }
        return null;
    }

    /**
     * Validates that {@code id} is a positive integer (> 0).
     *
     * @param id        the numeric ID to check
     * @param fieldName human-readable field name for the error message
     * @return error string, or {@code null} if valid
     */
    static String validatePositiveId(int id, String fieldName) {
        if (id <= 0) {
            return "Error: " + fieldName + " must be a positive integer, got " + id + ".";
        }
        return null;
    }

    /**
     * Validates that an optional description does not exceed the maximum allowed length.
     * A {@code null} description is accepted.
     *
     * @param description the description to check (may be null)
     * @param fieldName   human-readable field name for the error message
     * @return error string, or {@code null} if valid
     */
    static String validateDescriptionLength(String description, String fieldName) {
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            return "Error: " + fieldName + " must not exceed " + MAX_DESCRIPTION_LENGTH + " characters.";
        }
        return null;
    }

    /**
     * Validates that {@code json} is a syntactically valid JSON object.
     * Also rejects blank values.
     *
     * @param json      the JSON string to validate
     * @param fieldName human-readable field name for the error message
     * @return error string, or {@code null} if valid
     */
    static String validateJson(String json, String fieldName) {
        if (json == null || json.isBlank()) {
            // blank is treated as "no value supplied"; callers use validateNotBlank if blank is forbidden
            return null;
        }
        try {
            com.fasterxml.jackson.databind.JsonNode node = OBJECT_MAPPER.readTree(json);
            if (!node.isObject()) {
                return "Error: " + fieldName + " must be a JSON object.";
            }
        } catch (Exception e) {
            return "Error: Invalid " + fieldName + " - not valid JSON.";
        }
        return null;
    }
}
