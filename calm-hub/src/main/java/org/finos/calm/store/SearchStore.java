package org.finos.calm.store;

import org.finos.calm.domain.search.GroupedSearchResults;

public interface SearchStore {
    int MAX_RESULTS_PER_TYPE = 50;

    GroupedSearchResults search(String query);
}
