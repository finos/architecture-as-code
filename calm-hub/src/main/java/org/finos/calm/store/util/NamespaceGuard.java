package org.finos.calm.store.util;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class NamespaceGuard {

    private static final Logger LOG = LoggerFactory.getLogger(NamespaceGuard.class);

    private NamespaceGuard() {
    }

    public static void requireNamespace(NamespaceStore namespaceStore, String namespace)
            throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            LOG.warn("Namespace '{}' not found", namespace);
            throw new NamespaceNotFoundException();
        }
    }
}
