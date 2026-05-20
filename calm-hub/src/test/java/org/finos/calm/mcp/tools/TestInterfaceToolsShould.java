package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionExistsException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
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
class TestInterfaceToolsShould {

    @Mock
    InterfaceStore interfaceStore;

    @InjectMocks
    InterfaceTools interfaceTools;

    @BeforeEach
    void setup() {
        interfaceTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return ((TextContent) r.firstContent()).text();
    }

    // --- listInterfaces ---

    @Test
    void return_interfaces_when_namespace_has_entries() throws NamespaceNotFoundException {
        when(interfaceStore.getInterfacesForNamespace("finos"))
                .thenReturn(List.of(
                        new NamespaceInterfaceSummary("Trading API", "REST interface for trades", 1)
                ));

        ToolResponse result = interfaceTools.listInterfaces("finos");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("finos"));
        assertThat(text(result), containsString("Trading API"));
        assertThat(text(result), containsString("ID: 1"));
    }

    @Test
    void return_no_interfaces_message_for_empty_namespace() throws NamespaceNotFoundException {
        when(interfaceStore.getInterfacesForNamespace("empty"))
                .thenReturn(List.of());

        ToolResponse result = interfaceTools.listInterfaces("empty");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No interfaces found"));
    }

    @Test
    void return_error_for_nonexistent_namespace_on_list_interfaces() throws NamespaceNotFoundException {
        when(interfaceStore.getInterfacesForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = interfaceTools.listInterfaces("missing");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_namespace_for_list_interfaces(String namespace) {
        ToolResponse result = interfaceTools.listInterfaces(namespace);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    // --- listInterfaceVersions ---

    @Test
    void return_versions_for_valid_interface() throws Exception {
        when(interfaceStore.getInterfaceVersions("finos", 1))
                .thenReturn(List.of("1.0.0", "1.1.0"));

        ToolResponse result = interfaceTools.listInterfaceVersions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("1.1.0"));
    }

    @Test
    void return_empty_versions_message_for_interface() throws Exception {
        when(interfaceStore.getInterfaceVersions("finos", 1))
                .thenReturn(List.of());

        ToolResponse result = interfaceTools.listInterfaceVersions("finos", 1);

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("No versions found"));
    }

    @Test
    void return_error_when_interface_not_found_for_versions() throws Exception {
        when(interfaceStore.getInterfaceVersions("finos", 99))
                .thenThrow(new InterfaceNotFoundException());

        ToolResponse result = interfaceTools.listInterfaceVersions("finos", 99);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_interface_versions() throws Exception {
        when(interfaceStore.getInterfaceVersions("missing", 1))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = interfaceTools.listInterfaceVersions("missing", 1);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_non_positive_interface_id_for_list_versions() {
        ToolResponse result = interfaceTools.listInterfaceVersions("finos", 0);

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    // --- getInterface ---

    @Test
    void return_interface_json_for_valid_version() throws Exception {
        when(interfaceStore.getInterfaceForVersion("finos", 1, "1.0.0"))
                .thenReturn("{\"$schema\":\"https://calm.finos.org/schema\"}");

        ToolResponse result = interfaceTools.getInterface("finos", 1, "1.0.0");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("$schema"));
    }

    @Test
    void return_error_when_interface_version_not_found() throws Exception {
        when(interfaceStore.getInterfaceForVersion("finos", 1, "9.9.9"))
                .thenThrow(new InterfaceVersionNotFoundException());

        ToolResponse result = interfaceTools.getInterface("finos", 1, "9.9.9");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Version"));
    }

    @Test
    void return_error_when_interface_not_found_for_get() throws Exception {
        when(interfaceStore.getInterfaceForVersion("finos", 99, "1.0.0"))
                .thenThrow(new InterfaceNotFoundException());

        ToolResponse result = interfaceTools.getInterface("finos", 99, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_get_interface() throws Exception {
        when(interfaceStore.getInterfaceForVersion("missing", 1, "1.0.0"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = interfaceTools.getInterface("missing", 1, "1.0.0");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Namespace"));
    }

    @Test
    void reject_invalid_version_for_get_interface() {
        ToolResponse result = interfaceTools.getInterface("finos", 1, "not-a-version");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_non_positive_id_for_get_interface() {
        ToolResponse result = interfaceTools.getInterface("finos", -1, "1.0.0");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    // --- createInterface ---

    @Test
    void create_interface_successfully() throws NamespaceNotFoundException {
        CalmInterface created = new CalmInterface("Trading API", "REST interface for trades", "{}", 7, "1.0.0");
        when(interfaceStore.createInterfaceForNamespace(any(), eq("finos")))
                .thenReturn(created);

        ToolResponse result = interfaceTools.createInterface("finos", "Trading API", "REST interface for trades", "{}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("7"));
        assertThat(text(result), containsString("1.0.0"));
        assertThat(text(result), containsString("finos"));
    }

    @Test
    void return_error_when_creating_interface_in_missing_namespace() throws NamespaceNotFoundException {
        when(interfaceStore.createInterfaceForNamespace(any(), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = interfaceTools.createInterface("missing", "API", "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_json_for_create_interface() {
        ToolResponse result = interfaceTools.createInterface("finos", "API", "desc", "not-json");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Invalid"));
        verifyNoInteractions(interfaceStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_json_for_create_interface(String json) {
        ToolResponse result = interfaceTools.createInterface("finos", "API", "desc", json);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface JSON"));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_interface_name_exceeding_max_length() {
        String longName = "n".repeat(201);
        ToolResponse result = interfaceTools.createInterface("finos", longName, "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface name"));
        verifyNoInteractions(interfaceStore);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void reject_blank_or_null_name_for_create_interface(String name) {
        ToolResponse result = interfaceTools.createInterface("finos", name, "desc", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface name"));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_interface_description_exceeding_max_length() {
        String longDesc = "d".repeat(1025);
        ToolResponse result = interfaceTools.createInterface("finos", "API", longDesc, "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface description"));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_oversized_json_for_create_interface() {
        String hugeJson = "{\"x\":\"" + "a".repeat(100_001) + "\"}";
        ToolResponse result = interfaceTools.createInterface("finos", "API", "desc", hugeJson);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface JSON"));
        verifyNoInteractions(interfaceStore);
    }

    // --- createInterfaceVersion ---

    @Test
    void create_interface_version_successfully() throws Exception {
        when(interfaceStore.getInterfacesForNamespace("finos"))
                .thenReturn(List.of(new NamespaceInterfaceSummary("Trading API", "REST interface", 1)));
        when(interfaceStore.createInterfaceForVersion(any(), eq("finos"), eq(1), eq("1.1.0")))
                .thenReturn(new CalmInterface("Trading API", "REST interface", "{}", 1, "1.1.0"));

        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("1.1.0"));
        assertThat(text(result), containsString("finos"));
    }

    @Test
    void return_error_when_version_already_exists() throws Exception {
        when(interfaceStore.getInterfacesForNamespace("finos"))
                .thenReturn(List.of(new NamespaceInterfaceSummary("Trading API", "REST interface", 1)));
        when(interfaceStore.createInterfaceForVersion(any(), anyString(), anyInt(), anyString()))
                .thenThrow(new InterfaceVersionExistsException());

        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 1, "1.0.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("already exists"));
    }

    @Test
    void return_error_when_interface_not_found_for_create_version() throws Exception {
        when(interfaceStore.getInterfacesForNamespace("finos"))
                .thenReturn(List.of()); // interface 99 not in namespace

        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 99, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void return_error_when_namespace_not_found_for_create_interface_version() throws Exception {
        when(interfaceStore.getInterfacesForNamespace("missing"))
                .thenThrow(new NamespaceNotFoundException());

        ToolResponse result = interfaceTools.createInterfaceVersion("missing", 1, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("not found"));
    }

    @Test
    void reject_invalid_version_format_for_create_interface_version() {
        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 1, "not-semver", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_non_positive_id_for_create_interface_version() {
        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 0, "1.1.0", "{}");

        assertThat(result.isError(), is(true));
        verifyNoInteractions(interfaceStore);
    }

    @Test
    void reject_oversized_json_for_create_interface_version() {
        String hugeJson = "{\"x\":\"" + "a".repeat(100_001) + "\"}";
        ToolResponse result = interfaceTools.createInterfaceVersion("finos", 1, "1.1.0", hugeJson);

        assertThat(result.isError(), is(true));
        assertThat(text(result), containsString("Interface JSON"));
        verifyNoInteractions(interfaceStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        interfaceTools.mcpEnabled = false;

        assertThat(text(interfaceTools.listInterfaces("finos")), containsString("disabled"));
        assertThat(text(interfaceTools.listInterfaceVersions("finos", 1)), containsString("disabled"));
        assertThat(text(interfaceTools.getInterface("finos", 1, "1.0.0")), containsString("disabled"));
        assertThat(text(interfaceTools.createInterface("finos", "n", "d", "{}")), containsString("disabled"));
        assertThat(text(interfaceTools.createInterfaceVersion("finos", 1, "1.1.0", "{}")), containsString("disabled"));
        verifyNoInteractions(interfaceStore);
    }
}
