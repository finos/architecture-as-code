package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.DuplicateMappingException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ResourceMappingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB-backed implementation of {@link ResourceMappingStore}, used in standalone mode.
 *
 * <h2>Concurrency strategy — ReentrantLock</h2>
 * NitriteDB does not support unique index constraints, so this class uses a
 * {@link ReentrantLock} to serialize write operations and enforce the uniqueness
 * of {@code (namespace, customId)} pairs at the application level.
 */
@ApplicationScoped
@Typed(NitriteResourceMappingStore.class)
public class NitriteResourceMappingStore implements ResourceMappingStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteResourceMappingStore.class);
    private static final String COLLECTION_NAME = "resource_mappings";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String CUSTOM_ID_FIELD = "customId";
    private static final String RESOURCE_TYPE_FIELD = "resourceType";
    private static final String NUMERIC_ID_FIELD = "numericId";

    private final NitriteCollection mappingCollection;
    private final NitriteNamespaceStore namespaceStore;
    private final Lock lock = new ReentrantLock();

    @Inject
    public NitriteResourceMappingStore(@StandaloneQualifier Nitrite db, NitriteNamespaceStore namespaceStore) {
        this.mappingCollection = db.getCollection(COLLECTION_NAME);
        this.namespaceStore = namespaceStore;
        LOG.info("NitriteResourceMappingStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId) throws DuplicateMappingException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            // Check for duplicate (namespace, customId) pair
            Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(CUSTOM_ID_FIELD).eq(customId));
            Document existing = mappingCollection.find(filter).firstOrNull();
            if (existing != null) {
                throw new DuplicateMappingException();
            }

            Document doc = Document.createDocument()
                    .put(NAMESPACE_FIELD, namespace)
                    .put(CUSTOM_ID_FIELD, customId)
                    .put(RESOURCE_TYPE_FIELD, type.name())
                    .put(NUMERIC_ID_FIELD, numericId);

            mappingCollection.insert(doc);

            LOG.info("Created resource mapping: namespace='{}', customId='{}', type={}, numericId={}", namespace, customId, type, numericId);
            return buildMapping(namespace, customId, type, numericId);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public ResourceMapping getMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(CUSTOM_ID_FIELD).eq(customId));
        Document result = mappingCollection.find(filter).firstOrNull();
        if (result == null) {
            throw new MappingNotFoundException();
        }

        return documentToMapping(result);
    }

    @Override
    public List<ResourceMapping> listMappings(String namespace, ResourceType typeFilter) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Filter filter;
        if (typeFilter != null) {
            filter = where(NAMESPACE_FIELD).eq(namespace).and(where(RESOURCE_TYPE_FIELD).eq(typeFilter.name()));
        } else {
            filter = where(NAMESPACE_FIELD).eq(namespace);
        }

        List<ResourceMapping> mappings = new ArrayList<>();
        for (Document doc : mappingCollection.find(filter)) {
            mappings.add(documentToMapping(doc));
        }
        return mappings;
    }

    @Override
    public ResourceMapping getMappingByNumericId(String namespace, ResourceType type, int numericId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Filter nameTypeFilter = where(NAMESPACE_FIELD).eq(namespace)
                .and(where(RESOURCE_TYPE_FIELD).eq(type.name()));

        List<ResourceMapping> candidates = new ArrayList<>();
        for (Document doc : mappingCollection.find(nameTypeFilter)) {
            candidates.add(documentToMapping(doc));
        }

        return candidates.stream()
                .filter(m -> m.getNumericId() == numericId)
                .findFirst()
                .orElseThrow(MappingNotFoundException::new);
    }

    @Override
    public List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        // Nitrite doesn't have a direct $in operator, so we filter in application code
        Filter filter = where(NAMESPACE_FIELD).eq(namespace)
                .and(where(RESOURCE_TYPE_FIELD).eq(type.name()));

        List<ResourceMapping> mappings = new ArrayList<>();
        for (Document doc : mappingCollection.find(filter)) {
            int docNumericId = doc.get(NUMERIC_ID_FIELD, Integer.class);
            if (ids.contains(docNumericId)) {
                mappings.add(documentToMapping(doc));
            }
        }
        return mappings;
    }

    private ResourceMapping documentToMapping(Document doc) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(doc.get(NAMESPACE_FIELD, String.class))
                .setCustomId(doc.get(CUSTOM_ID_FIELD, String.class))
                .setResourceType(ResourceType.valueOf(doc.get(RESOURCE_TYPE_FIELD, String.class)))
                .setNumericId(doc.get(NUMERIC_ID_FIELD, Integer.class))
                .build();
    }

    private ResourceMapping buildMapping(String namespace, String customId, ResourceType type, int numericId) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(namespace)
                .setCustomId(customId)
                .setResourceType(type)
                .setNumericId(numericId)
                .build();
    }

    @Override
    public void updateMappingNumericId(String namespace, String customId, int numericId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(CUSTOM_ID_FIELD).eq(customId));
            Document existing = mappingCollection.find(filter).firstOrNull();
            if (existing == null) {
                throw new MappingNotFoundException();
            }

            existing.put(NUMERIC_ID_FIELD, numericId);
            mappingCollection.update(existing);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void deleteMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        lock.lock();
        try {
            Filter filter = where(NAMESPACE_FIELD).eq(namespace).and(where(CUSTOM_ID_FIELD).eq(customId));
            Document existing = mappingCollection.find(filter).firstOrNull();
            if (existing == null) {
                throw new MappingNotFoundException();
            }

            mappingCollection.remove(existing);
        } finally {
            lock.unlock();
        }
    }
}
