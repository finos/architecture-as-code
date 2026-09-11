package org.finos.calm.store.github;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
import org.finos.calm.domain.standards.CreateStandardRequest;
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
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubStandardStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubStandardStore store;

    @BeforeEach
    void setup() {
        store = new GitHubStandardStore(registryService, cloneManager, versionService, fileReader);
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
        RegistryEntry entry = new RegistryEntry("std-x", Path.of("standards/x.json"),
                RegistryResourceType.STANDARD, "X", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:std-x", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        assertThrows(StandardNotFoundException.class,
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
                () -> store.getStandardForVersion("nonexistent", 1, "abc1234"));
    }

    @Test
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", Path.of("standards/std.json"),
                RegistryResourceType.STANDARD, "Std", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:std-1", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        int hashId = ("std-1".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getStandardVersions("finos", hashId);
        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", Path.of("standards/std.json"),
                RegistryResourceType.STANDARD, "Std", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:std-1", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        int hashId = ("std-1".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getStandardVersions("finos", hashId);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path stdDir = tempDir.resolve("finos/standards");
        Files.createDirectories(stdDir);
        Files.writeString(stdDir.resolve("test.json"), "{\"name\":\"Test Standard\"}");

        RegistryEntry entry = new RegistryEntry("test-std", Path.of("standards/test.json"),
                RegistryResourceType.STANDARD, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubStandardStore realFileReaderStore = new GitHubStandardStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);
        String content = realFileReaderStore.getStandardForVersion("finos", hashId, "abc1234");
        assertThat(content, equalTo("{\"name\":\"Test Standard\"}"));
    }

    @Test
    void prefer_md_sibling_over_json(@TempDir Path tempDir) throws Exception {
        Path stdDir = tempDir.resolve("finos/standards");
        Files.createDirectories(stdDir);
        Files.writeString(stdDir.resolve("policy.guideline.json"), "{\"nodes\":[]}");
        Files.writeString(stdDir.resolve("policy.md"), "# Policy\n\nContent here.");

        RegistryEntry entry = new RegistryEntry("policy", Path.of("standards/policy.guideline.json"),
                RegistryResourceType.STANDARD, "Policy", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:policy", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubStandardStore realFileReaderStore = new GitHubStandardStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("policy".hashCode() & 0x7FFFFFFF);
        String content = realFileReaderStore.getStandardForVersion("finos", hashId, "abc1234");
        assertThat(content, startsWith("# Policy"));
    }

    @Test
    void ignore_md_sibling_preference_when_fetching_a_pinned_sha_from_the_api(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("policy", Path.of("standards/policy.guideline.json"),
                RegistryResourceType.STANDARD, "Policy", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:policy", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "standards/policy.guideline.json", "abc1234"))
                .thenReturn("{\"nodes\":[{\"name\":\"old\"}]}");

        int hashId = ("policy".hashCode() & 0x7FFFFFFF);
        String content = store.getStandardForVersion("finos", hashId, "abc1234");
        assertThat(content, equalTo("{\"nodes\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_unsupported_on_create_standard_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createStandardForVersion(new CreateStandardRequest(), "finos", 1, "1.0.0"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("std-1", Path.of("standards/std.json"),
                RegistryResourceType.STANDARD, "Std", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:std-1", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("finos/repo", "main", "standards/std.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("std-1".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getStandardVersions("finos", hashId);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-std", Path.of("standards/test.json"),
                RegistryResourceType.STANDARD, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "standards/test.json", "abc1234"))
                .thenReturn("{\"name\":\"Old Standard\"}");

        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);
        String content = store.getStandardForVersion("finos", hashId, "abc1234");

        assertThat(content, equalTo("{\"name\":\"Old Standard\"}"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry("test-std", Path.of("standards/test.json"),
                RegistryResourceType.STANDARD, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);

        assertThrows(StandardVersionNotFoundException.class,
                () -> store.getStandardForVersion("finos", hashId, "1.0.0"));
    }

    @Test
    void throw_standard_version_not_found_when_file_missing() throws Exception {
        RegistryEntry entry = new RegistryEntry("test-std", Path.of("standards/nonexistent.json"),
                RegistryResourceType.STANDARD, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "standards/nonexistent.json", "abc1234"))
                .thenReturn(null);

        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);

        assertThrows(StandardVersionNotFoundException.class,
                () -> store.getStandardForVersion("finos", hashId, "abc1234"));
    }

    @Test
    void throw_standard_version_not_found_when_the_local_head_file_is_missing_on_disk(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("test-std", Path.of("standards/nonexistent.json"),
                RegistryResourceType.STANDARD, "Test", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:test-std", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubStandardStore realFileReaderStore = new GitHubStandardStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("test-std".hashCode() & 0x7FFFFFFF);

        assertThrows(StandardVersionNotFoundException.class,
                () -> realFileReaderStore.getStandardForVersion("finos", hashId, "abc1234"));
    }

    @Test
    void leave_a_non_json_entry_path_unchanged_when_checking_for_a_markdown_sibling(@TempDir Path tempDir) throws Exception {
        Path stdDir = tempDir.resolve("finos/standards");
        Files.createDirectories(stdDir);
        Files.writeString(stdDir.resolve("already-markdown.md"), "# Already markdown");

        RegistryEntry entry = new RegistryEntry("already-markdown", Path.of("standards/already-markdown.md"),
                RegistryResourceType.STANDARD, "Already Markdown", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:already-markdown", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.STANDARD)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubStandardStore realFileReaderStore = new GitHubStandardStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("already-markdown".hashCode() & 0x7FFFFFFF);

        String content = realFileReaderStore.getStandardForVersion("finos", hashId, "abc1234");
        assertThat(content, equalTo("# Already markdown"));
    }
}
