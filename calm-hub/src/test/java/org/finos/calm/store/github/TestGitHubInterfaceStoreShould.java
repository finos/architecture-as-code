package org.finos.calm.store.github;

import org.finos.calm.domain.exception.InterfaceNotFoundException;
import org.finos.calm.domain.exception.InterfaceVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
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
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubInterfaceStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubInterfaceStore store;

    @BeforeEach
    void setup() {
        store = new GitHubInterfaceStore(registryService);
    }

    @Test
    void return_empty_interfaces_for_namespace() throws NamespaceNotFoundException {
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of()),
                Map.of(),
                Map.of()
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of());

        List<NamespaceInterfaceSummary> result = store.getInterfacesForNamespace("finos");

        assertThat(result, is(empty()));
    }

    @Test
    void return_interfaces_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

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
    void return_versions_list_for_existing_interface() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getInterfaceVersions("finos", hashId);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("latest"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(mockVersionService.getFileVersions("finos/architecture-as-code", "interfaces/payment-api.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        List<String> versions = store.getInterfaceVersions("finos", hashId);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_interface_content_for_version(@TempDir Path tempDir) throws Exception {
        Path ifaceDir = tempDir.resolve("finos/interfaces");
        Files.createDirectories(ifaceDir);
        Files.writeString(ifaceDir.resolve("payment-api.json"), "{\"operations\":[]}");

        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

        store.cloneDirectory = tempDir.toString();
        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);

        String content = store.getInterfaceForVersion("finos", hashId, "1.0.0");
        assertThat(content, equalTo("{\"operations\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

        GitHubCloneManager mockCloneManager = Mockito.mock(GitHubCloneManager.class);
        GitHubVersionService mockVersionService = Mockito.mock(GitHubVersionService.class);
        store.cloneManager = mockCloneManager;
        store.versionService = mockVersionService;

        when(mockCloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(mockVersionService.getFileAtVersion("finos/repo", "interfaces/payment-api.json", "abc1234"))
                .thenReturn("{\"operations\":[{\"name\":\"old\"}]}");

        int hashId = ("payment-api".hashCode() & 0x7FFFFFFF);
        String content = store.getInterfaceForVersion("finos", hashId, "abc1234");

        assertThat(content, equalTo("{\"operations\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_interface_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("payment-api", Path.of("interfaces/payment-api.json"),
                CalmResourceType.INTERFACE, "Payment API", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-api", entry),
                Map.of(CalmResourceType.INTERFACE, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.INTERFACE)).thenReturn(List.of(entry));

        assertThrows(InterfaceNotFoundException.class, () -> store.getInterfaceVersions("finos", 99999));
    }

    @Test
    void throw_unsupported_on_create_interface_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createInterfaceForVersion(new CreateInterfaceRequest(), "finos", 1, "1.0.0"));
    }
}
