package org.finos.calm.mcp.tools;

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
}
