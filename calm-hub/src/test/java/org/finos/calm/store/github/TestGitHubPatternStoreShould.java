package org.finos.calm.store.github;

import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.GitHubCloneManager;
import org.finos.calm.store.github.util.GitHubVersionService;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubPatternStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubPatternStore store;

    @BeforeEach
    void setup() {
        store = new GitHubPatternStore(registryService);
    }

    @Test
    void return_patterns_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

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
    void return_versions_list_for_existing_pattern() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getPatternVersions(pattern);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(mockVersionService.getFileVersions("finos/architecture-as-code", "patterns/event-driven.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getPatternVersions(pattern);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_pattern_content_for_version(@TempDir Path tempDir) throws Exception {
        Path patternDir = tempDir.resolve("finos/patterns");
        Files.createDirectories(patternDir);
        Files.writeString(patternDir.resolve("event-driven.json"), "{\"nodes\":[],\"relationships\":[]}");

        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        String content = store.getPatternForVersion(pattern);
        assertThat(content, equalTo("{\"nodes\":[],\"relationships\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "patterns/event-driven.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        int hashId = ("event-driven".hashCode() & 0x7FFFFFFF);
        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getPatternForVersion(pattern);

        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_pattern_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("event-driven", Path.of("patterns/event-driven.json"),
                CalmResourceType.PATTERN, "Event Driven", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:event-driven", entry),
                Map.of(CalmResourceType.PATTERN, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.PATTERN)).thenReturn(List.of(entry));

        Pattern pattern = new Pattern.PatternBuilder().setNamespace("finos").setId(99999).build();
        assertThrows(PatternNotFoundException.class, () -> store.getPatternVersions(pattern));
    }
}
