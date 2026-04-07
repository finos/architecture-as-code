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
import org.finos.calm.store.CoreSchemaStore;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MongoDB-backed implementation of {@link CoreSchemaStore}.
 *
 * <h2>Concurrency strategy — idempotent create</h2>
 * A unique index on {@code schemas.version} (created by {@link MongoIndexInitializer})
 * prevents duplicate schema versions. Unlike the namespace and domain stores, this class
 * treats a {@code DUPLICATE_KEY} error as a <em>no-op</em> rather than an error:
 * if a schema version already exists, the insert is silently ignored. This makes
 * {@link #createSchemaVersion} idempotent — calling it twice with the same version
 * has no additional effect and does not throw an exception.
 *
 * <p>This is intentional because core schemas are typically loaded during application
 * bootstrap and may be re-applied on restart.
 *
 * @see MongoIndexInitializer
 */
@ApplicationScoped
@Typed(MongoCoreSchemaStore.class)
public class MongoCoreSchemaStore implements CoreSchemaStore {

    private final MongoCollection<Document> schemaCollection;

    public MongoCoreSchemaStore(MongoDatabase database) {
        this.schemaCollection = database.getCollection("schemas");
    }

    @Override
    public List<String> getVersions() {
        List<String> versions = new ArrayList<>();
        for (Document doc : schemaCollection.find()) {
            versions.add(doc.getString("version"));
        }
        return versions;
    }

    @Override
    public Map<String, Object> getSchemasForVersion(String version) {
        Bson filter = Filters.eq("version", version);
        Document document = schemaCollection.find(filter).first();

        if (document != null) {
            Map<?, ?> rawMap = document.get("schemas", Map.class);
            Map<String, Object> typedMap = new HashMap<>();
            if (rawMap != null) {
                // Convert entries ensuring keys are Strings. Values can be any Object (schemas themselves
                // are typically nested Maps representing JSON Schema documents). Previous implementation
                // incorrectly iterated over entrySet and attempted to cast Map.Entry to Map, producing
                // an always-empty result. This corrected logic simply copies the mapping.
                for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                    Object key = entry.getKey();
                    if (key instanceof String) {
                        typedMap.put((String) key, entry.getValue());
                    }
                }
            }
            return typedMap;
        }

        return null;
    }

    /**
     * Creates a new schema version document. If the version already exists (detected via
     * the unique index on {@code schemas.version}), the {@code DUPLICATE_KEY} error is
     * silently ignored, making this operation idempotent.
     */
    @Override
    public void createSchemaVersion(String version, Map<String, Object> schemas) {
        try {
            Document schemaDoc = new Document()
                    .append("version", version)
                    .append("schemas", schemas);
            schemaCollection.insertOne(schemaDoc);
        } catch (MongoWriteException e) {
            if (ErrorCategory.fromErrorCode(e.getError().getCode()) == ErrorCategory.DUPLICATE_KEY) {
                // Schema version already exists, silently ignore (idempotent create)
                return;
            }
            throw e;
        }
    }
}
