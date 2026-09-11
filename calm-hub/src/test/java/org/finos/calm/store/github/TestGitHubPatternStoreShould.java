package org.finos.calm.store.github;

import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubPatternStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubPatternStore store;

    @BeforeEach
    void setup() {
        store = new GitHubPatternStore(registryService, cloneManager, versionService, fileReader);
    }

    @Test
    void return_patterns_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getPatternsForNamespace("finos", PageRequest.UNPAGED);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Event Driven"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getPatternsForNamespace("nonexistent", PageRequest.UNPAGED));
    }

    @Test
    void throw_unsupported_on_create_pattern() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createPatternForNamespace(new CreatePatternRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_delete_pattern() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deletePattern("finos", 1));
    }

    @Test
    void throw_unsupported_on_create_pattern_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createPatternForVersion(new Pattern.PatternBuilder().build()));
    }

    @Test
    void throw_unsupported_on_update_pattern_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updatePatternForVersion(new Pattern.PatternBuilder().build()));
    }

    @Test
    void throw_namespace_not_found_on_get_pattern_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getPatternVersions(new Pattern.PatternBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void throw_namespace_not_found_on_get_pattern_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getPatternForVersion(new Pattern.PatternBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getPatternVersions(pattern);

        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getPatternVersions(pattern);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("finos/architecture-as-code", "main", "patterns/event-driven.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getPatternVersions(pattern);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_pattern_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path patternDir = tempDir.resolve("finos/patterns");
        Files.createDirectories(patternDir);
        Files.writeString(patternDir.resolve("event-driven.json"), "{\"nodes\":[],\"relationships\":[]}");

        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubPatternStore realFileReaderStore = new GitHubPatternStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        String content = realFileReaderStore.getPatternForVersion(pattern);
        assertThat(content, equalTo("{\"nodes\":[],\"relationships\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "patterns/event-driven.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getPatternForVersion(pattern);

        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        assertThrows(PatternVersionNotFoundException.class, () -> store.getPatternForVersion(pattern));
    }

    @Test
    void throw_version_not_found_when_the_local_file_is_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/nonexistent.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubPatternStore realFileReaderStore = new GitHubPatternStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        assertThrows(PatternVersionNotFoundException.class, () -> realFileReaderStore.getPatternForVersion(pattern));
    }

    @Test
    void throw_pattern_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                RegistryResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.PATTERN)).thenReturn(List.of(entry));

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(99999).build();
        assertThrows(PatternNotFoundException.class, () -> store.getPatternVersions(pattern));
    }
}
