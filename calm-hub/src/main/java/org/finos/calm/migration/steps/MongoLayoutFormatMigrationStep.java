package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Migrates layout documents from the legacy {@code pins} array format to the new {@code nodes}
 * map format, which aligns with the VS Code plugin's {@code metadata._layout} shape and includes
 * width/height for deterministic rendering.
 *
 * <h2>Legacy format (pins)</h2>
 * <pre>{@code
 * { "for": "...", "pins": [{ "unique-id": "node-a", "position": { "x": 0, "y": 0 } }] }
 * }</pre>
 *
 * <h2>New format (nodes)</h2>
 * <pre>{@code
 * { "for": "...", "nodes": { "node-a": { "x": 0, "y": 0 } } }
 * }</pre>
 *
 * <p>Idempotent: documents that already have a {@code nodes} map (or no {@code pins} field) are
 * skipped. Positions without width/height are migrated as-is — the frontend handles missing
 * dimensions gracefully by falling back to reflow.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoLayoutFormatMigrationStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoLayoutFormatMigrationStep.class);
    private static final String COLLECTION = "layouts";
    private static final String LAYOUT_FIELD = "layout";

    private final MongoDatabase database;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoLayoutFormatMigrationStep(MongoDatabase database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 14;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping layout format migration (database mode: {})", databaseMode);
            return;
        }
        migrateLayouts();
    }

    public void migrateLayouts() {
        MongoCollection<Document> layouts = database.getCollection(COLLECTION);
        int migrated = 0;
        int skipped = 0;

        for (Document doc : layouts.find()) {
            Document layoutDoc = doc.get(LAYOUT_FIELD, Document.class);
            if (layoutDoc == null) {
                skipped++;
                continue;
            }

            if (layoutDoc.containsKey("nodes")) {
                skipped++;
                continue;
            }

            List<Document> pins = layoutDoc.getList("pins", Document.class);
            if (pins == null) {
                skipped++;
                continue;
            }

            Document nodesMap = new Document();
            for (Document pin : pins) {
                String uniqueId = pin.getString("unique-id");
                if (uniqueId == null) continue;
                Document position = pin.get("position", Document.class);
                if (position == null) continue;

                Document entry = new Document("x", position.get("x")).append("y", position.get("y"));
                nodesMap.append(uniqueId, entry);
            }

            layoutDoc.remove("pins");
            layoutDoc.append("nodes", nodesMap);

            layouts.replaceOne(new Document("_id", doc.getObjectId("_id")), doc);
            migrated++;
        }

        LOG.info("Layout format migration complete: {} migrated, {} skipped", migrated, skipped);
    }
}
