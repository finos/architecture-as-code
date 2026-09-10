package org.finos.calm.store.github;

import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.FlowNotFoundException;
import org.finos.calm.domain.exception.FlowVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
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
class TestGitHubFlowStoreShould {

    @Mock
    private ResourceRegistry registryService;

    @Mock
    private GitHubCloneManager cloneManager;

    @Mock
    private GitHubFileHistoryClient versionService;

    @Mock
    private NamespaceFileReader fileReader;

    private GitHubFlowStore store;

    @BeforeEach
    void setup() {
        store = new GitHubFlowStore(registryService, cloneManager, versionService, fileReader);
    }

    @Test
    void return_flows_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        List<NamespaceResourceSummary> result = store.getFlowsForNamespace("finos");

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getName(), equalTo("Payment Flow"));
    }

    @Test
    void throw_namespace_not_found_when_namespace_missing() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);

        assertThrows(NamespaceNotFoundException.class,
                () -> store.getFlowsForNamespace("nonexistent"));
    }

    @Test
    void throw_unsupported_on_create_flow() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createFlowForNamespace(new CreateFlowRequest(), "finos"));
    }

    @Test
    void throw_unsupported_on_delete_flow() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.deleteFlow("finos", 1));
    }

    @Test
    void throw_namespace_not_found_on_get_flow_versions() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getFlowVersions(new Flow.FlowBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void throw_namespace_not_found_on_get_flow_for_version() {
        when(registryService.getSnapshot()).thenReturn(RegistrySnapshot.EMPTY);
        assertThrows(NamespaceNotFoundException.class,
                () -> store.getFlowForVersion(new Flow.FlowBuilder().setNamespace("nonexistent").build()));
    }

    @Test
    void return_empty_versions_when_neither_the_api_nor_the_local_clone_have_anything() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getFlowVersions(flow);

        assertThat(versions, is(empty()));
    }

    @Test
    void fall_back_to_the_local_head_sha_when_the_api_returns_no_versions() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("1234567");

        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getFlowVersions(flow);

        assertThat(versions, hasSize(1));
        assertThat(versions.get(0), equalTo("1234567"));
    }

    @Test
    void return_sha_versions_when_version_service_available() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/architecture-as-code");
        when(cloneManager.getBranchForNamespace("finos")).thenReturn("main");
        when(versionService.getFileVersions("finos/architecture-as-code", "main", "flows/payment-flow.json"))
                .thenReturn(List.of("abc1234", "def5678"));

        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).build();
        List<String> versions = store.getFlowVersions(flow);

        assertThat(versions, hasSize(2));
        assertThat(versions.get(0), equalTo("abc1234"));
    }

    @Test
    void return_flow_content_for_the_current_head_version(@TempDir Path tempDir) throws Exception {
        Path flowDir = tempDir.resolve("finos/flows");
        Files.createDirectories(flowDir);
        Files.writeString(flowDir.resolve("payment-flow.json"), "{\"steps\":[]}");

        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubFlowStore realFileReaderStore = new GitHubFlowStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        String content = realFileReaderStore.getFlowForVersion(flow);
        assertThat(content, equalTo("{\"steps\":[]}"));
    }

    @Test
    void return_content_from_github_api_for_sha_version() throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        when(cloneManager.getRepoForNamespace("finos")).thenReturn("finos/repo");
        when(versionService.getFileAtVersion("finos/repo", "flows/payment-flow.json", "abc1234"))
                .thenReturn("{\"steps\":[{\"name\":\"old\"}]}");

        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();
        String content = store.getFlowForVersion(flow);

        assertThat(content, equalTo("{\"steps\":[{\"name\":\"old\"}]}"));
    }

    @Test
    void throw_version_not_found_when_the_requested_version_is_not_sha_shaped() {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).setVersion("1.0.0").build();

        assertThrows(FlowVersionNotFoundException.class, () -> store.getFlowForVersion(flow));
    }

    @Test
    void throw_version_not_found_when_the_local_file_is_missing(@TempDir Path tempDir) throws Exception {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/nonexistent.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));
        when(cloneManager.headSha("finos")).thenReturn("abc1234");

        GitHubFlowStore realFileReaderStore = new GitHubFlowStore(registryService, cloneManager, versionService,
                new NamespaceFileReader(new GitHubStoreConfig("", tempDir.toString(), "https://api.github.com")));
        int hashId = ("payment-flow".hashCode() & 0x7FFFFFFF);
        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(hashId).setVersion("abc1234").build();

        assertThrows(FlowVersionNotFoundException.class, () -> realFileReaderStore.getFlowForVersion(flow));
    }

    @Test
    void throw_flow_not_found_when_id_does_not_match() {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                RegistryResourceType.FLOW, "Payment Flow", Instant.now());
        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry));
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", RegistryResourceType.FLOW)).thenReturn(List.of(entry));

        Flow flow = new Flow.FlowBuilder().setNamespace("finos").setId(99999).build();
        assertThrows(FlowNotFoundException.class, () -> store.getFlowVersions(flow));
    }

    @Test
    void throw_unsupported_on_create_flow_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.createFlowForVersion(new Flow.FlowBuilder().build()));
    }

    @Test
    void throw_unsupported_on_update_flow_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.updateFlowForVersion(new Flow.FlowBuilder().build()));
    }
}
