package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;

/**
 * Interface for decorator storage operations.
 */
public interface DecoratorStore {
    
    /**
     * Retrieve all decorator IDs for a given namespace.
     *
     * @param namespace the namespace to retrieve decorators for
     * @return a list of decorator IDs in the given namespace
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Integer> getDecoratorsForNamespace(String namespace) throws NamespaceNotFoundException;
}
