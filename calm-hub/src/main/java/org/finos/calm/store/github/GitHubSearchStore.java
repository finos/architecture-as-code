package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.github.registry.RegistryResourceType;
import org.finos.calm.store.github.registry.ResourceRegistry;
import org.finos.calm.store.github.registry.RegistryEntry;

import java.util.List;
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

        String lowerQuery = query.toLowerCase();
        List<RegistryEntry> allEntries = registryService.getSnapshot().getNamespaces().stream()
                .filter(ns -> readableNamespaces.isEmpty() || readableNamespaces.get().contains(ns))
                .flatMap(ns -> registryService.getSnapshot().listAll(ns).stream())
                .filter(e -> matchesQuery(e, lowerQuery))
                .limit(MAX_RESULTS_PER_TYPE * 7L)
                .toList();

        return new GroupedSearchResults(
                filterByType(allEntries, RegistryResourceType.ARCHITECTURE),
                filterByType(allEntries, RegistryResourceType.PATTERN),
                filterByType(allEntries, RegistryResourceType.FLOW),
                filterByType(allEntries, RegistryResourceType.STANDARD),
                filterByType(allEntries, RegistryResourceType.INTERFACE),
                filterByType(allEntries, RegistryResourceType.CONTROL),
                filterByType(allEntries, RegistryResourceType.ADR)
        );
    }

    private boolean matchesQuery(RegistryEntry entry, String lowerQuery) {
        return (entry.name() != null && entry.name().toLowerCase().contains(lowerQuery))
                || (entry.uniqueId() != null && entry.uniqueId().toLowerCase().contains(lowerQuery));
    }

    private List<SearchResult> filterByType(List<RegistryEntry> entries, RegistryResourceType type) {
        return entries.stream()
                .filter(e -> e.type() == type)
                .limit(MAX_RESULTS_PER_TYPE)
                .map(e -> new SearchResult(
                        registryService.getSnapshot().getNamespaces().stream()
                                .filter(ns -> registryService.getSnapshot().listAll(ns).contains(e))
                                .findFirst().orElse(""),
                        (e.uniqueId().hashCode() & 0x7FFFFFFF),
                        e.name(),
                        e.uniqueId()
                ))
                .collect(Collectors.toList());
    }
}
