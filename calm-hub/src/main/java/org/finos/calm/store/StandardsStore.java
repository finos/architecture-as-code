package org.finos.calm.store;

import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

public interface StandardsStore {
    List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException;
    Standard createStandardForNamespace(String namespace, Standard standard) throws NamespaceNotFoundException;
}
