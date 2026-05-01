package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

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

    // --- validatePositiveId ---

    @Test
    void accept_positive_id() {
        assertThat(McpValidationHelper.validatePositiveId(1, "TestId"), is(nullValue()));
        assertThat(McpValidationHelper.validatePositiveId(100, "TestId"), is(nullValue()));
    }

    @Test
    void reject_zero_id() {
        String result = McpValidationHelper.validatePositiveId(0, "TestId");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("TestId"));
    }

    @Test
    void reject_negative_id() {
        String result = McpValidationHelper.validatePositiveId(-1, "TestId");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("TestId"));
    }

    // --- validateDescriptionLength ---

    @Test
    void accept_description_within_max_length() {
        assertThat(McpValidationHelper.validateDescriptionLength("short desc", "Desc"), is(nullValue()));
        assertThat(McpValidationHelper.validateDescriptionLength("x".repeat(1024), "Desc"), is(nullValue()));
    }

    @Test
    void reject_description_exceeding_max_length() {
        String result = McpValidationHelper.validateDescriptionLength("x".repeat(1025), "Desc");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Desc"));
        assertThat(result, containsString("1024"));
    }

    // --- validateJson ---

    @Test
    void accept_valid_json_object() {
        assertThat(McpValidationHelper.validateJson("{}", "TestJson"), is(nullValue()));
        assertThat(McpValidationHelper.validateJson("{\"key\":\"value\"}", "TestJson"), is(nullValue()));
    }

    @Test
    void accept_null_or_blank_json_without_error() {
        // null/blank JSON is only rejected if it was required; validateJson treats blank as "no value"
        assertThat(McpValidationHelper.validateJson(null, "TestJson"), is(nullValue()));
        assertThat(McpValidationHelper.validateJson("", "TestJson"), is(nullValue()));
        assertThat(McpValidationHelper.validateJson("   ", "TestJson"), is(nullValue()));
    }

    @Test
    void reject_invalid_json_syntax() {
        String result = McpValidationHelper.validateJson("not-json", "TestJson");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("Invalid"));
        assertThat(result, containsString("TestJson"));
    }

    @Test
    void reject_json_array_as_non_object() {
        String result = McpValidationHelper.validateJson("[1,2,3]", "TestJson");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("TestJson"));
    }

    // --- validateNoWhitespaceFilter ---

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void accept_null_or_blank_filter_as_not_supplied(String value) {
        assertThat(McpValidationHelper.validateNoWhitespaceFilter(value, 100, "MyFilter"), is(nullValue()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"deployment", "threat-model", "/calm/namespaces/finos/architectures/1/versions/1-0-0", "A1_b.c-d"})
    void accept_valid_no_whitespace_filter(String value) {
        assertThat(McpValidationHelper.validateNoWhitespaceFilter(value, 500, "MyFilter"), is(nullValue()));
    }

    @ParameterizedTest
    @ValueSource(strings = {" deployment", "threat model", "type\n", "type\t", "bad value!"})
    void reject_filter_containing_whitespace_or_illegal_chars(String value) {
        String result = McpValidationHelper.validateNoWhitespaceFilter(value, 500, "MyFilter");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("MyFilter"));
    }

    @Test
    void reject_filter_exceeding_max_length() {
        String longValue = "a".repeat(501);
        String result = McpValidationHelper.validateNoWhitespaceFilter(longValue, 500, "MyFilter");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("MyFilter"));
        assertThat(result, containsString("500"));
    }

    // --- validateMaxLength ---

    @ParameterizedTest
    @NullAndEmptySource
    void accept_null_or_empty_for_max_length(String value) {
        assertThat(McpValidationHelper.validateMaxLength(value, 50, "MyField"), is(nullValue()));
    }

    @Test
    void accept_value_within_max_length() {
        assertThat(McpValidationHelper.validateMaxLength("hello", 10, "MyField"), is(nullValue()));
        assertThat(McpValidationHelper.validateMaxLength("x".repeat(200), 200, "MyField"), is(nullValue()));
    }

    @Test
    void reject_value_exceeding_max_length() {
        String result = McpValidationHelper.validateMaxLength("x".repeat(201), 200, "MyField");
        assertThat(result, startsWith("Error:"));
        assertThat(result, containsString("MyField"));
        assertThat(result, containsString("200"));
    }

    // --- firstError ---

    @Test
    void return_empty_when_all_checks_pass() {
        Optional<ToolResponse> result = McpValidationHelper.firstError(
                () -> null,
                () -> null,
                () -> null);
        assertThat(result.isPresent(), is(false));
    }

    @Test
    void return_first_error_and_short_circuit() {
        boolean[] secondCalled = {false};
        Optional<ToolResponse> result = McpValidationHelper.firstError(
                () -> "Error: first failure.",
                () -> { secondCalled[0] = true; return null; });
        assertThat(result.isPresent(), is(true));
        assertThat(result.get().isError(), is(true));
        assertThat(secondCalled[0], is(false));
    }

    @Test
    void return_error_from_second_check_when_first_passes() {
        Optional<ToolResponse> result = McpValidationHelper.firstError(
                () -> null,
                () -> "Error: second failure.");
        assertThat(result.isPresent(), is(true));
        assertThat(result.get().isError(), is(true));
    }

    @Test
    void return_empty_for_no_checks() {
        Optional<ToolResponse> result = McpValidationHelper.firstError();
        assertThat(result.isPresent(), is(false));
    }
}
