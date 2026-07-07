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
    List<NamespaceResourceSummary> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException;

    /**
     * Retrieve pattern summaries for a namespace, optionally limited and offset.
     *
     * @param namespace the namespace to retrieve patterns for
     * @param limit     the maximum number of summaries to return, or {@code null} for no limit
     * @param offset    the number of summaries to skip, or {@code null} for none
     * @return a (possibly limited) list of pattern summaries
     */
    List<NamespaceResourceSummary> getPatternsForNamespace(String namespace, Integer limit, Integer offset) throws NamespaceNotFoundException;
    Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException;
    List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
    String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException;
    Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException;
    Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
}
