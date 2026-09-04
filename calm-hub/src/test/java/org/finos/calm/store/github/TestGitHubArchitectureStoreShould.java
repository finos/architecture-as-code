package org.finos.calm.store.github;

import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;
import org.finos.calm.store.github.util.RegistrySnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
class TestGitHubArchitectureStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubArchitectureStore store;

    @BeforeEach
    void setup() {
        store = new GitHubArchitectureStore(registryService);
    }

    @Test
    void return_architectures_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("my-arch", Path.of("architectures/my-arch.json"),
                CalmResourceType.ARCHITECTURE, "My Architecture", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:my-arch", entry),
                Map.of(CalmResourceType.ARCHITECTURE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getArchitecturesForNamespace("finos", PageRequest.UNPAGED);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("My Architecture"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing_on_get() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getArchitecturesForNamespace("nonexistent", PageRequest.UNPAGED));
    }

    @Test
    void throw_unsupported_on_create_architecture() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createArchitectureForNamespace(new Architecture.ArchitectureBuilder().build()));
    }

    @Test
    void throw_namespace_not_found_on_get_architecture_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getArchitectureVersions(new Architecture.ArchitectureBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void throw_namespace_not_found_on_get_architecture_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getArchitectureForVersion(new Architecture.ArchitectureBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void return_versions_list_for_existing_architecture() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", java.nio.file.Path.of("architectures/test.json"),
                CalmResourceType.ARCHITECTURE, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-arch", entry),
                java.util.Map.of(CalmResourceType.ARCHITECTURE, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(java.util.List.of(entry));

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).build();
        java.util.List<String> versions = store.getArchitectureVersions(arch);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", java.nio.file.Path.of("architectures/test.json"),
                CalmResourceType.ARCHITECTURE, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-arch", entry),
                java.util.Map.of(CalmResourceType.ARCHITECTURE, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(java.util.List.of(entry));

        org.finos.calm.store.github.util.GitHubCloneManager mockCloneManager = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubCloneManager.class);
        org.finos.calm.store.github.util.GitHubVersionService mockVersionService = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(mockVersionService.getFileVersions("finos/architecture-as-code", "architectures/test.json"))
                .thenReturn(java.util.List.of("abc1234", "def5678"));

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).build();
        java.util.List<String> versions = store.getArchitectureVersions(arch);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_architecture_content_for_version(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        java.nio.file.Path archDir = tempDir.resolve("finos/architectures");
        java.nio.file.Files.createDirectories(archDir);
        java.nio.file.Files.writeString(archDir.resolve("test.json"), "{\"nodes\":[],\"relationships\":[]}");

        RegistryEntry entry = new RegistryEntry("test-arch", java.nio.file.Path.of("architectures/test.json"),
                CalmResourceType.ARCHITECTURE, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-arch", entry),
                java.util.Map.of(CalmResourceType.ARCHITECTURE, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(java.util.List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        String content = store.getArchitectureForVersion(arch);
        assertThat(content, equalTo("{\"nodes\":[],\"relationships\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", java.nio.file.Path.of("architectures/test.json"),
                CalmResourceType.ARCHITECTURE, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-arch", entry),
                java.util.Map.of(CalmResourceType.ARCHITECTURE, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(java.util.List.of(entry));

        org.finos.calm.store.github.util.GitHubCloneManager mockCloneManager = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubCloneManager.class);
        org.finos.calm.store.github.util.GitHubVersionService mockVersionService = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "architectures/test.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getArchitectureForVersion(arch);

        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_architecture_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("test-arch", java.nio.file.Path.of("architectures/test.json"),
                CalmResourceType.ARCHITECTURE, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-arch", entry),
                java.util.Map.of(CalmResourceType.ARCHITECTURE, java.util.List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.ARCHITECTURE)).thenReturn(java.util.List.of(entry));

        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(99999).build();
        assertThrows(ArchitectureNotFoundException.class, () -> store.getArchitectureVersions(arch));
    }

    @Test
    void throw_unsupported_on_create_architecture_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createArchitectureForVersion(new Architecture.ArchitectureBuilder().build()));
    }

    @Test
    void throw_unsupported_on_update_architecture_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateArchitectureForVersion(new Architecture.ArchitectureBuilder().build()));
    }
}
