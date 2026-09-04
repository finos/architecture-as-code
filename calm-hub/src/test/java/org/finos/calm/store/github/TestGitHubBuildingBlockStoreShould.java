package org.finos.calm.store.github;

import org.finos.calm.domain.exception.BuildingBlockNotFoundException;
import org.finos.calm.domain.exception.BuildingBlockVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubBuildingBlockStoreShould {

    private static final String NAMESPACE = "finos";
    private static final String UNIQUE_ID = "my-building-block";
    private static final int HASH_ID = UNIQUE_ID.hashCode() & 0x7FFFFFFF;

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubBuildingBlockStore store;

    @BeforeEach
    void setup() {
        store = new GitHubBuildingBlockStore(registryService);
    }

    @Test
    void return_building_blocks_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/my-building-block.json"),
                CalmResourceType.BUILDING_BLOCK, "My Building Block", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getBuildingBlocksForNamespace(NAMESPACE);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("My Building Block"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing_on_get() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getBuildingBlocksForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_building_block() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createBuildingBlockForNamespace(NAMESPACE, "{}"));
    }

    @Test
    void throw_namespace_not_found_on_get_building_block_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getBuildingBlockVersions("nonexistent", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_building_block_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getBuildingBlockForVersion("nonexistent", 1, "1.0.0"));
    }

    @Test
    void return_versions_list_for_existing_building_block() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/test.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        List<String> versions = store.getBuildingBlockVersions(NAMESPACE, HASH_ID);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/test.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("finos/architecture-as-code");
        when(mockVersionService.getFileVersions("finos/architecture-as-code", "building-blocks/test.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        List<String> versions = store.getBuildingBlockVersions(NAMESPACE, HASH_ID);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_building_block_content_for_version(@TempDir Path tempDir) throws Exception {
        Path bbDir = tempDir.resolve("finos/building-blocks");
        Files.createDirectories(bbDir);
        Files.writeString(bbDir.resolve("test.json"), "{\"nodes\":[],\"relationships\":[]}");

        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/test.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();
        String content = store.getBuildingBlockForVersion(NAMESPACE, HASH_ID, "1.0.0");

        assertThat(content, equalTo("{\"nodes\":[],\"relationships\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/test.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "building-blocks/test.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        String content = store.getBuildingBlockForVersion(NAMESPACE, HASH_ID, "abc1234");

        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_building_block_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/test.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        assertThrows(BuildingBlockNotFoundException.class,
                () -> store.getBuildingBlockVersions(NAMESPACE, 99999));
    }

    @Test
    void throw_unsupported_on_create_building_block_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createBuildingBlockForVersion(NAMESPACE, 1, "1.0.0", "{}"));
    }

    @Test
    void throw_building_block_version_not_found_when_file_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry(UNIQUE_ID, Path.of("building-blocks/nonexistent.json"),
                CalmResourceType.BUILDING_BLOCK, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of(NAMESPACE, List.of(entry)),
                Map.of(NAMESPACE + ":" + UNIQUE_ID, entry),
                Map.of(CalmResourceType.BUILDING_BLOCK, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType(NAMESPACE, CalmResourceType.BUILDING_BLOCK)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();

        assertThrows(BuildingBlockVersionNotFoundException.class,
                () -> store.getBuildingBlockForVersion(NAMESPACE, HASH_ID, "1.0.0"));
    }
}
