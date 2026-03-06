package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

/**
 * Interface for decorator storage operations.
 */
public interface DecoratorStore {
    
    /**
     * Retrieve decorator IDs for a given namespace with optional filtering.
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorator IDs matching the criteria
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException;
}
