package org.finos.calm.store;

import org.finos.calm.domain.Standard;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.StandardNotFoundException;
import org.finos.calm.domain.exception.StandardVersionExistsException;
import org.finos.calm.domain.exception.StandardVersionNotFoundException;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.domain.standards.NamespaceStandardSummary;

import java.util.List;

public interface StandardStore {
    List<NamespaceStandardSummary> getStandardsForNamespace(String namespace) throws NamespaceNotFoundException;
    Standard createStandardForNamespace(CreateStandardRequest standardRequest, String namespace) throws NamespaceNotFoundException;
    List<String> getStandardVersions(String namespace, Integer standardId) throws NamespaceNotFoundException, StandardNotFoundException;
    Standard getStandardForVersion(String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionNotFoundException;
    Standard createStandardForVersion(CreateStandardRequest standardRequest, String namespace, Integer standardId, String version) throws NamespaceNotFoundException, StandardNotFoundException, StandardVersionExistsException;
}
