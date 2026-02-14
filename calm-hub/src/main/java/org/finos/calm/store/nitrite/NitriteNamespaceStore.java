package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.namespaces.NamespaceInfo;
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
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";

    private final NitriteCollection namespaceCollection;

    @Inject
    public NitriteNamespaceStore(@StandaloneQualifier Nitrite db) {
        this.namespaceCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteNamespaceStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<NamespaceInfo> getNamespaces() {
        List<NamespaceInfo> namespaces = new ArrayList<>();
        for (Document doc : namespaceCollection.find()) {
            namespaces.add(new NamespaceInfo(doc.get(NAME_FIELD, String.class), doc.get(DESCRIPTION_FIELD, String.class)));
        }
        LOG.debug("Retrieved {} namespaces from NitriteDB", namespaces.size());
        return namespaces;
    }

    @Override
    public boolean namespaceExists(String namespaceName) {
        Filter filter = where(NAME_FIELD).eq(namespaceName);
        Document doc = namespaceCollection.find(filter).firstOrNull();
        boolean exists = doc != null;
        LOG.debug("Namespace '{}' exists: {}", namespaceName, exists);
        return exists;
    }

    @Override
    public void createNamespace(String name, String description) {
        if (!namespaceExists(name)) {
            Document namespaceDoc = Document.createDocument()
                    .put(NAME_FIELD, name)
                    .put(DESCRIPTION_FIELD, description);
            namespaceCollection.insert(namespaceDoc);
            LOG.info("Created namespace: {}", name);
        } else {
            LOG.debug("Namespace '{}' already exists, skipping creation", name);
        }
    }
}
