package org.finos.calm.migration.steps;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * NitriteDB counterpart to {@link MongoLayoutFormatMigrationStep}: migrates layout documents
 * from the legacy {@code pins} array format to the new {@code nodes} map format.
 *
 * <p>Both steps declare {@code fromVersion() == 14} but never coexist — each is gated by
 * {@code @LookupIfProperty} on a different value of {@code calm.database.mode}, so exactly
 * one is a CDI bean in any given deployment.</p>
 *
 * <p>In Nitrite the {@code layout} field is a raw JSON string (unlike Mongo's parsed Document),
 * so the migration parses the string, transforms it, and writes it back.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteLayoutFormatMigrationStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteLayoutFormatMigrationStep.class);
    private static final String COLLECTION_NAME = "layouts";
    private static final String LAYOUT_FIELD = "layout";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final NitriteCollection layoutCollection;

    @Inject
    public NitriteLayoutFormatMigrationStep(@StandaloneQualifier Nitrite db) {
        this.layoutCollection = db.getCollection(COLLECTION_NAME);
    }

    @Override
    public int fromVersion() {
        return 14;
    }

    @Override
    public void apply() {
        migrateLayouts();
    }

    void migrateLayouts() {
        int migrated = 0;
        int skipped = 0;

        for (Document doc : layoutCollection.find()) {
            String layoutJson = doc.get(LAYOUT_FIELD, String.class);
            if (layoutJson == null) {
                skipped++;
                continue;
            }

            try {
                Map<String, Object> layout = MAPPER.readValue(layoutJson, new TypeReference<>() {});

                if (layout.containsKey("nodes")) {
                    skipped++;
                    continue;
                }

                Object pinsObj = layout.get("pins");
                if (!(pinsObj instanceof List<?> pins)) {
                    skipped++;
                    continue;
                }

                Map<String, Object> nodesMap = new LinkedHashMap<>();
                for (Object pinObj : pins) {
                    if (!(pinObj instanceof Map<?, ?> pin)) continue;
                    Object uniqueId = pin.get("unique-id");
                    if (!(uniqueId instanceof String id)) continue;
                    Object position = pin.get("position");
                    if (!(position instanceof Map<?, ?> pos)) continue;

                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("x", pos.get("x"));
                    entry.put("y", pos.get("y"));
                    nodesMap.put(id, entry);
                }

                layout.remove("pins");
                layout.put("nodes", nodesMap);

                doc.put(LAYOUT_FIELD, MAPPER.writeValueAsString(layout));
                layoutCollection.update(doc);
                migrated++;
            } catch (JsonProcessingException e) {
                LOG.warn("Skipping layout document with unparseable JSON: {}", e.getMessage());
                skipped++;
            }
        }

        LOG.info("Nitrite layout format migration complete: {} migrated, {} skipped", migrated, skipped);
    }
}
