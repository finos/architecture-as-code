package org.finos.calm.store.github;

import org.finos.calm.domain.configs.ConfigDefault;
import org.finos.calm.domain.configs.ConfigType;
import org.finos.calm.domain.configs.CreateConfigRequest;
import org.finos.calm.domain.exception.ConfigNotFoundException;
import org.finos.calm.domain.exception.ConfigVersionNotFoundException;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestGitHubConfigStoreShould {

    private static final ConfigType C4 = ConfigType.C4_MAPPING;
    private static final String SHA = "abc1234";
    private static final RegistryEntry ACME = entry("acme", "configs/c4-mapping/acme.json");
    private static final RegistryEntry DEFAULT = entry("org-default", "configs/c4-mapping/default.json");
    private static final RegistryEntry OTHER_TYPE = entry("theme", "configs/theme/theme.json");

    @Mock
    private ResourceRegistry registryService;
    @Mock
    private GitHubCloneManager cloneManager;
    @Mock
    private GitHubFileHistoryClient versionService;
    @Mock
    private NamespaceFileReader fileReader;

    private GitHubConfigStore store;

    @BeforeEach
    void setup() {
        store = new GitHubConfigStore(registryService, cloneManager, versionService, fileReader);
        when(registryService.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of("finos", List.of()), Map.of()));
        when(registryService.listByType("finos", RegistryResourceType.CONFIG)).thenReturn(List.of(ACME, DEFAULT, OTHER_TYPE));
        when(cloneManager.headSha("finos")).thenReturn(SHA);
    }

    @Test
    void list_only_the_configs_of_the_requested_type() throws Exception {
        assertThat(store.getConfigsForNamespace("finos", C4).stream().map(s -> s.getName()).toList(),
                contains("acme", "org-default"));
    }

    @Test
    void read_a_config_at_the_head_sha() throws Exception {
        when(fileReader.readContained("finos", ACME.filePath())).thenReturn("{\"unique-id\":\"acme\"}");

        assertThat(store.getConfigVersions("finos", C4, id(ACME)), contains(SHA));
        assertThat(store.getConfigForVersion("finos", C4, id(ACME), SHA), is("{\"unique-id\":\"acme\"}"));
    }

    @Test
    void report_a_missing_namespace_config_or_version() throws Exception {
        when(fileReader.readContained("finos", ACME.filePath())).thenThrow(new IOException("gone"));

        assertThrows(NamespaceNotFoundException.class, () -> store.getConfigsForNamespace("nope", C4));
        assertThrows(ConfigNotFoundException.class, () -> store.getConfigVersions("finos", C4, id(OTHER_TYPE)));
        assertThrows(ConfigVersionNotFoundException.class, () -> store.getConfigForVersion("finos", C4, id(ACME), "1.0.0"));
        assertThrows(ConfigVersionNotFoundException.class, () -> store.getConfigForVersion("finos", C4, id(ACME), SHA));
    }

    @Test
    void use_default_json_as_the_namespace_default_at_the_head_sha() {
        assertThat(store.getDefault("finos", C4), is(Optional.of(new ConfigDefault("c4-mapping", "finos", id(DEFAULT), SHA))));

        when(registryService.listByType("finos", RegistryResourceType.CONFIG)).thenReturn(List.of(ACME));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));

        when(cloneManager.headSha("finos")).thenReturn(null);
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
    }

    @Test
    void report_content_only_when_the_namespace_has_config_files() {
        when(registryService.listByType("empty", RegistryResourceType.CONFIG)).thenReturn(List.of());

        assertThat(store.hasContent("finos"), is(true));
        assertThat(store.hasContent("empty"), is(false));
    }

    @Test
    void refuse_every_write() {
        CreateConfigRequest request = new CreateConfigRequest("a", null, "{}");
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createConfigForNamespace(request, "finos", C4));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createConfigForVersion(request, "finos", C4, 1, "1.0.1"));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.setDefault("finos", C4, 1, SHA));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.deleteDefault("finos", C4));
    }

    private static RegistryEntry entry(String uniqueId, String path) {
        return new RegistryEntry(uniqueId, Path.of(path), RegistryResourceType.CONFIG, uniqueId, Instant.EPOCH);
    }

    private static int id(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }
}
