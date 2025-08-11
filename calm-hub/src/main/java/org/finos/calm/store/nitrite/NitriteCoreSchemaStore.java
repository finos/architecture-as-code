package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.store.CoreSchemaStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * Implementation of the CoreSchemaStore interface using NitriteDB.
 * This implementation is used when the application is running in standalone mode.
 */
@ApplicationScoped
@Typed(NitriteCoreSchemaStore.class)
public class NitriteCoreSchemaStore implements CoreSchemaStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteCoreSchemaStore.class);
    private static final String COLLECTION_NAME = "schemas";
    private static final String VERSION_FIELD = "version";
    private static final String SCHEMAS_FIELD = "schemas";

    private final NitriteCollection schemaCollection;

    @Inject
    public NitriteCoreSchemaStore(@StandaloneQualifier Nitrite db) {
        this.schemaCollection = db.getCollection(COLLECTION_NAME);
        LOG.info("NitriteCoreSchemaStore initialized with collection: {}", COLLECTION_NAME);
    }

    @Override
    public List<String> getVersions() {
        List<String> versions = new ArrayList<>();
        
        for (Document doc : schemaCollection.find()) {
            String version = doc.get(VERSION_FIELD, String.class);
            if (version != null) {
                versions.add(version);
            }
        }
        
        LOG.debug("Retrieved {} schema versions", versions.size());
        return versions;
    }

    @Override
    public Map<String, Object> getSchemasForVersion(String version) {
        Filter filter = where(VERSION_FIELD).eq(version);
        TypeSafeNitriteDocument<Object> document = new TypeSafeNitriteDocument<>(schemaCollection.find(filter).firstOrNull(), Object.class);

        Map<String, Object> schemas = document.getMap(SCHEMAS_FIELD);
        LOG.debug("Retrieved schemas for version '{}'", version);
        return schemas;
    }

    @Override
    public void createSchemaVersion(String version, Map<String, Object> schemas) {
        // Check if version already exists
        Filter filter = where(VERSION_FIELD).eq(version);
        Document existingDoc = schemaCollection.find(filter).firstOrNull();
        
        if (existingDoc == null) {
            Document schemaDoc = Document.createDocument()
                    .put(VERSION_FIELD, version)
                    .put(SCHEMAS_FIELD, schemas);
            schemaCollection.insert(schemaDoc);
            LOG.info("Created schema version: {}", version);
        } else {
            LOG.debug("Schema version '{}' already exists, skipping creation", version);
        }
    }
}
