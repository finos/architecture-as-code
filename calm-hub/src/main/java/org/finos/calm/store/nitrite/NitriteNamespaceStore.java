package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.store.NamespaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the NamespaceStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteNamespaceStore.class)
public class NitriteNamespaceStore implements NamespaceStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteNamespaceStore.class);
    private static final String COLLECTION_NAME = "namespaces";
    private static final String NAMESPACE_FIELD = "namespace";

    private final NitriteCollection namespaceCollection;

    @Inject
    public NitriteNamespaceStore(@StandaloneQualifier Nitrite db) {
        this.namespaceCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteNamespaceStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<String> getNamespaces() {
        List<String> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(doc.get(NAMESPACE_FIELD, String.class));
        }
        LOG.debug("Retrieved {} namespaces from NitriteDB", namespaces.size());
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespace) {
        Filter filter = where(NAMESPACE_FIELD).eq(namespace);
        Document doc = namespaceCollection.find(filter).firstOrNull();
        boolean exists = doc != null;
        LOG.debug("Namespace '{}' exists: {}", namespace, exists);
        return exists;
    }

    @Override
    public void createNamespace(String namespace) {
        if (!namespaceExists(namespace)) {
            Document namespaceDoc = Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace);
            namespaceCollection.insert(namespaceDoc);
            LOG.info("Created namespace: {}", namespace);
        } else {
            LOG.debug("Namespace '{}' already exists, skipping creation", namespace);
        }
    }
}
