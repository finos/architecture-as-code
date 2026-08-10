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

    /**
     * Whether a pattern with the given id exists in the namespace, regardless of how many
     * versions it has. Mirrors {@link ArchitectureStore#architectureExists}.
     *
     * @param namespace the namespace the pattern belongs to
     * @param patternId the id of the pattern
     * @return true if a pattern header exists for this id
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    boolean patternExists(String namespace, int patternId) throws NamespaceNotFoundException;

    Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException;
    List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
    String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException;
    Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException;
    Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
}
