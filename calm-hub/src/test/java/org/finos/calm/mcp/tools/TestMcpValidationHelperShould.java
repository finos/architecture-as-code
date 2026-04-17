package org.finos.calm.mcp.tools;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;

class TestMcpValidationHelperShould {

    // --- validateNamespace ---

    @ParameterizedTest
    @ValueSource(strings = {"workshop", "finos", "my-namespace", "org.finos.calm", "A-Z-test"})
    void accept_valid_namespaces(String namespace) {
        assertThat(McpValidationHelper.validateNamespace(namespace), is(nullValue()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_namespaces(String namespace) {
        String result = McpValidationHelper.validateNamespace(namespace);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("blank"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"bad namespace", "bad/namespace", "bad@ns", ".leading-dot"})
    void reject_invalid_namespace_format(String namespace) {
        String result = McpValidationHelper.validateNamespace(namespace);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Invalid namespace format"));
    }

    // --- validateVersion ---

    @ParameterizedTest
    @ValueSource(strings = {"1.0.0", "0.1.0", "10.20.30", "1-0-0"})
    void accept_valid_versions(String version) {
        assertThat(McpValidationHelper.validateVersion(version), is(nullValue()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_versions(String version) {
        String result = McpValidationHelper.validateVersion(version);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("blank"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "1.0", "v1.0.0", "1.0.0.0"})
    void reject_invalid_version_format(String version) {
        String result = McpValidationHelper.validateVersion(version);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Invalid version format"));
    }

    // --- validateDomain ---

    @ParameterizedTest
    @ValueSource(strings = {"api-threats", "cloud-security", "OWASP", "test123"})
    void accept_valid_domains(String domain) {
        assertThat(McpValidationHelper.validateDomain(domain), is(nullValue()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_domains(String domain) {
        String result = McpValidationHelper.validateDomain(domain);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("blank"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"bad domain", "bad.domain", "bad/domain"})
    void reject_invalid_domain_format(String domain) {
        String result = McpValidationHelper.validateDomain(domain);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Invalid domain format"));
    }

    // --- validateNotBlank ---

    @Test
    void accept_non_blank_value() {
        assertThat(McpValidationHelper.validateNotBlank("some value", "TestField"), is(nullValue()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_values(String value) {
        String result = McpValidationHelper.validateNotBlank(value, "TestField");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("TestField"));
        assertThat(result, containsString("blank"));
    }

    // --- checkEnabled ---

    @Test
    void return_null_when_mcp_is_enabled() {
        assertThat(McpValidationHelper.checkEnabled(true), is(nullValue()));
    }

    @Test
    void return_error_when_mcp_is_disabled() {
        String result = McpValidationHelper.checkEnabled(false);
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("disabled"));
        assertThat(result, containsString("CALM_MCP_ENABLED"));
    }
}
