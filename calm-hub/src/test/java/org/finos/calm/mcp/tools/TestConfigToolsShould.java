package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.json.Json;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.ResolvedConfigDefault;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.services.ConfigService;
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
class TestConfigToolsShould {

    private static final ConfigType C4 = ConfigType.C4_MAPPING;

    @Mock
    ConfigService configService;

    @InjectMocks
    ConfigTools configTools;

    @BeforeEach
    void setup() {
        configTools.mcpEnabled = true;
    }

    private static String text(ToolResponse response) {
        return ((TextContent) response.firstContent()).text();
    }

    @Test
    void list_configs() throws Exception {
        when(configService.getConfigsForNamespace("finos", C4))
                .thenReturn(List.of(new NamespaceResourceSummary("Acme", "Acme mapping", 3, 1)));

        ToolResponse result = configTools.listConfigs("finos", "c4-mapping");

        assertThat(result.isError(), is(false));
        assertThat(text(result), containsString("Acme"));
        assertThat(text(result), containsString("ID: 3"));
    }

    @Test
    void reject_an_unknown_type_an_invalid_namespace_or_a_disabled_server_without_reading() {
        assertThat(text(configTools.listConfigs("finos", "theme")), containsString("Config types: c4-mapping"));
        assertThat(configTools.getNamespaceDefaultConfig("bad ns", "c4-mapping").isError(), is(true));
        configTools.mcpEnabled = false;
        assertThat(text(configTools.getConfig("finos", "c4-mapping", 1, "1.0.0")), containsString("disabled"));
        verifyNoInteractions(configService);
    }

    @Test
    void list_versions_and_get_a_version() throws Exception {
        when(configService.getConfigVersions("finos", C4, 3)).thenReturn(List.of("1.0.0", "1.1.0"));
        when(configService.getConfigForVersion("finos", C4, 3, "1.1.0")).thenReturn("{\"unique-id\":\"acme\"}");

        assertThat(text(configTools.listConfigVersions("finos", "c4-mapping", 3)), containsString("1.1.0"));
        assertThat(text(configTools.getConfig("finos", "c4-mapping", 3, "1.1.0")), is("{\"unique-id\":\"acme\"}"));
    }

    @Test
    void report_missing_namespaces_configs_and_versions() throws Exception {
        when(configService.getConfigsForNamespace("missing", C4)).thenThrow(new NamespaceNotFoundException());
        when(configService.getConfigVersions("missing", C4, 3)).thenThrow(new NamespaceNotFoundException());
        when(configService.getConfigVersions("finos", C4, 9)).thenThrow(new ConfigNotFoundException());
        when(configService.getConfigForVersion("missing", C4, 3, "1.0.0")).thenThrow(new NamespaceNotFoundException());
        when(configService.getConfigForVersion("finos", C4, 9, "1.0.0")).thenThrow(new ConfigNotFoundException());
        when(configService.getConfigForVersion("finos", C4, 3, "2.0.0")).thenThrow(new ConfigVersionNotFoundException());
        when(configService.resolveDefault("missing", C4)).thenThrow(new NamespaceNotFoundException());

        assertThat(configTools.listConfigs("missing", "c4-mapping").isError(), is(true));
        assertThat(configTools.listConfigVersions("missing", "c4-mapping", 3).isError(), is(true));
        assertThat(configTools.listConfigVersions("finos", "c4-mapping", 9).isError(), is(true));
        assertThat(configTools.getConfig("missing", "c4-mapping", 3, "1.0.0").isError(), is(true));
        assertThat(configTools.getConfig("finos", "c4-mapping", 9, "1.0.0").isError(), is(true));
        assertThat(configTools.getConfig("finos", "c4-mapping", 3, "2.0.0").isError(), is(true));
        assertThat(configTools.getNamespaceDefaultConfig("missing", "c4-mapping").isError(), is(true));
    }

    @Test
    void say_where_an_inherited_default_comes_from_and_include_its_json() throws Exception {
        when(configService.resolveDefault("org.ab", C4)).thenReturn(Optional.of(new ResolvedConfigDefault(
                "c4-mapping", "org", 3, "1.1.0", true, Json.createObjectBuilder().add("unique-id", "acme").build())));

        String result = text(configTools.getNamespaceDefaultConfig("org.ab", "c4-mapping"));

        assertThat(result, containsString("config 3 version 1.1.0, inherited from namespace 'org'"));
        assertThat(result, containsString("\"unique-id\":\"acme\""));
    }

    @Test
    void say_when_the_default_is_set_on_the_namespace_or_when_none_applies() throws Exception {
        when(configService.resolveDefault("org", C4)).thenReturn(Optional.of(new ResolvedConfigDefault(
                "c4-mapping", "org", 3, "1.1.0", false, Json.createObjectBuilder().build())));
        when(configService.resolveDefault("other", C4)).thenReturn(Optional.empty());

        assertThat(text(configTools.getNamespaceDefaultConfig("org", "c4-mapping")), containsString("set on this namespace"));
        assertThat(text(configTools.getNamespaceDefaultConfig("other", "c4-mapping")), containsString("No c4-mapping default"));
    }
}
