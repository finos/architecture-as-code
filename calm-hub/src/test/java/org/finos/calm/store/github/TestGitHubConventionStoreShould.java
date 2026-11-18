package org.finos.calm.store.github;

import org.finos.calm.domain.conventions.ConventionDefault;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.CreateConventionRequest;
import org.finos.calm.domain.exception.ConventionNotFoundException;
import org.finos.calm.domain.exception.ConventionVersionNotFoundException;
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
class TestGitHubConventionStoreShould {

    private static final ConventionType C4 = ConventionType.C4_MAPPING;
    private static final String SHA = "abc1234";
    private static final RegistryEntry ACME = entry("acme", "conventions/c4-mapping/acme.json");
    private static final RegistryEntry DEFAULT = entry("org-default", "conventions/c4-mapping/default.json");
    private static final RegistryEntry OTHER_TYPE = entry("theme", "conventions/theme/theme.json");

    @Mock
    private ResourceRegistry registryService;
    @Mock
    private GitHubCloneManager cloneManager;
    @Mock
    private GitHubFileHistoryClient versionService;
    @Mock
    private NamespaceFileReader fileReader;

    private GitHubConventionStore store;

    @BeforeEach
    void setup() {
        store = new GitHubConventionStore(registryService, cloneManager, versionService, fileReader);
        when(registryService.getSnapshot()).thenReturn(new RegistrySnapshot(Map.of("finos", List.of()), Map.of()));
        when(registryService.listByType("finos", RegistryResourceType.CONVENTION)).thenReturn(List.of(ACME, DEFAULT, OTHER_TYPE));
        when(cloneManager.headSha("finos")).thenReturn(SHA);
    }

    @Test
    void list_only_the_conventions_of_the_requested_type() throws Exception {
        assertThat(store.getConventionsForNamespace("finos", C4).stream().map(s -> s.getName()).toList(),
                contains("acme", "org-default"));
    }

    @Test
    void read_a_convention_at_the_head_sha() throws Exception {
        when(fileReader.readContained("finos", ACME.filePath())).thenReturn("{\"unique-id\":\"acme\"}");

        assertThat(store.getConventionVersions("finos", C4, id(ACME)), contains(SHA));
        assertThat(store.getConventionForVersion("finos", C4, id(ACME), SHA), is("{\"unique-id\":\"acme\"}"));
    }

    @Test
    void report_a_missing_namespace_convention_or_version() throws Exception {
        when(fileReader.readContained("finos", ACME.filePath())).thenThrow(new IOException("gone"));

        assertThrows(NamespaceNotFoundException.class, () -> store.getConventionsForNamespace("nope", C4));
        assertThrows(ConventionNotFoundException.class, () -> store.getConventionVersions("finos", C4, id(OTHER_TYPE)));
        assertThrows(ConventionVersionNotFoundException.class, () -> store.getConventionForVersion("finos", C4, id(ACME), "1.0.0"));
        assertThrows(ConventionVersionNotFoundException.class, () -> store.getConventionForVersion("finos", C4, id(ACME), SHA));
    }

    @Test
    void use_default_json_as_the_namespace_default_at_the_head_sha() {
        assertThat(store.getDefault("finos", C4), is(Optional.of(new ConventionDefault("c4-mapping", "finos", id(DEFAULT), SHA))));

        when(registryService.listByType("finos", RegistryResourceType.CONVENTION)).thenReturn(List.of(ACME));
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));

        when(cloneManager.headSha("finos")).thenReturn(null);
        assertThat(store.getDefault("finos", C4).isPresent(), is(false));
    }

    @Test
    void read_default_json_as_the_default_when_another_file_has_the_same_unique_id() throws Exception {
        RegistryEntry copy = entry("acme", "conventions/c4-mapping/default.json");
        when(registryService.listByType("finos", RegistryResourceType.CONVENTION)).thenReturn(List.of(ACME, copy));
        when(fileReader.readContained("finos", ACME.filePath())).thenReturn("{\"unique-id\":\"acme\",\"nesting\":\"demote\"}");
        when(fileReader.readContained("finos", copy.filePath())).thenReturn("{\"unique-id\":\"acme\",\"nesting\":\"strict\"}");

        ConventionDefault conventionDefault = store.getDefault("finos", C4).orElseThrow();

        assertThat(store.readDefault("finos", C4, conventionDefault), is("{\"unique-id\":\"acme\",\"nesting\":\"strict\"}"));
    }

    @Test
    void report_a_missing_default_json_or_namespace_when_reading_the_default() {
        ConventionDefault conventionDefault = new ConventionDefault("c4-mapping", "finos", id(ACME), SHA);
        when(registryService.listByType("finos", RegistryResourceType.CONVENTION)).thenReturn(List.of(ACME));

        assertThrows(ConventionNotFoundException.class, () -> store.readDefault("finos", C4, conventionDefault));
        assertThrows(NamespaceNotFoundException.class, () -> store.readDefault("nope", C4, conventionDefault));
    }

    @Test
    void report_content_only_when_the_namespace_has_convention_files() {
        when(registryService.listByType("empty", RegistryResourceType.CONVENTION)).thenReturn(List.of());

        assertThat(store.hasContent("finos"), is(true));
        assertThat(store.hasContent("empty"), is(false));
    }

    @Test
    void refuse_every_write() {
        CreateConventionRequest request = new CreateConventionRequest("a", null, "{}");
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createConventionForNamespace(request, "finos", C4));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.createConventionForVersion(request, "finos", C4, 1, "1.0.1"));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.setDefault("finos", C4, 1, SHA));
        assertThrows(GitHubWriteNotSupportedException.class, () -> store.deleteDefault("finos", C4));
    }

    private static RegistryEntry entry(String uniqueId, String path) {
        return new RegistryEntry(uniqueId, Path.of(path), RegistryResourceType.CONVENTION, uniqueId, Instant.EPOCH);
    }

    private static int id(RegistryEntry entry) {
        return entry.uniqueId().hashCode() & 0x7FFFFFFF;
    }
}
