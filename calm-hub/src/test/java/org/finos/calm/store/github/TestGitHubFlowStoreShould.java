package org.finos.calm.store.github;

import org.finos.calm.domain.Flow;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;
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
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestGitHubFlowStoreShould {

    @Mock
    private InMemoryRegistryService registryService;

    private GitHubFlowStore store;

    @BeforeEach
    void setup() {
        store = new GitHubFlowStore(registryService);
    }

    @Test
    void return_flows_for_namespace() throws NamespaceNotFoundException {
        RegistryEntry entry = new RegistryEntry("payment-flow", Path.of("flows/payment-flow.json"),
                CalmResourceType.FLOW, "Payment Flow", Instant.now());

        RegistrySnapshot snapshot = new RegistrySnapshot(
                Map.of("finos", List.of(entry)),
                Map.of("finos:payment-flow", entry),
                Map.of(CalmResourceType.FLOW, List.of(entry))
        );
        when(registryService.getSnapshot()).thenReturn(snapshot);
        when(registryService.listByType("finos", CalmResourceType.FLOW)).thenReturn(List.of(entry));

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
    void throw_unsupported_on_get_flow_versions() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getFlowVersions(new Flow.FlowBuilder().build()));
    }

    @Test
    void throw_unsupported_on_get_flow_for_version() {
        assertThrows(UnsupportedOperationException.class,
                () -> store.getFlowForVersion(new Flow.FlowBuilder().build()));
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
