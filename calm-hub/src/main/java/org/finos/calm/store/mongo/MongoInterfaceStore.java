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
import org.finos.calm.domain.CalmInterface;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.interfaces.NamespaceInterfaceSummary;
import org.finos.calm.store.InterfaceStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * MongoDB-backed implementation of {@link InterfaceStore}.
 *
 * <h2>Document model &amp; concurrency</h2>
 * Follows the same namespace-scoped document pattern as {@link MongoArchitectureStore}:
 * one document per namespace (enforced by a unique index on {@code interfaces.namespace}),
 * with an array of interface sub-documents. New interfaces are added via upsert + {@code $push},
 * and new versions use an atomic conditional update with {@code $elemMatch} /
 * {@code $exists: false} to prevent duplicate version creation under concurrency.
 * Unique interface IDs are generated atomically by {@link MongoCounterStore}.
 *
 * @see MongoIndexInitializer
 * @see MongoCounterStore
 */
@ApplicationScoped
@Typed(MongoInterfaceStore.class)
public class MongoInterfaceStore implements InterfaceStore {

    private static final Logger logger = LoggerFactory.getLogger(MongoInterfaceStore.class);

    private final MongoCounterStore counterStore;
    private final MongoNamespaceStore namespaceStore;
    private final MongoCollection<Document> interfaceCollection;

    public MongoInterfaceStore(MongoDatabase database, MongoCounterStore mongoCounterStore, MongoNamespaceStore mongoNamespaceStore) {
        this.counterStore = mongoCounterStore;
        this.namespaceStore = mongoNamespaceStore;
        this.interfaceCollection = database.getCollection("interfaces");
    }

    @Override
    public List<NamespaceInterfaceSummary> getInterfacesForNamespace(String namespace) throws NamespaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Document namespaceDocument = interfaceCollection.find(Filters.eq("namespace", namespace)).first();

        if (namespaceDocument == null) {
            return List.of();
        }

        List<Document> interfaces = namespaceDocument.getList("interfaces", Document.class);
        List<NamespaceInterfaceSummary> namespaceInterfaceSummary = new ArrayList<>();

        for (Document interfaceDoc : interfaces) {
            NamespaceInterfaceSummary summary = new NamespaceInterfaceSummary(
                    interfaceDoc.getString("name"),
                    interfaceDoc.getString("description"),
                    interfaceDoc.getInteger("interfaceId")
            );
            namespaceInterfaceSummary.add(summary);
        }

        return namespaceInterfaceSummary;
    }

    @Override
    public CalmInterface createInterfaceForNamespace(CreateInterfaceRequest interfaceRequest, String namespace) throws NamespaceNotFoundException {
        CalmInterface createdInterface = new CalmInterface(interfaceRequest);
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        int id = counterStore.getNextInterfaceSequenceValue();
        Document interfaceDocument = new Document("interfaceId", id)
                .append("name", interfaceRequest.getName())
                .append("description", interfaceRequest.getDescription())
                .append("versions",
                        new Document("1-0-0", Document.parse(interfaceRequest.getInterfaceJson())));

        interfaceCollection.updateOne(
                Filters.eq("namespace", namespace),
                Updates.push("interfaces", interfaceDocument),
                new UpdateOptions().upsert(true));

        createdInterface.setId(id);
        createdInterface.setVersion("1.0.0");

        return createdInterface;
    }

    @Override
    public List<String> getInterfaceVersions(String namespace, Integer interfaceId) throws NamespaceNotFoundException, InterfaceNotFoundException {
        Document result = retrieveInterfaceVersions(namespace);

        List<Document> interfaces = result.getList("interfaces", Document.class);
        for (Document interfaceDoc : interfaces) {
            if (interfaceId.equals(interfaceDoc.getInteger("interfaceId"))) {
                Document versions = (Document) interfaceDoc.get("versions");
                Set<String> versionKeys = versions.keySet();

                List<String> resourceVersions = new ArrayList<>();
                for (String versionKey : versionKeys) {
                    resourceVersions.add(versionKey.replace('-', '.'));
                }
                return resourceVersions;
            }
        }

        throw new InterfaceNotFoundException();
    }

    private Document retrieveInterfaceVersions(String namespace) throws NamespaceNotFoundException, InterfaceNotFoundException {
        if (!namespaceStore.namespaceExists(namespace)) {
            throw new NamespaceNotFoundException();
        }

        Bson filter = new Document("namespace", namespace);
        Bson projection = Projections.fields(Projections.include("interfaces"));

        Document result = interfaceCollection.find(filter).projection(projection).first();

        if (result == null) {
            throw new InterfaceNotFoundException();
        }

        return result;
    }

    @Override
    public String getInterfaceForVersion(String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionNotFoundException {
        Document result = retrieveInterfaceVersions(namespace);
        List<Document> interfaces = result.getList("interfaces", Document.class);
        for (Document interfaceDoc : interfaces) {
            if (interfaceId.equals(interfaceDoc.getInteger("interfaceId"))) {
                Document versions = (Document) interfaceDoc.get("versions");
                Document versionDoc = (Document) versions.get(version.replace('.', '-'));
                if (versionDoc == null) {
                    throw new InterfaceVersionNotFoundException();
                }
                return versionDoc.toJson();
            }
        }
        throw new InterfaceNotFoundException();
    }

    @Override
    public CalmInterface createInterfaceForVersion(CreateInterfaceRequest interfaceRequest, String namespace, Integer interfaceId, String version) throws NamespaceNotFoundException, InterfaceNotFoundException, InterfaceVersionExistsException {
        // Validates namespace and interface existence
        getInterfaceVersions(namespace, interfaceId);

        String mongoVersion = version.replace('.', '-');

        // Atomic conditional update: only succeeds if the version doesn't already exist
        Document filter = new Document("namespace", namespace)
                .append("interfaces", new Document("$elemMatch",
                        new Document("interfaceId", interfaceId)
                                .append("versions." + mongoVersion, new Document("$exists", false))));

        Document update = new Document("$set", new Document()
                .append("interfaces.$.name", interfaceRequest.getName())
                .append("interfaces.$.description", interfaceRequest.getDescription())
                .append("interfaces.$.versions." + mongoVersion, Document.parse(interfaceRequest.getInterfaceJson())));

        if (interfaceCollection.updateOne(filter, update).getMatchedCount() == 0) {
            throw new InterfaceVersionExistsException();
        }

        CalmInterface calmInterface = new CalmInterface(interfaceRequest);
        calmInterface.setId(interfaceId);
        calmInterface.setVersion(version);
        return calmInterface;
    }
}
