package org.finos.calm.store;

import java.util.List;

public interface NamespaceStore {
    List<String> getNamespaces();
    boolean namespaceExists(String namespace);
}
