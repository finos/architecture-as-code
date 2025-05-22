package org.finos.calm.store;

import org.finos.calm.domain.Standard;
import org.finos.calm.domain.StandardDetails;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;

import java.util.List;

public interface StandardStore {
    List<StandardDetails> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException;
    Standard createStandardForNamespace(Standard standard) throws NamespaceNotFoundException;
    List<String> getStandardVersions(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException;
    Standard getStandardForVersion(StandardDetails standardDetails) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException;
    Standard createStandardForVersion(Standard standard) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException;
}
