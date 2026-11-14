package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.json.Json;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.services.ConventionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestConventionToolsShould {

    private static final ConventionType C4 = ConventionType.C4_MAPPING;

    @Mock
    ConventionService conventionService;

    @InjectMocks
    ConventionTools conventionTools;

    @BeforeEach
    void setup() {
        conventionTools.mcpEnabled = true;
    }

    private static String text(ToolResponse response) {
        return ((TextContent) response.firstContent()).text();
    }

    @Test
    void list_conventions() throws Exception {
        when(conventionService.getConventionsForNamespace("finos", C4))
                .thenReturn(List.of(new NamespaceResourceSummary("Acme", "Acme mapping", 3, 1)));

        ToolResponse result = conventionTools.listConventions("finos", "c4-mapping");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("Acme"));
        assertThat(text(result), containsString("ID: 3"));
    }

    @Test
    void reject_an_unknown_type_an_invalid_namespace_or_a_disabled_server_without_reading() {
        assertThat(text(conventionTools.listConventions("finos", "theme")), containsString("Convention types: c4-mapping"));
        assertThat(conventionTools.getNamespaceDefaultConvention("bad ns", "c4-mapping").isError(), is(true));
        conventionTools.mcpEnabled = false;
        assertThat(text(conventionTools.getConvention("finos", "c4-mapping", 1, "1.0.0")), containsString("disabled"));
        verifyNoInteractions(conventionService);
    }

    @Test
    void list_versions_and_get_a_version() throws Exception {
        when(conventionService.getConventionVersions("finos", C4, 3)).thenReturn(List.of("1.0.0", "1.1.0"));
        when(conventionService.getConventionForVersion("finos", C4, 3, "1.1.0")).thenReturn("{\"unique-id\":\"acme\"}");

        assertThat(text(conventionTools.listConventionVersions("finos", "c4-mapping", 3)), containsString("1.1.0"));
        assertThat(text(conventionTools.getConvention("finos", "c4-mapping", 3, "1.1.0")), is("{\"unique-id\":\"acme\"}"));
    }

    @Test
    void report_missing_namespaces_conventions_and_versions() throws Exception {
        when(conventionService.getConventionsForNamespace("missing", C4)).thenThrow(new NamespaceNotFoundException());
        when(conventionService.getConventionVersions("missing", C4, 3)).thenThrow(new NamespaceNotFoundException());
        when(conventionService.getConventionVersions("finos", C4, 9)).thenThrow(new ConventionNotFoundException());
        when(conventionService.getConventionForVersion("missing", C4, 3, "1.0.0")).thenThrow(new NamespaceNotFoundException());
        when(conventionService.getConventionForVersion("finos", C4, 9, "1.0.0")).thenThrow(new ConventionNotFoundException());
        when(conventionService.getConventionForVersion("finos", C4, 3, "2.0.0")).thenThrow(new ConventionVersionNotFoundException());
        when(conventionService.resolveDefault("missing", C4)).thenThrow(new NamespaceNotFoundException());

        assertThat(conventionTools.listConventions("missing", "c4-mapping").isError(), is(true));
        assertThat(conventionTools.listConventionVersions("missing", "c4-mapping", 3).isError(), is(true));
        assertThat(conventionTools.listConventionVersions("finos", "c4-mapping", 9).isError(), is(true));
        assertThat(conventionTools.getConvention("missing", "c4-mapping", 3, "1.0.0").isError(), is(true));
        assertThat(conventionTools.getConvention("finos", "c4-mapping", 9, "1.0.0").isError(), is(true));
        assertThat(conventionTools.getConvention("finos", "c4-mapping", 3, "2.0.0").isError(), is(true));
        assertThat(conventionTools.getNamespaceDefaultConvention("missing", "c4-mapping").isError(), is(true));
    }

    @Test
    void say_where_an_inherited_default_comes_from_and_include_its_json() throws Exception {
        when(conventionService.resolveDefault("org.ab", C4)).thenReturn(Optional.of(new ResolvedConventionDefault(
                "c4-mapping", "org", 3, "1.1.0", true, Json.createObjectBuilder().add("unique-id", "acme").build())));

        String result = text(conventionTools.getNamespaceDefaultConvention("org.ab", "c4-mapping"));

        assertThat(result, containsString("convention 3 version 1.1.0, inherited from namespace 'org'"));
        assertThat(result, containsString("\"unique-id\":\"acme\""));
    }

    @Test
    void say_when_the_default_is_set_on_the_namespace_or_when_none_applies() throws Exception {
        when(conventionService.resolveDefault("org", C4)).thenReturn(Optional.of(new ResolvedConventionDefault(
                "c4-mapping", "org", 3, "1.1.0", false, Json.createObjectBuilder().build())));
        when(conventionService.resolveDefault("other", C4)).thenReturn(Optional.empty());

        assertThat(text(conventionTools.getNamespaceDefaultConvention("org", "c4-mapping")), containsString("set on this namespace"));
        assertThat(text(conventionTools.getNamespaceDefaultConvention("other", "c4-mapping")), containsString("No c4-mapping default"));
    }
}
