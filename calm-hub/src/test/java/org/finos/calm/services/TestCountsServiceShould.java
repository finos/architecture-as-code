package org.finos.calm.services;

import org.finos.calm.domain.architecture.NamespaceArchitectureSummary;
import org.finos.calm.domain.adr.NamespaceAdrSummary;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.DomainControlCount;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.flow.NamespaceFlowSummary;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.domain.namespaces.NamespaceCounts;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.domain.pattern.NamespacePatternSummary;
import org.finos.calm.domain.standards.NamespaceStandardSummary;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.StandardStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestCountsServiceShould {

    private static final String NAMESPACE = "finos";
    private static final String DOMAIN = "security";
    /** Optional.empty() means "read everything" — global-admin / no-auth / public-read. */
    private static final Optional<Set<String>> ALL_ACCESS = Optional.empty();

    @Mock
    NamespaceStore mockNamespaceStore;
    @Mock
    DomainStore mockDomainStore;
    @Mock
    ArchitectureStore mockArchitectureStore;
    @Mock
    PatternStore mockPatternStore;
    @Mock
    FlowStore mockFlowStore;
    @Mock
    StandardStore mockStandardStore;
    @Mock
    AdrStore mockAdrStore;
    @Mock
    InterfaceStore mockInterfaceStore;
    @Mock
    ControlStore mockControlStore;

    CountsService service;

    @BeforeEach
    void setUp() {
        service = new CountsService(mockNamespaceStore, mockDomainStore, mockArchitectureStore,
                mockPatternStore, mockFlowStore, mockStandardStore, mockAdrStore,
                mockInterfaceStore, mockControlStore);
    }

    @Test
    void return_empty_list_when_no_namespaces() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of());

        assertThat(service.getNamespaceCounts(ALL_ACCESS), hasSize(0));
    }

    @Test
    void aggregate_counts_per_type_for_each_namespace() throws Exception {
        when(mockNamespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo(NAMESPACE, "FINOS namespace")));
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenReturn(List.of(
                        new NamespaceArchitectureSummary("a1", "desc", 1, 0),
                        new NamespaceArchitectureSummary("a2", "desc", 2, 0)));
        when(mockPatternStore.getPatternsForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespacePatternSummary("p1", "desc", 1, 0)));
        when(mockFlowStore.getFlowsForNamespace(NAMESPACE))
                .thenReturn(List.of(
                        new NamespaceFlowSummary("f1", "desc", 1, 0),
                        new NamespaceFlowSummary("f2", "desc", 2, 0),
                        new NamespaceFlowSummary("f3", "desc", 3, 0)));
        when(mockStandardStore.getStandardsForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceStandardSummary("s1", "desc", 1, 0)));
        when(mockAdrStore.getAdrsForNamespace(NAMESPACE))
                .thenReturn(List.of(
                        new NamespaceAdrSummary("adr1", "draft", 1),
                        new NamespaceAdrSummary("adr2", "accepted", 2)));
        when(mockInterfaceStore.getInterfacesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceInterfaceSummary("i1", "desc", 1)));

        List<NamespaceCounts> result = service.getNamespaceCounts(ALL_ACCESS);

        assertThat(result, hasSize(1));
        NamespaceCounts counts = result.get(0);
        assertThat(counts.getNamespace(), is(NAMESPACE));
        assertThat(counts.getArchitectures(), is(2));
        assertThat(counts.getPatterns(), is(1));
        assertThat(counts.getFlows(), is(3));
        assertThat(counts.getStandards(), is(1));
        assertThat(counts.getAdrs(), is(2));
        assertThat(counts.getInterfaces(), is(1));
        assertThat(counts.getTotal(), is(10));
    }

    @Test
    void treat_namespace_not_found_per_type_as_zero() throws Exception {
        when(mockNamespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo(NAMESPACE, "FINOS namespace")));
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());
        when(mockPatternStore.getPatternsForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());
        when(mockFlowStore.getFlowsForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());
        when(mockStandardStore.getStandardsForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());
        when(mockAdrStore.getAdrsForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());
        when(mockInterfaceStore.getInterfacesForNamespace(NAMESPACE))
                .thenThrow(new NamespaceNotFoundException());

        List<NamespaceCounts> result = service.getNamespaceCounts(ALL_ACCESS);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getTotal(), is(0));
    }

    @Test
    void return_empty_list_when_no_domains() {
        when(mockDomainStore.getDomains()).thenReturn(List.of());

        assertThat(service.getDomainCounts(ALL_ACCESS), hasSize(0));
    }

    @Test
    void count_controls_for_each_domain() throws Exception {
        when(mockDomainStore.getDomains()).thenReturn(List.of(DOMAIN));
        when(mockControlStore.getControlsForDomain(DOMAIN)).thenReturn(List.of(
                new ControlDetail(1, "Access Control", "Controls access"),
                new ControlDetail(2, "Encryption", "Data encryption")));

        List<DomainControlCount> result = service.getDomainCounts(ALL_ACCESS);

        assertThat(result, contains(new DomainControlCount(DOMAIN, 2)));
    }

    @Test
    void treat_domain_not_found_as_zero_control_count() throws Exception {
        when(mockDomainStore.getDomains()).thenReturn(List.of(DOMAIN));
        when(mockControlStore.getControlsForDomain(DOMAIN)).thenThrow(new DomainNotFoundException(DOMAIN));

        List<DomainControlCount> result = service.getDomainCounts(ALL_ACCESS);

        assertThat(result, contains(new DomainControlCount(DOMAIN, 0)));
    }

    @Test
    void use_each_namespace_name_when_multiple_present() throws Exception {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS"),
                new NamespaceInfo("custom", "custom")));
        lenient().when(mockArchitectureStore.getArchitecturesForNamespace("finos"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("a1", "desc", 1, 0)));

        List<NamespaceCounts> result = service.getNamespaceCounts(ALL_ACCESS);

        assertThat(result, hasSize(2));
        assertThat(result.get(0).getNamespace(), is("finos"));
        assertThat(result.get(1).getNamespace(), is("custom"));
    }

    // --- Per-namespace READ filtering ---

    @Test
    void include_only_readable_namespaces_when_a_subset_is_granted() throws Exception {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS"),
                new NamespaceInfo("custom", "custom"),
                new NamespaceInfo("secret", "secret")));
        lenient().when(mockArchitectureStore.getArchitecturesForNamespace("finos"))
                .thenReturn(List.of(new NamespaceArchitectureSummary("a1", "desc", 1, 0)));

        List<NamespaceCounts> result = service.getNamespaceCounts(Optional.of(Set.of("finos", "custom")));

        assertThat(result, hasSize(2));
        assertThat(result.stream().map(NamespaceCounts::getNamespace).toList(),
                containsInAnyOrder("finos", "custom"));
        // The unreadable namespace's cardinality is never even computed.
        verify(mockArchitectureStore, never()).getArchitecturesForNamespace("secret");
    }

    @Test
    void include_all_namespaces_when_access_is_unrestricted() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS"),
                new NamespaceInfo("custom", "custom")));

        List<NamespaceCounts> result = service.getNamespaceCounts(ALL_ACCESS);

        assertThat(result.stream().map(NamespaceCounts::getNamespace).toList(),
                containsInAnyOrder("finos", "custom"));
    }

    @Test
    void include_no_namespaces_when_readable_set_is_empty() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(List.of(
                new NamespaceInfo("finos", "FINOS"),
                new NamespaceInfo("custom", "custom")));

        List<NamespaceCounts> result = service.getNamespaceCounts(Optional.of(Set.of()));

        assertThat(result, hasSize(0));
    }

    // --- Per-domain DOMAIN_READ filtering ---

    @Test
    void include_only_readable_domains_when_a_subset_is_granted() throws Exception {
        when(mockDomainStore.getDomains()).thenReturn(List.of("security", "payments", "secret"));
        lenient().when(mockControlStore.getControlsForDomain("security"))
                .thenReturn(List.of(new ControlDetail(1, "Access Control", "Controls access")));

        List<DomainControlCount> result = service.getDomainCounts(Optional.of(Set.of("security", "payments")));

        assertThat(result, hasSize(2));
        assertThat(result.stream().map(DomainControlCount::getDomain).toList(),
                containsInAnyOrder("security", "payments"));
        // The unreadable domain's control cardinality is never even computed.
        verify(mockControlStore, never()).getControlsForDomain("secret");
    }

    @Test
    void include_all_domains_when_access_is_unrestricted() {
        when(mockDomainStore.getDomains()).thenReturn(List.of("security", "payments"));

        List<DomainControlCount> result = service.getDomainCounts(ALL_ACCESS);

        assertThat(result.stream().map(DomainControlCount::getDomain).toList(),
                containsInAnyOrder("security", "payments"));
    }

    @Test
    void include_no_domains_when_readable_set_is_empty() {
        when(mockDomainStore.getDomains()).thenReturn(List.of("security", "payments"));

        List<DomainControlCount> result = service.getDomainCounts(Optional.of(Set.of()));

        assertThat(result, hasSize(0));
    }

    @Test
    void cache_namespace_counts_within_ttl_so_stores_are_read_once() throws Exception {
        when(mockNamespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo(NAMESPACE, "FINOS namespace")));
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenReturn(List.of(new NamespaceArchitectureSummary("a1", "desc", 1, 1)));
        when(mockPatternStore.getPatternsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockFlowStore.getFlowsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockStandardStore.getStandardsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockAdrStore.getAdrsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockInterfaceStore.getInterfacesForNamespace(NAMESPACE)).thenReturn(List.of());

        service.getNamespaceCounts(ALL_ACCESS);
        List<NamespaceCounts> second = service.getNamespaceCounts(ALL_ACCESS);

        assertThat(second.get(0).getArchitectures(), is(1));
        // The second call within the TTL is served from the per-namespace cache.
        verify(mockArchitectureStore, times(1)).getArchitecturesForNamespace(NAMESPACE);
    }

    @Test
    void cache_domain_control_counts_within_ttl_so_control_store_is_read_once() throws Exception {
        when(mockDomainStore.getDomains()).thenReturn(List.of(DOMAIN));
        when(mockControlStore.getControlsForDomain(DOMAIN))
                .thenReturn(List.of(new ControlDetail(1, "Access Control", "Controls access")));

        service.getDomainCounts(ALL_ACCESS);
        List<DomainControlCount> second = service.getDomainCounts(ALL_ACCESS);

        assertThat(second.get(0).getControlCount(), is(1));
        verify(mockControlStore, times(1)).getControlsForDomain(DOMAIN);
    }

    @Test
    void count_type_as_zero_when_a_store_throws_at_runtime() throws Exception {
        when(mockNamespaceStore.getNamespaces())
                .thenReturn(List.of(new NamespaceInfo(NAMESPACE, "FINOS namespace")));
        when(mockArchitectureStore.getArchitecturesForNamespace(NAMESPACE))
                .thenThrow(new RuntimeException("store unavailable"));
        when(mockPatternStore.getPatternsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockFlowStore.getFlowsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockStandardStore.getStandardsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockAdrStore.getAdrsForNamespace(NAMESPACE)).thenReturn(List.of());
        when(mockInterfaceStore.getInterfacesForNamespace(NAMESPACE)).thenReturn(List.of());

        List<NamespaceCounts> result = service.getNamespaceCounts(ALL_ACCESS);

        // A store-level failure is counted as zero rather than 500-ing the whole endpoint.
        assertThat(result, hasSize(1));
        assertThat(result.get(0).getArchitectures(), is(0));
    }

    @Test
    void count_domain_as_zero_when_control_store_throws_at_runtime() throws Exception {
        when(mockDomainStore.getDomains()).thenReturn(List.of(DOMAIN));
        when(mockControlStore.getControlsForDomain(DOMAIN))
                .thenThrow(new RuntimeException("db locked"));

        List<DomainControlCount> result = service.getDomainCounts(ALL_ACCESS);

        assertThat(result, hasSize(1));
        assertThat(result.get(0).getControlCount(), is(0));
    }
}
