package org.finos.calm.store;

import org.bson.json.JsonParseException;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.domain.exception.PatternVersionExistsException;
import org.finos.calm.domain.exception.PatternVersionNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.pattern.NamespacePatternSummary;

import java.util.List;

public interface PatternStore {
    List<NamespacePatternSummary> getPatternsForNamespace(String namespace) throws NamespaceNotFoundException;
    Pattern createPatternForNamespace(CreatePatternRequest patternRequest, String namespace) throws NamespaceNotFoundException, JsonParseException;
    List<String> getPatternVersions(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
    String getPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionNotFoundException;
    Pattern createPatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException, PatternVersionExistsException;
    Pattern updatePatternForVersion(Pattern pattern) throws NamespaceNotFoundException, PatternNotFoundException;
}
