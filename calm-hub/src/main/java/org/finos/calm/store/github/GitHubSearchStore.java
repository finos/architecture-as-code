package org.finos.calm.store.github;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.github.util.CalmResourceType;
import org.finos.calm.store.github.util.InMemoryRegistryService;
import org.finos.calm.store.github.util.RegistryEntry;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
@Typed(GitHubSearchStore.class)
public class GitHubSearchStore implements SearchStore {

    @Inject
    InMemoryRegistryService registryService;

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
                filterByType(allEntries, CalmResourceType.ARCHITECTURE),
                filterByType(allEntries, CalmResourceType.PATTERN),
                filterByType(allEntries, CalmResourceType.FLOW),
                filterByType(allEntries, CalmResourceType.STANDARD),
                filterByType(allEntries, CalmResourceType.INTERFACE),
                filterByType(allEntries, CalmResourceType.CONTROL),
                filterByType(allEntries, CalmResourceType.ADR)
        );
    }

    private boolean matchesQuery(RegistryEntry entry, String lowerQuery) {
        return (entry.name() != null && entry.name().toLowerCase().contains(lowerQuery))
                || (entry.uniqueId() != null && entry.uniqueId().toLowerCase().contains(lowerQuery));
    }

    private List<SearchResult> filterByType(List<RegistryEntry> entries, CalmResourceType type) {
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
