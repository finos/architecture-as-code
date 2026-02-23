package org.finos.calm.store;

import org.finos.calm.domain.namespaces.NamespaceInfo;

import java.util.List;

public interface NamespaceStore {
    List<NamespaceInfo> getNamespaces();
    boolean namespaceExists(String namespaceName);
    void createNamespace(String name, String description);
}
