package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.RegistrySnapshot;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * GitHub-mode {@link SearchStore}: a read-only, in-memory name/id substring match over the
 * current {@link ResourceRegistry} snapshot rather than a real index - there is no external
 * search backend to query in this storage mode, and the registry is already fully resident in
 * memory, so scanning it directly is the whole implementation. Namespace filtering
 * ({@code readableNamespaces}) is applied before matching so a caller never sees a result from
 * a namespace they cannot read, regardless of how good the match is.
 */
@ApplicationScoped
@Typed(GitHubSearchStore.class)
public class GitHubSearchStore implements SearchStore {

    private final ResourceRegistry registryService;

    @Inject
    public GitHubSearchStore(ResourceRegistry registryService) {
        this.registryService = registryService;
    }

    @Override
    public GroupedSearchResults search(String query, Optional<Set<String>> readableNamespaces) {
        if (query == null || query.isBlank()) {
            return new GroupedSearchResults(
                    List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }

        // No cap on the merged stream here, deliberately: filterByType below already caps
        // each type independently to MAX_RESULTS_PER_TYPE. A single combined cap applied
        // before the per-type split would let one type's matches (e.g. a namespace with
        // many matching architectures) exhaust it before entries of other types are ever
        // reached, starving them even when real matches exist further into the stream.
        // The registry is an in-memory index, not an external call, so there's no cost
        // reason to cut the merge short.
        String lowerQuery = query.toLowerCase();

        // One snapshot for the whole request: a background registry rebuild landing between
        // two independent getSnapshot() calls must not change which namespace a result is
        // attributed to. namespaceByEntry is built from the same readable-namespace-filtered
        // pass as allEntries, so an entry from a namespace this caller cannot read is never
        // available to attribute a result to, however the reverse lookup is done.
        RegistrySnapshot snapshot = registryService.getSnapshot();
        List<String> readable = snapshot.getNamespaces().stream()
                .filter(ns -> readableNamespaces.isEmpty() || readableNamespaces.get().contains(ns))
                .toList();

        Map<RegistryEntry, String> namespaceByEntry = readable.stream()
                .flatMap(ns -> snapshot.listAll(ns).stream().map(e -> Map.entry(e, ns)))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (first, second) -> first));

        List<RegistryEntry> allEntries = readable.stream()
                .flatMap(ns -> snapshot.listAll(ns).stream())
                .filter(e -> matchesQuery(e, lowerQuery))
                .toList();

        return new GroupedSearchResults(
                filterByType(allEntries, RegistryResourceType.ARCHITECTURE, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.PATTERN, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.FLOW, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.STANDARD, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.INTERFACE, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.CONTROL, namespaceByEntry),
                filterByType(allEntries, RegistryResourceType.ADR, namespaceByEntry)
        );
    }

    private boolean matchesQuery(RegistryEntry entry, String lowerQuery) {
        return (entry.name() != null && entry.name().toLowerCase().contains(lowerQuery))
                || (entry.uniqueId() != null && entry.uniqueId().toLowerCase().contains(lowerQuery));
    }

    private List<SearchResult> filterByType(List<RegistryEntry> entries, RegistryResourceType type,
                                              Map<RegistryEntry, String> namespaceByEntry) {
        return entries.stream()
                .filter(e -> e.type() == type)
                .limit(MAX_RESULTS_PER_TYPE)
                .map(e -> new SearchResult(
                        namespaceByEntry.getOrDefault(e, ""),
                        (e.uniqueId().hashCode() & 0x7FFFFFFF),
                        e.name(),
                        null
                ))
                .collect(Collectors.toList());
    }
}
