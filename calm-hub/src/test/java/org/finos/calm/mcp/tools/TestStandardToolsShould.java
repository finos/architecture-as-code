package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.finos.calm.store.StandardStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestStandardToolsShould {

    @Mock
    StandardStore standardStore;

    @InjectMocks
    StandardTools standardTools;

    @BeforeEach
    void setup() {
        standardTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listStandards ---

    @Test
    void return_standards_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(standardStore.getStandardsForNamespace("finos"))
                .thenReturn(List.of(
                        new NamespaceStandardSummary("Security Controls", "Defines security requirements", 1)
                ));

        ToolResponse result = standardTools.listStandards("finos");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("finos"));
        assertThat(text(result), containsString("Security Controls"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_standards_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(standardStore.getStandardsForNamespace("empty"))
                .thenReturn(List.of());

        ToolResponse result = standardTools.listStandards("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No standards found"));
    }

    @Test
    void return_error_for_nonexistent_namespace_list_standards() throws NamespaceNotFoundException {
        when(standardStore.getStandardsForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = standardTools.listStandards("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_standards(String namespace) {
        ToolResponse result = standardTools.listStandards(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_list_standards() {
        standardTools.mcpEnabled = false;

        ToolResponse result = standardTools.listStandards("finos");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(standardStore);
    }

    // --- listStandardVersions ---

    @Test
    void return_versions_for_valid_standard() throws Exception {
        when(standardStore.getStandardVersions("finos", 1))
                .thenReturn(List.of("1.0.0", "1.1.0"));

        ToolResponse result = standardTools.listStandardVersions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    void return_empty_versions_message_for_standard() throws Exception {
        when(standardStore.getStandardVersions("finos", 1))
                .thenReturn(List.of());

        ToolResponse result = standardTools.listStandardVersions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_standard_not_found_for_versions() throws Exception {
        when(standardStore.getStandardVersions("finos", 99))
                .thenThrow(new StandardNotFoundException());

        ToolResponse result = standardTools.listStandardVersions("finos", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_standard_versions() throws Exception {
        when(standardStore.getStandardVersions("missing", 1))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = standardTools.listStandardVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_list_standard_versions() {
        ToolResponse result = standardTools.listStandardVersions("bad ns", 1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void reject_non_positive_standard_id_for_list_versions() {
        ToolResponse result = standardTools.listStandardVersions("finos", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_list_standard_versions() {
        standardTools.mcpEnabled = false;

        ToolResponse result = standardTools.listStandardVersions("finos", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(standardStore);
    }

    // --- getStandard ---

    @Test
    void return_standard_json_for_valid_version() throws Exception {
        when(standardStore.getStandardForVersion("finos", 1, "1.0.0"))
                .thenReturn("{\"$schema\":\"https://calm.finos.org/schema\"}");

        ToolResponse result = standardTools.getStandard("finos", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("$schema"));
    }

    @Test
    void return_error_when_standard_version_not_found() throws Exception {
        when(standardStore.getStandardForVersion("finos", 1, "9.9.9"))
                .thenThrow(new StandardVersionNotFoundException());

        ToolResponse result = standardTools.getStandard("finos", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_when_standard_not_found_for_get() throws Exception {
        when(standardStore.getStandardForVersion("finos", 99, "1.0.0"))
                .thenThrow(new StandardNotFoundException());

        ToolResponse result = standardTools.getStandard("finos", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_standard() throws Exception {
        when(standardStore.getStandardForVersion("missing", 1, "1.0.0"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = standardTools.getStandard("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_version_for_get_standard() {
        ToolResponse result = standardTools.getStandard("finos", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_get_standard() {
        standardTools.mcpEnabled = false;

        ToolResponse result = standardTools.getStandard("finos", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(standardStore);
    }

    // --- createStandard ---

    @Test
    void create_standard_successfully() throws Exception {
        Standard created = new Standard(new CreateStandardRequest("My Standard", "A description", "{}"));
        created.setId(42);
        created.setVersion("1.0.0");
        when(standardStore.createStandardForNamespace(any(CreateStandardRequest.class), eq("finos")))
                .thenReturn(created);

        ToolResponse result = standardTools.createStandard("finos", "My Standard", "A description", "{}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("42"));
        assertThat(text(result), containsString("1.0.0"));
    }

    @Test
    void return_error_when_namespace_not_found_for_create_standard() throws Exception {
        when(standardStore.createStandardForNamespace(any(), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = standardTools.createStandard("missing", "My Standard", "A description", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_standard_json_for_create(String json) {
        ToolResponse result = standardTools.createStandard("finos", "My Standard", "A description", json);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void reject_invalid_json_for_create_standard() {
        ToolResponse result = standardTools.createStandard("finos", "My Standard", "A description", "not-json");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_create_standard() {
        standardTools.mcpEnabled = false;

        ToolResponse result = standardTools.createStandard("finos", "My Standard", "A description", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(standardStore);
    }

    // --- createStandardVersion ---

    @Test
    void create_standard_version_successfully() throws Exception {
        Standard created = new Standard(new CreateStandardRequest(null, null, "{}"));
        created.setId(1);
        created.setVersion("1.1.0");
        when(standardStore.createStandardForVersion(any(CreateStandardRequest.class), eq("finos"), eq(1), eq("1.1.0")))
                .thenReturn(created);

        ToolResponse result = standardTools.createStandardVersion("finos", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    void return_error_when_version_already_exists() throws Exception {
        when(standardStore.createStandardForVersion(any(), anyString(), anyInt(), anyString()))
                .thenThrow(new StandardVersionExistsException());

        ToolResponse result = standardTools.createStandardVersion("finos", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    void return_error_when_standard_not_found_for_create_version() throws Exception {
        when(standardStore.createStandardForVersion(any(), anyString(), anyInt(), anyString()))
                .thenThrow(new StandardNotFoundException());

        ToolResponse result = standardTools.createStandardVersion("finos", 99, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_create_standard_version() throws Exception {
        when(standardStore.createStandardForVersion(any(), anyString(), anyInt(), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = standardTools.createStandardVersion("missing", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_version_format_for_create_standard_version() {
        ToolResponse result = standardTools.createStandardVersion("finos", 1, "not-semver", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void reject_non_positive_id_for_create_standard_version() {
        ToolResponse result = standardTools.createStandardVersion("finos", 0, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void reject_blank_json_for_create_standard_version() {
        ToolResponse result = standardTools.createStandardVersion("finos", 1, "1.1.0", "");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(standardStore);
    }

    @Test
    void return_error_when_mcp_disabled_for_create_standard_version() {
        standardTools.mcpEnabled = false;

        ToolResponse result = standardTools.createStandardVersion("finos", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("disabled"));
        verifyNoInteractions(standardStore);
    }
}
