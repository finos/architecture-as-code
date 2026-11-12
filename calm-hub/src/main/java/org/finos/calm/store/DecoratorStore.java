package org.finos.calm.store;

import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.DecoratorSupersededException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;

import java.util.List;
import java.util.Optional;

/**
 * Interface for decorator storage operations.
 */
public interface DecoratorStore {

    /**
     * Refuse a write before it reads anything, in a store that cannot write.
     */
    default void requireWritable() {
    }

    /**
     * Retrieve current decorator IDs for a given namespace with optional filtering. Superseded decorators are left out.
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorator IDs matching the criteria
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Integer> getDecoratorsForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException;

    /**
     * Retrieve current decorator values for a given namespace with optional filtering. Superseded decorators are left out.
     *
     * @param namespace the namespace to retrieve decorators for
     * @param target optional target path to filter by (e.g., "/calm/namespaces/finos/architectures/1/versions/1-0-0")
     * @param type optional decorator type to filter by (e.g., "deployment", "observability")
     * @return a list of decorators matching the criteria
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    List<Decorator> getDecoratorValuesForNamespace(String namespace, String target, String type) throws NamespaceNotFoundException;

    /**
     * Retrieve a decorator by its ID in a given namespace, superseded or not.
     *
     * @param namespace the namespace to retrieve the decorator from
     * @param id the ID of the decorator
     * @return an optional containing the decorator if found
     * @throws NamespaceNotFoundException if the namespace does not exist
     */
    Optional<Decorator> getDecoratorById(String namespace, int id) throws NamespaceNotFoundException;

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
     * @throws DecoratorSupersededException if the decorator exists but has been superseded
     */
    void updateDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException;

    /**
     * Store a new decorator that supersedes an existing one, for an append-only (reserved) type. The
     * existing decorator is kept and marked superseded, so lists no longer return it.
     *
     * @param namespace     the namespace containing the decorator
     * @param id            the ID of the decorator to supersede
     * @param decoratorJson the new decorator as a raw JSON string
     * @return the ID of the new decorator
     * @throws NamespaceNotFoundException   if the namespace does not exist
     * @throws DecoratorNotFoundException   if no decorator with the given ID exists
     * @throws DecoratorSupersededException if the decorator has already been superseded
     */
    int supersedeDecorator(String namespace, int id, String decoratorJson)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException;

    /**
     * Retrieve the history that contains a decorator: the current decorator first, then each one it supersedes.
     *
     * @param namespace the namespace containing the decorator
     * @param id        the ID of any decorator in the history
     * @return the history, never empty
     * @throws NamespaceNotFoundException if the namespace does not exist
     * @throws DecoratorNotFoundException if no decorator with the given ID exists
     */
    List<DecoratorHistoryEntry> getDecoratorHistory(String namespace, int id)
            throws NamespaceNotFoundException, DecoratorNotFoundException;

    /**
     * Delete a history only if the authorized current entry is still current.
     * A concurrent supersession must not delete a successor that was not authorized.
     *
     * @throws DecoratorSupersededException if the entry is present but is no longer current
     */
    void deleteCurrentDecoratorHistory(String namespace, int currentId)
            throws NamespaceNotFoundException, DecoratorNotFoundException, DecoratorSupersededException;
}
