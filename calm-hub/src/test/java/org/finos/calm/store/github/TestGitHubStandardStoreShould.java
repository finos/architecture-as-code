package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.config.GitHubStoreConfig;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistrySnapshot;
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
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubStandardStoreShould {

    @Mock
    private ResourceRegistry registryService;

    private GitHubStandardStore store;

    @BeforeEach
    void setup() {
        store = new GitHubStandardStore(registryService);
    }

    @Test
    void return_standards_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("naming-convention", Path.of("standards/naming-convention.json"),
                RegistryResourceType.STANDARD, "Naming Convention", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:naming-convention", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getStandardsForNamespace("finos");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Naming Convention"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardsForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_standard() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createStandardForNamespace(new CreateStandardRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_delete_standard() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteStandard("finos", 1));
    }

    @Test
    void throw_standard_not_found_when_id_does_not_match() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("std-x", java.nio.file.Path.of("standards/x.json"),
                RegistryResourceType.STANDARD, "X", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:std-x", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        assertThrows(org.finos.calm.domain.exception.StandardNotFoundException.class,
                () -> store.getStandardVersions("finos", 99999));
    }

    @Test
    void throw_namespace_not_found_on_get_standard_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardVersions("nonexistent", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_standard_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getStandardForVersion("nonexistent", 1, "latest"));
    }

    @Test
    void return_versions_for_existing_standard() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", java.nio.file.Path.of("standards/std.json"),
                RegistryResourceType.STANDARD, "Std", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:std-1", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        int hashId = ("std-1".hashCode() & 0x7FFFFFFF);
        java.util.List<String> versions = store.getStandardVersions("finos", hashId);
        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_content_for_standard(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        java.nio.file.Path stdDir = tempDir.resolve("finos/standards");
        java.nio.file.Files.createDirectories(stdDir);
        java.nio.file.Files.writeString(stdDir.resolve("test.json"), "{\"name\":\"Test Standard\"}");

        RegistryEntry entry = new RegistryEntry("test-std", java.nio.file.Path.of("standards/test.json"),
                RegistryResourceType.STANDARD, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        store.fileReader = new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com"));
        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);
        String content = store.getStandardForVersion("finos", hashId, "latest");
        assertThat(content, equalTo("{\"name\":\"Test Standard\"}"));
    }

    @Test
    void prefer_md_sibling_over_json(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        java.nio.file.Path stdDir = tempDir.resolve("finos/standards");
        java.nio.file.Files.createDirectories(stdDir);
        java.nio.file.Files.writeString(stdDir.resolve("policy.guideline.json"), "{\"nodes\":[]}");
        java.nio.file.Files.writeString(stdDir.resolve("policy.md"), "# Policy\n\nContent here.");

        RegistryEntry entry = new RegistryEntry("policy", java.nio.file.Path.of("standards/policy.guideline.json"),
                RegistryResourceType.STANDARD, "Policy", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:policy", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        store.fileReader = new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com"));
        int hashId = ("policy".hashCode() & 0x7FFFFFFF);
        String content = store.getStandardForVersion("finos", hashId, "latest");
        assertThat(content, org.hamcrest.Matchers.startsWith("# Policy"));
    }

    @Test
    void throw_unsupported_on_create_standard_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createStandardForVersion(new CreateStandardRequest(), "finos", 1, "1.0.0"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", java.nio.file.Path.of("standards/std.json"),
                RegistryResourceType.STANDARD, "Std", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:std-1", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        org.finos.calm.store.github.util.GitHubCloneManager mockCloneManager = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubCloneManager.class);
        org.finos.calm.store.github.api.GitHubFileHistoryClient mockVersionService = org.mockito.Mockito.mock(org.finos.calm.store.github.api.GitHubFileHistoryClient.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockCloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(mockVersionService.getFileVersions("finos/repo", "main", "standards/std.json"))
                .thenReturn(java.util.List.of("abc1234", "def5678"));

        int hashId = ("std-1".hashCode() & 0x7FFFFFFF);
        java.util.List<String> versions = store.getStandardVersions("finos", hashId);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-std", java.nio.file.Path.of("standards/test.json"),
                RegistryResourceType.STANDARD, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        org.finos.calm.store.github.util.GitHubCloneManager mockCloneManager = org.mockito.Mockito.mock(org.finos.calm.store.github.util.GitHubCloneManager.class);
        org.finos.calm.store.github.api.GitHubFileHistoryClient mockVersionService = org.mockito.Mockito.mock(org.finos.calm.store.github.api.GitHubFileHistoryClient.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "standards/test.json", "abc1234"))
                .thenReturn("{\"name\":\"Old Standard\"}");

        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);
        String content = store.getStandardForVersion("finos", hashId, "abc1234");

        assertThat(content, equalTo("{\"name\":\"Old Standard\"}"));
    }

    @Test
    void throw_standard_version_not_found_when_file_missing(@org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("test-std", java.nio.file.Path.of("standards/nonexistent.json"),
                RegistryResourceType.STANDARD, "Test", java.time.Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                java.util.Map.of("finos", java.util.List.of(entry)),
                java.util.Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(java.util.List.of(entry));

        store.fileReader = new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com"));
        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);

        assertThrows(org.finos.calm.domain.exception.StandardVersionNotFoundException.class,
                () -> store.getStandardForVersion("finos", hashId, "1.0.0"));
    }
}
