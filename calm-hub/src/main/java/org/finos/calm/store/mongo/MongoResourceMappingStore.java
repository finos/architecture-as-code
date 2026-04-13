package org.finos.calm.store.mongo;

import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
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

/**
 * MongoDB-backed implementation of {@link ResourceMappingStore}.
 *
 * <h2>Document model</h2>
 * Uses a flat {@code resource_mappings} collection where each document represents a single
 * mapping: {@code { namespace, customId, resourceType, numericId }}.
 * A unique compound index on {@code (namespace, customId)} prevents duplicate custom IDs
 * within the same namespace.
 *
 * <h2>Concurrency</h2>
 * Duplicate prevention is handled by the unique index — a second insert with the same
 * {@code (namespace, customId)} throws a {@link MongoWriteException} with
 * {@link ErrorCategory#DUPLICATE_KEY}, which is translated to {@link DuplicateMappingException}.
 *
 * @see MongoIndexInitializer
 */
@ApplicationScoped
@Typed(MongoResourceMappingStore.class)
public class MongoResourceMappingStore implements ResourceMappingStore {

    private static final Logger LOG = LoggerFactory.getLogger(MongoResourceMappingStore.class);

    private final MongoCollection<Document> mappingCollection;
    private final MongoNamespaceStore namespaceStore;

    public MongoResourceMappingStore(MongoDatabase database, MongoNamespaceStore namespaceStore) {
        this.namespaceStore = namespaceStore;
        this.mappingCollection = database.getCollection("resource_mappings");
    }

    @Override
    public ResourceMapping createMapping(String namespace, String customId, ResourceType type, int numericId) throws DuplicateMappingException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document doc = new Document("namespace", namespace)
                .append("customId", customId)
                .append("resourceType", type.name())
                .append("numericId", numericId);

        try {
            mappingCollection.insertOne(doc);
        } catch (MongoWriteException e) {
            if (e.getError().getCategory() == ErrorCategory.DUPLICATE_KEY) {
                throw new DuplicateMappingException();
            }
            throw e;
        }

        return buildMapping(namespace, customId, type, numericId);
    }

    @Override
    public ResourceMapping getMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("customId", customId)
        );

        Document result = mappingCollection.find(filter).first();
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

        Bson filter;
        if (typeFilter != null) {
            filter = Filters.and(
                    Filters.eq("namespace", namespace),
                    Filters.eq("resourceType", typeFilter.name())
            );
        } else {
            filter = Filters.eq("namespace", namespace);
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

        Bson filter = Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("resourceType", type.name()),
                Filters.eq("numericId", numericId)
        );

        Document result = mappingCollection.find(filter).first();
        if (result == null) {
            throw new MappingNotFoundException();
        }

        return documentToMapping(result);
    }

    @Override
    public List<ResourceMapping> listMappingsByNumericIds(String namespace, ResourceType type, List<Integer> ids) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("resourceType", type.name()),
                Filters.in("numericId", ids)
        );

        List<ResourceMapping> mappings = new ArrayList<>();
        for (Document doc : mappingCollection.find(filter)) {
            mappings.add(documentToMapping(doc));
        }
        return mappings;
    }

    private ResourceMapping documentToMapping(Document doc) {
        return new ResourceMapping.ResourceMappingBuilder()
                .setNamespace(doc.getString("namespace"))
                .setCustomId(doc.getString("customId"))
                .setResourceType(ResourceType.valueOf(doc.getString("resourceType")))
                .setNumericId(doc.getInteger("numericId"))
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

        Bson filter = Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("customId", customId)
        );

        var result = mappingCollection.updateOne(filter, new Document("$set", new Document("numericId", numericId)));
        if (result.getMatchedCount() == 0) {
            throw new MappingNotFoundException();
        }
    }

    @Override
    public void deleteMapping(String namespace, String customId) throws MappingNotFoundException, NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = Filters.and(
                Filters.eq("namespace", namespace),
                Filters.eq("customId", customId)
        );

        var result = mappingCollection.deleteOne(filter);
        if (result.getDeletedCount() == 0) {
            throw new MappingNotFoundException();
        }
    }
}
