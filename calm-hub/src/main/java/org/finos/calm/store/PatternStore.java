package org.finos.calm.store;

import org.bson.json.JsonParseException;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.namespaces.NamespaceResourceSummary;

import java.util.List;

public interface PatternStore {
    /**
     * Retrieve all pattern summaries for a namespace (unpaged).
     *
     * @param namespace the namespace to retrieve patterns for
     * @return the full list of pattern summaries
     */
    default List<NamespaceResourceSummary> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException {
        return getPatternsForNamespace(namespace, PageRequest.UNPAGED);
    }

    /**
     * Retrieve pattern summaries for a namespace, optionally paged.
     *
     * @param namespace the namespace to retrieve patterns for
     * @param page      the optional {@code limit}/{@code offset} paging window
     *                  ({@link PageRequest#UNPAGED} for the full list)
     * @return a (possibly paged) list of pattern summaries
     */
    List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, PageRequest page) throws NamespaceNotFoundException;
    Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException;
    List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
    String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException;
    Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException;
    Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
}
