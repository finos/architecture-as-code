package org.finos.calm.store;

import org.finos.calm.domain.search.GroupedSearchResults;

import java.util.Optional;
import java.util.Set;

public interface SearchStore {
    int MAX_RESULTS_PER_TYPE = 50;

    /**
     * Performs a search across all resource types.
     *
     * @param query              the user-supplied search query
     * @param readableNamespaces an optional set of namespaces the caller is allowed to read.
     *                           When present, namespace-scoped result types
     *                           (architectures, patterns, flows, standards, interfaces, ADRs)
     *                           are filtered to entries belonging to those namespaces
     *                           <em>before</em> the per-type cap is applied. Controls are
     *                           domain-scoped and are not affected by this filter.
     *                           When empty, no namespace filtering is applied.
     */
    GroupedSearchResults search(String query, Optional<Set<String>> readableNamespaces);

    /**
     * Convenience overload that performs an unfiltered search. Equivalent to
     * {@link #search(String, Optional)} with {@link Optional#empty()}.
     */
    default GroupedSearchResults search(String query) {
        return search(query, Optional.empty());
    }
}
