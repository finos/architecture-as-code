package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public interface NamespaceStore {

    Logger NAMESPACE_STORE_LOG = LoggerFactory.getLogger(NamespaceStore.class);

    List<NamespaceInfo> getNamespaces();
    boolean namespaceExists(String namespaceName);
    void createNamespace(String name, String description) throws NamespaceAlreadyExistsException;

    /**
     * Validates that a namespace exists, throwing if it does not. Shared by every store
     * implementation that scopes an operation to a namespace, so the check only needs to
     * be implemented once.
     *
     * @param namespace the namespace to validate
     * @throws NamespaceNotFoundException if no namespace with the given name exists
     */
    default void requireNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceExists(namespace)) {
            NAMESPACE_STORE_LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }

    /**
     * Updates the description of an existing namespace. The namespace name itself is
     * immutable — only the description can be changed.
     *
     * @param name        the name of the namespace to update
     * @param description the new description
     * @throws NamespaceNotFoundException if no namespace with the given name exists
     */
    void updateNamespaceDescription(String name, String description) throws NamespaceNotFoundException;

    /**
     * Deletes a namespace. Callers are responsible for verifying the namespace is empty
     * (no content, no child namespaces) before calling this — this method performs no such
     * checks itself.
     *
     * @param name the name of the namespace to delete
     * @throws NamespaceNotFoundException if no namespace with the given name exists
     */
    void deleteNamespace(String name) throws NamespaceNotFoundException;
}
