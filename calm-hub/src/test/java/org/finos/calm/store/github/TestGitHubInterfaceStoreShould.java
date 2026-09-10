package org.finos.calm.store.github;

import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

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

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestGitHubInterfaceStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubInterfaceStore store;

    @BeforeEach
    void setup() {
        store = new GitHubInterfaceStore(registryService, cloneManager, versionService, fileReader);
    }

    @Test
    void return_empty_interfaces_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of());
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of());

        List<NamespaceInterfaceSummary> result = store.getInterfacesForNamespace("finos");

        assertThat(result, is(empty()));
    }

    @Test
    void return_interfaces_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        List<NamespaceInterfaceSummary> result = store.getInterfacesForNamespace("finos");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Payment API"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getInterfacesForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_interface() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createInterfaceForNamespace(new CreateInterfaceRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_delete_interface() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteInterface("finos", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_interface_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getInterfaceVersions("nonexistent", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_interface_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getInterfaceForVersion("nonexistent", 1, "1.0.0"));
    }

    @Test
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getInterfaceVersions("finos", hashId);

        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getInterfaceVersions("finos", hashId);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("finos/architecture-as-code", "main", "interfaces/payment-api.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getInterfaceVersions("finos", hashId);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_interface_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path ifaceDir = tempDir.resolve("finos/interfaces");
        Files.createDirectories(ifaceDir);
        Files.writeString(ifaceDir.resolve("payment-api.json"), "{\"operations\":[]}");

        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubInterfaceStore realFileReaderStore = new GitHubInterfaceStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);

        String content = realFileReaderStore.getInterfaceForVersion("finos", hashId, "abc1234");
        assertThat(content, equalTo("{\"operations\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "interfaces/payment-api.json", "abc1234"))
                .thenReturn("{\"operations\":[{\"name\":\"old\"}]}");

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        String content = store.getInterfaceForVersion("finos", hashId, "abc1234");

        assertThat(content, equalTo("{\"operations\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);

        assertThrows(InterfaceVersionNotFoundException.class,
                () -> store.getInterfaceForVersion("finos", hashId, "1.0.0"));
    }

    @Test
    void throw_version_not_found_when_the_local_file_is_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/nonexistent.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubInterfaceStore realFileReaderStore = new GitHubInterfaceStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);

        assertThrows(InterfaceVersionNotFoundException.class,
                () -> realFileReaderStore.getInterfaceForVersion("finos", hashId, "abc1234"));
    }

    @Test
    void throw_interface_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                RegistryResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.INTERFACE)).thenReturn(List.of(entry));

        assertThrows(InterfaceNotFoundException.class, () -> store.getInterfaceVersions("finos", 99999));
    }

    @Test
    void throw_unsupported_on_create_interface_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createInterfaceForVersion(new CreateInterfaceRequest(), "finos", 1, "1.0.0"));
    }
}
