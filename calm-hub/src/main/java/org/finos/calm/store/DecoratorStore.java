package org.finos.calm.store;

import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;
import java.util.Optional;

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

    /**
     * Retrieve decorator values for a given namespace with optional filtering.
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorators matching the criteria
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException;

    /**
     * Retrieve a decorator by its ID in a given namespace.
     *
     * @param namespace the namespace to retrieve the decorator from
     * @param id the ID of the decorator
     * @return an optional containing the decorator if found
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException, DecoratorNotFoundException;

    /**
     * Create a new decorator in the given namespace.
     *
     * @param namespace     the namespace to store the decorator in
     * @param decoratorJson the decorator as a raw JSON string
     * @return the assigned decorator ID
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    int createDecorator(String namespace, String decoratorJson) throws NamespaceNotFoundException;

    /**
     * Update an existing decorator in the given namespace.
     *
     * @param namespace     the namespace containing the decorator
     * @param id            the ID of the decorator to update
     * @param decoratorJson the updated decorator as a raw JSON string
     * @throws NamespaceNotFoundException  if the namespace does not exist
     * @throws DecoratorNotFoundException  if no decorator with the given ID exists
     */
    void updateDecorator(String namespace, int id, String decoratorJson) throws NamespaceNotFoundException, DecoratorNotFoundException;
}
