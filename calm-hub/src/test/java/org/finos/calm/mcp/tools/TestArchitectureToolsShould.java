package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.architecture.NamespaceArchitectureSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestArchitectureToolsShould {

    @Mock
    ArchitectureStore architectureStore;

    @InjectMocks
    ArchitectureTools architectureTools;

    @BeforeEach
    void setup() {
        architectureTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listArchitectures ---

    @Test
    void return_architectures_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(
                        new NamespaceArchitectureSummary("Conference Signup", "A conference signup architecture", 1)
                ));

        ToolResponse result = architectureTools.listArchitectures("workshop");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("workshop"));
        assertThat(text(result), containsString("Conference Signup"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_architectures_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(architectureStore.getArchitecturesForNamespace("empty"))
                .thenReturn(List.of());

        ToolResponse result = architectureTools.listArchitectures("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No architectures found"));
    }

    @Test
    void return_error_for_nonexistent_namespace() throws NamespaceNotFoundException {
        when(architectureStore.getArchitecturesForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = architectureTools.listArchitectures("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_architectures(String namespace) {
        ToolResponse result = architectureTools.listArchitectures(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    // --- listArchitectureVersions ---

    @Test
    void return_versions_for_valid_architecture() throws Exception {
        when(architectureStore.getArchitectureVersions(any()))
                .thenReturn(List.of("1.0.0", "2.0.0"));

        ToolResponse result = architectureTools.listArchitectureVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("2.0.0"));
    }

    @Test
    void return_empty_versions_message() throws Exception {
        when(architectureStore.getArchitectureVersions(any()))
                .thenReturn(List.of());

        ToolResponse result = architectureTools.listArchitectureVersions("workshop", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_architecture_not_found_for_versions() throws Exception {
        when(architectureStore.getArchitectureVersions(any()))
                .thenThrow(new ArchitectureNotFoundException());

        ToolResponse result = architectureTools.listArchitectureVersions("workshop", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_versions() throws Exception {
        when(architectureStore.getArchitectureVersions(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = architectureTools.listArchitectureVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_namespace_for_list_versions() {
        ToolResponse result = architectureTools.listArchitectureVersions("bad ns", 1);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_non_positive_architecture_id_for_list_versions() {
        ToolResponse result = architectureTools.listArchitectureVersions("workshop", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    // --- getArchitecture ---

    @Test
    void return_architecture_json_for_valid_version() throws Exception {
        when(architectureStore.getArchitectureForVersion(any()))
                .thenReturn("{\"nodes\":[],\"relationships\":[]}");

        ToolResponse result = architectureTools.getArchitecture("workshop", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("nodes"));
    }

    @Test
    void return_error_when_architecture_version_not_found() throws Exception {
        when(architectureStore.getArchitectureForVersion(any()))
                .thenThrow(new ArchitectureVersionNotFoundException());

        ToolResponse result = architectureTools.getArchitecture("workshop", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get() throws Exception {
        when(architectureStore.getArchitectureForVersion(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = architectureTools.getArchitecture("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void return_error_when_architecture_not_found_for_get() throws Exception {
        when(architectureStore.getArchitectureForVersion(any()))
                .thenThrow(new ArchitectureNotFoundException());

        ToolResponse result = architectureTools.getArchitecture("workshop", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture"));
    }

    @Test
    void reject_invalid_namespace_for_get_architecture() {
        ToolResponse result = architectureTools.getArchitecture("bad ns", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_invalid_version_for_get_architecture() {
        ToolResponse result = architectureTools.getArchitecture("workshop", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_non_positive_architecture_id_for_get_architecture() {
        ToolResponse result = architectureTools.getArchitecture("workshop", -1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    // --- createArchitecture ---

    @Test
    void create_architecture_successfully() throws NamespaceNotFoundException {
        Architecture returnedArch = new Architecture.ArchitectureBuilder()
                .setNamespace("workshop")
                .setId(42)
                .setVersion("1.0.0")
                .build();
        when(architectureStore.createArchitectureForNamespace(any()))
                .thenReturn(returnedArch);

        ToolResponse result = architectureTools.createArchitecture("workshop", "My Arch", "A description", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("ID: 42"));
        assertThat(text(result), containsString("version 1.0.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void return_error_when_creating_architecture_in_missing_namespace() throws NamespaceNotFoundException {
        when(architectureStore.createArchitectureForNamespace(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = architectureTools.createArchitecture("missing", "My Arch", "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_for_invalid_architecture_json() {
        ToolResponse result = architectureTools.createArchitecture("workshop", "My Arch", "desc", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_invalid_namespace_for_create_architecture() {
        ToolResponse result = architectureTools.createArchitecture("bad ns", "name", "desc", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_architecture(String json) {
        ToolResponse result = architectureTools.createArchitecture("workshop", "name", "desc", json);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture JSON"));
        verifyNoInteractions(architectureStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        architectureTools.mcpEnabled = false;

        assertThat(text(architectureTools.listArchitectures("workshop")), containsString("disabled"));
        assertThat(text(architectureTools.listArchitectureVersions("workshop", 1)), containsString("disabled"));
        assertThat(text(architectureTools.getArchitecture("workshop", 1, "1.0.0")), containsString("disabled"));
        assertThat(text(architectureTools.createArchitecture("workshop", "n", "d", "{}")), containsString("disabled"));
        verifyNoInteractions(architectureStore);
    }
}
