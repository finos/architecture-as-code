package org.finos.calm.store.github;

import org.finos.calm.store.github.access.NamespaceFileReader;
import org.finos.calm.store.github.api.GitHubFileHistoryClient;
import org.finos.calm.store.github.registry.RegistryEntry;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.sync.GitHubCloneManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestAbstractReadOnlyGitHubStoreShould {

    private static final String NAMESPACE = "finos";
    private static final RegistryEntry ENTRY = new RegistryEntry(
            "my-pattern", Path.of("patterns/my-pattern.json"), RegistryResourceType.PATTERN, "My Pattern", Instant.now());

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    // A minimal concrete subclass - AbstractReadOnlyGitHubStore is package-private and
    // abstract, so this is the only way to exercise its shared logic directly rather than
    // only indirectly through every store that extends it.
    private static final class TestStore extends AbstractReadOnlyGitHubStore {
        TestStore(ResourceRegistry registryService, GitHubCloneManager cloneManager,
                  GitHubFileHistoryClient versionService, NamespaceFileReader fileReader) {
            super(registryService, cloneManager, versionService, fileReader);
        }

        // Exercises the no-arg CDI proxy constructor directly - see
        // AbstractGitHubStore.AbstractGitHubStore() for why it exists.
        TestStore() {
            super();
        }
    }

    private TestStore store;

    @BeforeEach
    void setup() {
        store = new TestStore(registryService, cloneManager, versionService, fileReader);
    }

    @Test
    void leave_every_collaborator_null_when_built_through_the_cdi_proxy_constructor() {
        TestStore proxyShell = new TestStore();

        assertThat(proxyShell.registryService, is(nullValue()));
        assertThat(proxyShell.cloneManager, is(nullValue()));
        assertThat(proxyShell.versionService, is(nullValue()));
        assertThat(proxyShell.fileReader, is(nullValue()));
    }

    @Test
    void find_an_entry_by_its_hashed_id() {
        int id = "my-pattern".hashCode() & 0x7FFFFFFF;
        when(registryService.listByType(NAMESPACE, RegistryResourceType.PATTERN)).thenReturn(List.of(ENTRY));

        Optional<RegistryEntry> found = store.findEntry(NAMESPACE, RegistryResourceType.PATTERN, id);

        assertThat(found.isPresent(), is(true));
        assertThat(found.get(), equalTo(ENTRY));
    }

    @Test
    void return_empty_when_no_entry_matches_the_id() {
        when(registryService.listByType(NAMESPACE, RegistryResourceType.PATTERN)).thenReturn(List.of(ENTRY));

        Optional<RegistryEntry> found = store.findEntry(NAMESPACE, RegistryResourceType.PATTERN, 99999);

        assertThat(found.isPresent(), is(false));
    }

    @Test
    void return_versions_from_the_api_when_available() {
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("org/repo");
        when(cloneManager.getBranchForNamespace(NAMESPACE)).thenReturn("main");
        when(versionService.getFileVersions("org/repo", "main", "patterns/my-pattern.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        List<String> versions = store.getVersions(NAMESPACE, ENTRY);

        assertThat(versions, contains("abc1234", "def5678"));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() {
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("org/repo");
        when(cloneManager.getBranchForNamespace(NAMESPACE)).thenReturn("main");
        when(versionService.getFileVersions("org/repo", "main", "patterns/my-pattern.json")).thenReturn(List.of());
        when(cloneManager.headSha(NAMESPACE)).thenReturn("1234567");

        List<String> versions = store.getVersions(NAMESPACE, ENTRY);

        assertThat(versions, contains("1234567"));
    }

    @Test
    void return_an_empty_version_list_when_neither_the_api_nor_the_local_clone_have_anything() {
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(null);
        when(cloneManager.getBranchForNamespace(NAMESPACE)).thenReturn(null);
        when(cloneManager.headSha(NAMESPACE)).thenReturn(null);

        List<String> versions = store.getVersions(NAMESPACE, ENTRY);

        assertThat(versions, is(empty()));
    }

    @Test
    void return_empty_when_the_requested_version_is_not_sha_shaped() throws Exception {
        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "1.0.0");

        assertThat(content.isPresent(), is(false));
    }

    @Test
    void return_empty_for_a_null_version() throws Exception {
        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, null);

        assertThat(content.isPresent(), is(false));
    }

    @Test
    void read_from_the_local_clone_when_the_requested_version_is_the_current_head() throws Exception {
        when(cloneManager.headSha(NAMESPACE)).thenReturn("abc1234");
        when(fileReader.readContained(NAMESPACE, ENTRY.filePath())).thenReturn("{\"content\":\"local\"}");

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "abc1234");

        assertThat(content, equalTo(Optional.of("{\"content\":\"local\"}")));
    }

    @Test
    void fetch_from_the_api_when_the_requested_version_is_not_the_current_head() throws Exception {
        when(cloneManager.headSha(NAMESPACE)).thenReturn("1111111");
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("org/repo");
        when(versionService.getFileAtVersion("org/repo", "patterns/my-pattern.json", "2222222"))
                .thenReturn("{\"content\":\"old\"}");

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "2222222");

        assertThat(content, equalTo(Optional.of("{\"content\":\"old\"}")));
    }

    @Test
    void return_empty_when_the_repo_cannot_be_resolved_for_an_api_fetch() throws Exception {
        when(cloneManager.headSha(NAMESPACE)).thenReturn("1111111");
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn(null);

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "2222222");

        assertThat(content.isPresent(), is(false));
    }

    @Test
    void return_empty_when_the_api_cannot_resolve_the_requested_sha() throws Exception {
        when(cloneManager.headSha(NAMESPACE)).thenReturn("1111111");
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("org/repo");
        when(versionService.getFileAtVersion("org/repo", "patterns/my-pattern.json", "2222222")).thenReturn(null);

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "2222222");

        assertThat(content.isPresent(), is(false));
    }

    @Test
    void read_a_local_override_path_when_the_requested_version_is_the_current_head() throws Exception {
        Path mdSibling = Path.of("patterns/my-pattern.md");
        when(cloneManager.headSha(NAMESPACE)).thenReturn("abc1234");
        when(fileReader.readContained(NAMESPACE, mdSibling)).thenReturn("# Markdown sibling");

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "abc1234", mdSibling);

        assertThat(content, equalTo(Optional.of("# Markdown sibling")));
    }

    @Test
    void still_target_the_entry_path_for_an_api_fetch_even_with_a_local_override() throws Exception {
        Path mdSibling = Path.of("patterns/my-pattern.md");
        when(cloneManager.headSha(NAMESPACE)).thenReturn("1111111");
        when(cloneManager.getRepoForNamespace(NAMESPACE)).thenReturn("org/repo");
        when(versionService.getFileAtVersion("org/repo", "patterns/my-pattern.json", "2222222"))
                .thenReturn("{\"content\":\"old\"}");

        Optional<String> content = store.readAtVersion(NAMESPACE, ENTRY, "2222222", mdSibling);

        assertThat(content, equalTo(Optional.of("{\"content\":\"old\"}")));
    }
}
