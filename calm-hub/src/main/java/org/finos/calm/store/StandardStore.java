package org.finos.calm.store;

import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;

import java.util.List;

public interface StandardStore {
    List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException;
    Standard createStandardForNamespace(Standard standard) throws NamespaceNotFoundException;
    List<String> getStandardVersions(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException;
}
