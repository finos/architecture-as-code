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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Aggregates per-namespace resource counts and per-domain control counts by
 * sizing the existing summary/list methods on each store. Reuses the same data
 * the UI would otherwise fetch one type at a time, so the rail and namespace
 * page get live counts in a single round-trip. No new persistence schema.
 */
@ApplicationScoped
public class CountsService {

    private static final Logger logger = LoggerFactory.getLogger(CountsService.class);

    // Short TTL so repeated browse-rail requests within a burst reuse the ~6-store-call
    // aggregate per namespace/domain instead of re-reading on every request, while counts
    // still refresh within a few seconds. Cached per entity (not per caller) so the
    // read-filter is still applied before any lookup — a caller never triggers a fetch for
    // a namespace/domain they cannot read.
    private static final long COUNTS_CACHE_TTL_MILLIS = 5_000L;

    private final Map<String, Cached<NamespaceCounts>> namespaceCountsCache = new ConcurrentHashMap<>();
    private final Map<String, Cached<Integer>> domainControlCountCache = new ConcurrentHashMap<>();

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
        // Counts are derived by fetching each resource type's list per namespace and sizing it
        // (~6 store calls per namespace). Results are cached per namespace with a short TTL so a
        // burst of browse-rail requests doesn't re-read every time; a store-level aggregate count
        // query remains a future optimisation. The read-filter is applied first, so unreadable
        // namespaces are never fetched or cached.
        return namespaceStore.getNamespaces().stream()
                .map(NamespaceInfo::getName)
                .filter(namespace -> readableNamespaces.map(set -> set.contains(namespace)).orElse(true))
                .map(this::cachedCountsForNamespace)
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
                .map(domain -> new DomainControlCount(domain, cachedControlCount(domain)))
                .collect(Collectors.toList());
    }

    private NamespaceCounts cachedCountsForNamespace(String namespace) {
        return cached(namespaceCountsCache, namespace, this::countsForNamespace);
    }

    private int cachedControlCount(String domain) {
        return cached(domainControlCountCache, domain, this::controlCount);
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
        } catch (RuntimeException e) {
            // A store-level failure (e.g. a locked Nitrite file) must not turn the whole
            // counts endpoint into a 500 — treat this domain as zero and keep going.
            logger.warn("Failed to count controls for domain [{}]; treating as 0", domain, e);
            return 0;
        }
    }

    /**
     * Sizes a store list, treating a missing namespace as an empty result. The
     * namespace came from the store's own namespace list, so a not-found here
     * means the resource type simply has nothing for it — count it as zero
     * rather than failing the whole aggregate. Any other store failure is also
     * counted as zero (and logged) so one bad store never 500s the whole endpoint.
     */
    private int sizeOrZero(NamespaceListSupplier supplier) {
        try {
            return supplier.get().size();
        } catch (NamespaceNotFoundException e) {
            return 0;
        } catch (RuntimeException e) {
            logger.warn("Failed to size a resource list while aggregating counts; treating as 0", e);
            return 0;
        }
    }

    /**
     * Returns the cached value for {@code key} if it is still within the TTL, otherwise computes
     * it via {@code compute}, caches it, and returns it.
     */
    private static <T> T cached(Map<String, Cached<T>> cache, String key, Function<String, T> compute) {
        long now = System.currentTimeMillis();
        Cached<T> hit = cache.get(key);
        if (hit != null && now < hit.expiry) {
            return hit.value;
        }
        T value = compute.apply(key);
        cache.put(key, new Cached<>(value, now + COUNTS_CACHE_TTL_MILLIS));
        return value;
    }

    /** Supplier of a namespace-scoped store list that may report the namespace as missing. */
    @FunctionalInterface
    private interface NamespaceListSupplier {
        List<?> get() throws NamespaceNotFoundException;
    }

    /** A cached value with an absolute expiry timestamp (epoch millis). */
    private static final class Cached<T> {
        private final T value;
        private final long expiry;

        Cached(T value, long expiry) {
            this.value = value;
            this.expiry = expiry;
        }
    }
}
