package org.finos.calm.store;

import org.bson.json.JsonParseException;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.patterns.CreatePatternRequest;

import java.util.List;

public interface PatternStore {
    List<Integer> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException;

    Pattern createPatternForNamespace(CreatePatternRequest createPatternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException;

    List<String> getPatternVersions(String namespace, int patternId) throws NamespaceNotFoundException, PatternNotFoundException;

    String getPatternForVersion(String namespace, int patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException;

    Pattern createPatternForVersion(CreatePatternRequest createPatternRequest, String namespace, Integer patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException;

    Pattern updatePatternForVersion(CreatePatternRequest createPatternRequest, String namespace, Integer patternId, String version) throws NamespaceNotFoundException, PatternNotFoundException;
}
