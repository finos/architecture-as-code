package org.finos.calm.store.github;

import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
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
class TestGitHubArchitectureStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubArchitectureStore store;

    @BeforeEach
    void setup() {
        store = new GitHubArchitectureStore(registryService, cloneManager, versionService, fileReader);
    }

    @Test
    void return_architectures_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("my-arch", Path.of("architectures/my-arch.json"),
                RegistryResourceType.ARCHITECTURE, "My Architecture", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:my-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

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
    void throw_unsupported_on_delete_architecture() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteArchitecture("finos", 1));
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
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getArchitectureVersions(arch);

        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getArchitectureVersions(arch);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("finos/architecture-as-code", "main", "architectures/test.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getArchitectureVersions(arch);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_architecture_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path archDir = tempDir.resolve("finos/architectures");
        Files.createDirectories(archDir);
        Files.writeString(archDir.resolve("test.json"), "{\"nodes\":[],\"relationships\":[]}");

        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubArchitectureStore realFileReaderStore = new GitHubArchitectureStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        String content = realFileReaderStore.getArchitectureForVersion(arch);
        assertThat(content, equalTo("{\"nodes\":[],\"relationships\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "architectures/test.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getArchitectureForVersion(arch);

        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        assertThrows(ArchitectureVersionNotFoundException.class, () -> store.getArchitectureForVersion(arch));
    }

    @Test
    void throw_version_not_found_when_the_local_file_is_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/nonexistent.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubArchitectureStore realFileReaderStore = new GitHubArchitectureStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("test-arch".hashCode() & 0x7FFFFFFF);
        Architecture arch = new Architecture.ArchitectureBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        assertThrows(ArchitectureVersionNotFoundException.class, () -> realFileReaderStore.getArchitectureForVersion(arch));
    }

    @Test
    void throw_architecture_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("test-arch", Path.of("architectures/test.json"),
                RegistryResourceType.ARCHITECTURE, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-arch", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.ARCHITECTURE)).thenReturn(List.of(entry));

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
