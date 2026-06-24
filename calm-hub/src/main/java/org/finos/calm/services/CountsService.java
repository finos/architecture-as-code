package org.finos.calm.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.controls.DomainControlCount;
import org.finos.calm.domain.exception.DomainNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceCounts;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.store.AdrStore;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.ControlStore;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.FlowStore;
import org.finos.calm.store.InterfaceStore;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.StandardStore;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Aggregates per-namespace resource counts and per-domain control counts by
 * sizing the existing summary/list methods on each store. Reuses the same data
 * the UI would otherwise fetch one type at a time, so the rail and namespace
 * page get live counts in a single round-trip. No new persistence schema.
 */
@ApplicationScoped
public class CountsService {

    private final NamespaceStore namespaceStore;
    private final DomainStore domainStore;
    private final ArchitectureStore architectureStore;
    private final PatternStore patternStore;
    private final FlowStore flowStore;
    private final StandardStore standardStore;
    private final AdrStore adrStore;
    private final InterfaceStore interfaceStore;
    private final ControlStore controlStore;

    @Inject
    @SuppressWarnings("java:S107") // store-per-resource aggregation legitimately needs all collaborators
    public CountsService(NamespaceStore namespaceStore,
                         DomainStore domainStore,
                         ArchitectureStore architectureStore,
                         PatternStore patternStore,
                         FlowStore flowStore,
                         StandardStore standardStore,
                         AdrStore adrStore,
                         InterfaceStore interfaceStore,
                         ControlStore controlStore) {
        this.namespaceStore = namespaceStore;
        this.domainStore = domainStore;
        this.architectureStore = architectureStore;
        this.patternStore = patternStore;
        this.flowStore = flowStore;
        this.standardStore = standardStore;
        this.adrStore = adrStore;
        this.interfaceStore = interfaceStore;
        this.controlStore = controlStore;
    }

    /**
     * Per-namespace counts, filtered to the caller's readable namespaces.
     *
     * @param readableNamespaces {@link Optional#empty()} means the caller may read every
     *        namespace (global-admin / no-auth / public-read) — no filtering is applied.
     *        An {@code Optional} containing a (possibly empty) set restricts the result to
     *        the intersection of that set with the existing namespaces, so a caller never
     *        sees cardinality for a namespace they cannot {@code READ}.
     */
    public List<NamespaceCounts> getNamespaceCounts(Optional<Set<String>> readableNamespaces) {
        // v1 tradeoff: counts are derived by fetching each resource type's list per
        // namespace and sizing it (~6 store calls per namespace, so ~6×N overall).
        // Accepted for now since it reuses existing store methods with no new schema;
        // a store-level aggregate count query (e.g. a single count per collection) is
        // a future optimisation if this endpoint becomes hot.
        return namespaceStore.getNamespaces().stream()
                .map(NamespaceInfo::getName)
                .filter(namespace -> readableNamespaces.map(set -> set.contains(namespace)).orElse(true))
                .map(this::countsForNamespace)
                .collect(Collectors.toList());
    }

    /**
     * Per-domain control counts, filtered to the caller's readable domains.
     *
     * @param readableDomains {@link Optional#empty()} means the caller may read every
     *        domain (global-admin / no-auth / public-read) — no filtering is applied.
     *        An {@code Optional} containing a (possibly empty) set restricts the result to
     *        the intersection of that set with the existing domains, so a caller never sees
     *        control cardinality for a domain they cannot {@code DOMAIN_READ}.
     */
    public List<DomainControlCount> getDomainCounts(Optional<Set<String>> readableDomains) {
        return domainStore.getDomains().stream()
                .filter(domain -> readableDomains.map(set -> set.contains(domain)).orElse(true))
                .map(domain -> new DomainControlCount(domain, controlCount(domain)))
                .collect(Collectors.toList());
    }

    private NamespaceCounts countsForNamespace(String namespace) {
        return new NamespaceCounts(
                namespace,
                sizeOrZero(() -> architectureStore.getArchitecturesForNamespace(namespace)),
                sizeOrZero(() -> patternStore.getPatternsForNamespace(namespace)),
                sizeOrZero(() -> flowStore.getFlowsForNamespace(namespace)),
                sizeOrZero(() -> standardStore.getStandardsForNamespace(namespace)),
                sizeOrZero(() -> adrStore.getAdrsForNamespace(namespace)),
                sizeOrZero(() -> interfaceStore.getInterfacesForNamespace(namespace))
        );
    }

    private int controlCount(String domain) {
        try {
            return controlStore.getControlsForDomain(domain).size();
        } catch (DomainNotFoundException e) {
            return 0;
        }
    }

    /**
     * Sizes a store list, treating a missing namespace as an empty result. The
     * namespace came from the store's own namespace list, so a not-found here
     * means the resource type simply has nothing for it — count it as zero
     * rather than failing the whole aggregate.
     */
    private int sizeOrZero(NamespaceListSupplier supplier) {
        try {
            return supplier.get().size();
        } catch (NamespaceNotFoundException e) {
            return 0;
        }
    }

    /** Supplier of a namespace-scoped store list that may report the namespace as missing. */
    @FunctionalInterface
    private interface NamespaceListSupplier {
        List<?> get() throws NamespaceNotFoundException;
    }
}
