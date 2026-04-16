package org.finos.calm.store;

import org.finos.calm.domain.search.GroupedSearchResults;

public interface SearchStore {
    GroupedSearchResults search(String query);
}
