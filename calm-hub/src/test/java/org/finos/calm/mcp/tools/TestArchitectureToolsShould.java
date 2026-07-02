package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.architecture.NamespaceArchitectureSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
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
        architectureTools.allowPutOperations = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listArchitectures ---

    @Test
    void return_architectures_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(
                        new NamespaceArchitectureSummary("Conference Signup", "A conference signup architecture", 1, 0)
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

    @Test
    void reject_architecture_name_exceeding_max_length() {
        String longName = "n".repeat(201);
        ToolResponse result = architectureTools.createArchitecture("workshop", longName, "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture name"));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_architecture_description_exceeding_max_length() {
        String longDesc = "d".repeat(1025);
        ToolResponse result = architectureTools.createArchitecture("workshop", "name", longDesc, "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture description"));
        verifyNoInteractions(architectureStore);
    }

    // --- createArchitectureVersion ---

    @Test
    void create_architecture_version_successfully() throws Exception {
        architectureTools.allowPutOperations = false;
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("Existing Name", "Existing description", 1, 0)));

        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("1.1.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void create_architecture_version_preserves_existing_name_and_description() throws Exception {
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("Conference Signup", "A signup flow", 1, 0)));
        ArgumentCaptor<Architecture> captor = ArgumentCaptor.forClass(Architecture.class);

        architectureTools.createArchitectureVersion("workshop", 1, "2.0.0", "{\"nodes\":[]}");

        verify(architectureStore).createArchitectureForVersion(captor.capture());
        assertThat(captor.getValue().getName(), is("Conference Signup"));
        assertThat(captor.getValue().getDescription(), is("A signup flow"));
    }

    @Test
    void create_architecture_version_succeeds_when_put_operations_disabled() throws Exception {
        // Regression guard: creating a new version is a POST and must work without allowPutOperations
        architectureTools.allowPutOperations = false;

        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(false));
    }

    @Test
    void create_architecture_version_returns_error_for_duplicate_version() throws Exception {
        org.mockito.Mockito.doThrow(new ArchitectureVersionExistsException())
                .when(architectureStore).createArchitectureForVersion(any());

        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    void create_architecture_version_returns_error_for_missing_namespace() throws Exception {
        org.mockito.Mockito.doThrow(new NamespaceNotFoundException())
                .when(architectureStore).createArchitectureForVersion(any());

        ToolResponse result = architectureTools.createArchitectureVersion("missing", 1, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void create_architecture_version_returns_error_for_missing_architecture() throws Exception {
        org.mockito.Mockito.doThrow(new ArchitectureNotFoundException())
                .when(architectureStore).createArchitectureForVersion(any());

        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 99, "1.1.0", "{\"nodes\":[]}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void create_architecture_version_rejects_invalid_version_string() {
        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "not-a-version", "{\"nodes\":[]}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void create_architecture_version_rejects_invalid_json() {
        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "1.1.0", "not-json");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void create_architecture_version_rejects_json_exceeding_max_payload() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = architectureTools.createArchitectureVersion("workshop", 1, "1.1.0", huge);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture JSON"));
        verifyNoInteractions(architectureStore);
    }

    // --- updateArchitecture (PUT — requires allowPutOperations) ---

    @Test
    void update_architecture_version_successfully() throws Exception {
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("workshop")
                .setId(1)
                .setVersion("1.1.0")
                .build();
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("Existing Name", "Existing description", 1, 0)));
        when(architectureStore.updateArchitectureForVersion(any())).thenReturn(arch);

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "1.1.0", "{\"nodes\":[]}", null, null);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1"));
        assertThat(text(result), containsString("1.1.0"));
        assertThat(text(result), containsString("workshop"));
    }

    @Test
    void preserve_existing_name_and_description_when_not_supplied_on_update() throws Exception {
        when(architectureStore.getArchitecturesForNamespace("workshop"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("MCP Test Arch", "Original description", 7, 0)));
        when(architectureStore.updateArchitectureForVersion(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 7, "1.1.0", "{\"nodes\":[]}", null, null);

        assertThat(result.isError(), is(false));
        ArgumentCaptor<Architecture> captor = ArgumentCaptor.forClass(Architecture.class);
        verify(architectureStore).updateArchitectureForVersion(captor.capture());
        assertThat(captor.getValue().getName(), is("MCP Test Arch"));
        assertThat(captor.getValue().getDescription(), is("Original description"));
    }

    @Test
    void overwrite_name_and_description_when_supplied_on_update() throws Exception {
        when(architectureStore.updateArchitectureForVersion(any()))
                .thenAnswer(inv -> inv.getArgument(0));

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 7, "1.1.0", "{\"nodes\":[]}", "New Name", "New description");

        assertThat(result.isError(), is(false));
        ArgumentCaptor<Architecture> captor = ArgumentCaptor.forClass(Architecture.class);
        verify(architectureStore).updateArchitectureForVersion(captor.capture());
        assertThat(captor.getValue().getName(), is("New Name"));
        assertThat(captor.getValue().getDescription(), is("New description"));
    }

    @Test
    void return_error_when_put_operations_disabled() {
        architectureTools.allowPutOperations = false;

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "1.1.0", "{}", null, null);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("allow.put.operations"));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_update_architecture_json_exceeding_max_payload() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "1.1.0", huge, null, null);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture JSON"));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_create_architecture_json_exceeding_max_payload() {
        String huge = "{\"x\":\"" + "a".repeat(100_001) + "\"}";

        ToolResponse result = architectureTools.createArchitecture("workshop", "name", "desc", huge);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture JSON"));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void return_error_when_namespace_not_found_for_update_architecture() throws Exception {
        when(architectureStore.updateArchitectureForVersion(any()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = architectureTools.updateArchitecture(
                "missing", 1, "1.1.0", "{}", "name", "desc");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_architecture_not_found_for_update() throws Exception {
        when(architectureStore.updateArchitectureForVersion(any()))
                .thenThrow(new ArchitectureNotFoundException());

        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 99, "1.1.0", "{}", "name", "desc");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Architecture"));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_namespace_for_update_architecture() {
        ToolResponse result = architectureTools.updateArchitecture(
                "bad ns", 1, "1.1.0", "{}", null, null);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_non_positive_id_for_update_architecture() {
        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 0, "1.1.0", "{}", null, null);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void reject_invalid_version_for_update_architecture() {
        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "not-a-version", "{}", null, null);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(architectureStore);
    }

    @Test
    void return_error_for_invalid_json_on_update_architecture() {
        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "1.1.0", "not-json", null, null);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(architectureStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_update_architecture(String json) {
        ToolResponse result = architectureTools.updateArchitecture(
                "workshop", 1, "1.1.0", json, null, null);

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
        assertThat(text(architectureTools.updateArchitecture("workshop", 1, "1.1.0", "{}", null, null)), containsString("disabled"));
        verifyNoInteractions(architectureStore);
    }
}
