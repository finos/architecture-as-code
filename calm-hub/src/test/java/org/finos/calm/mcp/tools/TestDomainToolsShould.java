package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.ToolResponse;
import org.finos.calm.domain.Domain;
import org.finos.calm.domain.exception.DomainAlreadyExistsException;
import org.finos.calm.store.DomainStore;
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
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestDomainToolsShould {

    @Mock
    DomainStore domainStore;

    @InjectMocks
    DomainTools domainTools;

    @BeforeEach
    void setup() {
        domainTools.mcpEnabled = true;
    }

    private static String text(ToolResponse r) {
        return r.firstContent().asText().text();
    }

    // --- listDomains ---

    @Test
    void return_domains() {
        when(domainStore.getDomains()).thenReturn(List.of("api-threats", "cloud-security"));

        String result = text(domainTools.listDomains());

        assertThat(result, containsString("api-threats"));
        assertThat(result, containsString("cloud-security"));
    }

    @Test
    void return_no_domains_message() {
        when(domainStore.getDomains()).thenReturn(List.of());

        String result = text(domainTools.listDomains());

        assertThat(result, containsString("No domains found"));
    }

    // --- createDomain ---

    @Test
    void create_domain_successfully() throws DomainAlreadyExistsException {
        when(domainStore.createDomain("security")).thenReturn(new Domain("security"));

        ToolResponse response = domainTools.createDomain("security");

        assertThat(response.isError(), is(false));
        assertThat(text(response), containsString("created successfully"));
        assertThat(text(response), containsString("security"));
    }

    @Test
    void return_error_when_domain_exists() throws DomainAlreadyExistsException {
        when(domainStore.createDomain("existing"))
                .thenThrow(new DomainAlreadyExistsException("existing"));

        ToolResponse response = domainTools.createDomain("existing");

        assertThat(response.isError(), is(true));
        assertThat(text(response), containsString("already exists"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "bad domain", "bad.domain"})
    void reject_invalid_name_for_create_domain(String name) {
        ToolResponse response = domainTools.createDomain(name);

        assertThat(response.isError(), is(true));
        assertThat(text(response), startsWith("Error:"));
        verifyNoInteractions(domainStore);
    }

    // --- MCP disabled ---

    @Test
    void return_disabled_message_when_mcp_is_disabled() {
        domainTools.mcpEnabled = false;

        ToolResponse listDomains = domainTools.listDomains();
        ToolResponse createDomain = domainTools.createDomain("security");

        assertThat(listDomains.isError(), is(true));
        assertThat(text(listDomains), containsString("disabled"));
        assertThat(createDomain.isError(), is(true));
        assertThat(text(createDomain), containsString("disabled"));
        verifyNoInteractions(domainStore);
    }
}
