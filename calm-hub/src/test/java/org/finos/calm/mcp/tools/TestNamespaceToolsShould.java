package org.finos.calm.mcp.tools;

import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.NamespaceStore;
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
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNamespaceToolsShould {

    @Mock
    NamespaceStore namespaceStore;

    @Mock
    DomainStore domainStore;

    @InjectMocks
    NamespaceTools namespaceTools;

    @BeforeEach
    void setup() {
        namespaceTools.mcpEnabled = true;
    }

    // --- listNamespaces ---

    @Test
    void return_namespaces() {
        when(namespaceStore.getNamespaces())
                .thenReturn(List.of(
                        new NamespaceInfo("finos", "FINOS namespace"),
                        new NamespaceInfo("workshop", "Workshop namespace")
                ));

        String result = namespaceTools.listNamespaces();

        assertThat(result, containsString("finos"));
        assertThat(result, containsString("workshop"));
    }

    @Test
    void return_no_namespaces_message() {
        when(namespaceStore.getNamespaces()).thenReturn(List.of());

        String result = namespaceTools.listNamespaces();

        assertThat(result, containsString("No namespaces found"));
    }

    @Test
    void return_namespace_without_description() {
        when(namespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo("test", null)));

        String result = namespaceTools.listNamespaces();

        assertThat(result, containsString("test"));
    }

    @Test
    void return_namespace_with_empty_description() {
        when(namespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo("test", "")));

        String result = namespaceTools.listNamespaces();

        assertThat(result, containsString("test"));
    }

    // --- createNamespace ---

    @Test
    void create_namespace_successfully() throws NamespaceAlreadyExistsException {
        String result = namespaceTools.createNamespace("test", "A test namespace");

        assertThat(result, containsString("created successfully"));
    }

    @Test
    void create_namespace_with_null_description() throws NamespaceAlreadyExistsException {
        String result = namespaceTools.createNamespace("no-desc", null);

        assertThat(result, containsString("created successfully"));
    }

    @Test
    void return_error_when_namespace_exists() throws NamespaceAlreadyExistsException {
        org.mockito.Mockito.doThrow(new NamespaceAlreadyExistsException("duplicate"))
                .when(namespaceStore).createNamespace("existing", "desc");

        String result = namespaceTools.createNamespace("existing", "desc");

        assertThat(result, containsString("already exists"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad namespace", "bad/ns"})
    void reject_invalid_name_for_create_namespace(String name) {
        String result = namespaceTools.createNamespace(name, "desc");

        assertThat(result, startsWith("Error:"));
        verifyNoInteractions(namespaceStore);
    }

    // --- listDomains ---

    @Test
    void return_domains() {
        when(domainStore.getDomains()).thenReturn(List.of("api-threats", "cloud-security"));

        String result = namespaceTools.listDomains();

        assertThat(result, containsString("api-threats"));
        assertThat(result, containsString("cloud-security"));
    }

    @Test
    void return_no_domains_message() {
        when(domainStore.getDomains()).thenReturn(List.of());

        String result = namespaceTools.listDomains();

        assertThat(result, containsString("No domains found"));
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        namespaceTools.mcpEnabled = false;

        assertThat(namespaceTools.listNamespaces(), containsString("disabled"));
        assertThat(namespaceTools.createNamespace("test", "desc"), containsString("disabled"));
        assertThat(namespaceTools.listDomains(), containsString("disabled"));
        verifyNoInteractions(namespaceStore);
        verifyNoInteractions(domainStore);
    }
}
