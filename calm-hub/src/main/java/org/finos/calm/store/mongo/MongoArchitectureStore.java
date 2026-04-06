package org.finos.calm.store.mongo;

import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.model.Updates;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.architecture.NamespaceArchitectureSummary;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.ArchitectureVersionExistsException;
import org.finos.calm.domain.exception.ArchitectureVersionNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * MongoDB-backed implementation of {@link ArchitectureStore}.
 *
 * <h2>Document model</h2>
 * The {@code architectures} collection has <em>one document per namespace</em>, enforced by a
 * unique index on the {@code namespace} field (created by {@link MongoIndexInitializer}).
 * Each document contains an {@code architectures} array where individual architecture
 * entries are stored as sub-documents with a unique {@code architectureId}, versioned
 * content, and metadata.
 *
 * <h2>Concurrency strategy — create</h2>
 * New architectures are added via {@code updateOne} with {@code upsert: true} and
 * {@code $push}. The upsert creates the namespace document if it doesn't exist; the
 * unique index on {@code namespace} prevents two concurrent upserts from creating
 * duplicate namespace documents. The {@link MongoCounterStore} provides an atomically
 * unique {@code architectureId} via {@code findOneAndUpdate} with {@code $inc}.
 *
 * <h2>Concurrency strategy — new version</h2>
 * Adding a new version to an existing architecture uses an atomic conditional update:
 * the query filter includes {@code $elemMatch} with {@code $exists: false} on the target
 * version key. If a concurrent request already added the version, the filter won't match
 * and {@code matchedCount == 0} signals a conflict, throwing
 * {@link ArchitectureVersionExistsException}.
 *
 * @see MongoIndexInitializer
 * @see MongoCounterStore
 */
@ApplicationScoped
@Typed(MongoArchitectureStore.class)
public class MongoArchitectureStore implements ArchitectureStore {

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCollection<Document> architectureCollection;
    private final Logger log = LoggerFactory.getLogger(getClass());

    public MongoArchitectureStore(MongoDatabase database, MongoCounterStore counterStore, MongoNamespaceStore namespaceStore) {
        this.counterStore = counterStore;
        this.namespaceStore = namespaceStore;
        this.architectureCollection = database.getCollection("architectures");
    }

    @Override
    public List<NamespaceArchitectureSummary> getArchitecturesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = architectureCollection.find(Filters.eq("namespace", namespace)).first();

        //protects from an unpopulated mongo collection
        if (namespaceDocument == null || namespaceDocument.isEmpty()) {
            return List.of();
        }

        List<Document> architectures = namespaceDocument.getList("architectures", Document.class);
        List<NamespaceArchitectureSummary> architectureSummaries = new ArrayList<>();

        for (Document architectureDoc : architectures) {
            Integer archId = architectureDoc.getInteger("architectureId");
            String name = architectureDoc.getString("name");
            String description = architectureDoc.getString("description");
            if (name == null) name = "Architecture " + archId;
            if (description == null) description = "";
            NamespaceArchitectureSummary summary = new NamespaceArchitectureSummary(
                    name, description, archId
            );
            architectureSummaries.add(summary);
        }

        return architectureSummaries;
    }

    @Override
    public Architecture createArchitectureForNamespace(Architecture architecture) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextArchitectureSequenceValue();
        Document architectureDocument = new Document("architectureId", id)
                .append("name", architecture.getName())
                .append("description", architecture.getDescription())
                .append("versions", new Document("1-0-0", Document.parse(architecture.getArchitectureJson())));

        architectureCollection.updateOne(
                Filters.eq("namespace", architecture.getNamespace()),
                Updates.push("architectures", architectureDocument),
                new UpdateOptions().upsert(true));

        Architecture persistedArchitecture = new Architecture.ArchitectureBuilder()
                .setId(id)
                .setVersion("1.0.0")
                .setNamespace(architecture.getNamespace())
                .setArchitecture(architecture.getArchitectureJson())
                .build();

        return persistedArchitecture;
    }

    @Override
    public List<String> getArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = result.getList("architectures", Document.class);
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.getInteger("architectureId")) {
                // Extract the versions map from the matching pattern
                Document versions = (Document) architectureDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                //Convert from Mongo representation
                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;  // Return the list of version keys
            }
        }

        throw new ArchitectureNotFoundException();
    }

    private Document retrieveArchitectureVersions(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", architecture.getNamespace());
        Bson projection = Projections.fields(Projections.include("architectures"));

        Document result = architectureCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new ArchitectureNotFoundException();
        }

        return result;
    }

    @Override
    public String getArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionNotFoundException {
        Document result = retrieveArchitectureVersions(architecture);

        List<Document> architectures = result.getList("architectures", Document.class);
        for (Document architectureDoc : architectures) {
            if (architecture.getId() == architectureDoc.getInteger("architectureId")) {
                // Retrieve the versions map from the matching pattern
                Document versions = (Document) architectureDoc.get("versions");

                // Return the pattern JSON blob for the specified version
                Document versionDoc = (Document) versions.get(architecture.getMongoVersion());
                log.info("VersionDoc: [{}], Mongo Version: [{}]", architectureDoc.get("versions"), architecture.getMongoVersion());
                if (versionDoc == null) {
                    throw new ArchitectureVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        //Patterns is empty, no version to find
        throw new ArchitectureVersionNotFoundException();
    }

    @Override
    public Architecture createArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException, ArchitectureVersionExistsException {
        // Validates namespace and architecture existence
        getArchitectureVersions(architecture);

        // Atomic conditional update: only succeeds if the version doesn't already exist
        Document filter = new Document("namespace", architecture.getNamespace())
                .append("architectures", new Document("$elemMatch",
                        new Document("architectureId", architecture.getId())
                                .append("versions." + architecture.getMongoVersion(), new Document("$exists", false))));

        Document update = new Document("$set",
                new Document("architectures.$.versions." + architecture.getMongoVersion(), Document.parse(architecture.getArchitectureJson()))
                        .append("architectures.$.name", architecture.getName())
                        .append("architectures.$.description", architecture.getDescription()));

        if (architectureCollection.updateOne(filter, update).getMatchedCount() == 0) {
            throw new ArchitectureVersionExistsException();
        }

        return architecture;
    }

    @Override
    public Architecture updateArchitectureForVersion(Architecture architecture) throws NamespaceNotFoundException, ArchitectureNotFoundException {
        if (!namespaceStore.namespaceExists(architecture.getNamespace())) {
            throw new NamespaceNotFoundException();
        }

        writeArchitectureToMongo(architecture);
        return architecture;
    }

    private void writeArchitectureToMongo(Architecture architecture) throws ArchitectureNotFoundException, NamespaceNotFoundException {
        retrieveArchitectureVersions(architecture);

        Document filter = new Document("namespace", architecture.getNamespace())
                .append("architectures.architectureId", architecture.getId());

        Document update = new Document("$set", new Document("architectures.$.versions." + architecture.getMongoVersion(), Document.parse(architecture.getArchitectureJson()))
                .append("architectures.$.name", architecture.getName())
                .append("architectures.$.description", architecture.getDescription())
        );

        try {
            architectureCollection.updateOne(filter, update, new UpdateOptions().upsert(true));
        } catch (MongoWriteException ex) {
            log.error("Failed to write architecture to mongo [{}]", architecture, ex);
            throw new ArchitectureNotFoundException();
        }
    }

}