package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Projections;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.MongoVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Backfills the denormalized title onto every existing ADR header that doesn't have one yet.
 *
 * <p>Version 10 → 11 of the schema. Runs after {@link MongoAdrVersionSplitStep} (version 8 →
 * 9), so every header this step sees is already in the header/version shape — it only ever
 * reads and writes through {@link MongoVersionDocumentStore}, the same helper
 * {@code MongoAdrStore} now uses to keep new headers' titles current. See
 * {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md} for why the title
 * moved onto the header at all.
 *
 * <h2>Idempotency</h2>
 * A header already carrying a non-blank {@code name} is left alone — that's true of every
 * header this step has already visited, and of any header the application itself created or
 * updated (through {@code MongoAdrStore}) since this step last ran partway and failed.
 *
 * <h2>Blank filtered in memory, not by the query</h2>
 * "Untitled" is decided in Java (null or {@link String#isBlank()}), the same rule
 * {@code MongoAdrStore#headerTitle} and {@code resolveTitle} below use — not by the Mongo
 * query, which would need a regex to express "blank or missing" and would be one more query
 * shape to keep in sync with that rule. Matches {@link NitriteAdrTitleBackfillStep}, which
 * has to filter in memory anyway since Nitrite has no query-side filtering worth relying on
 * here.
 *
 * <h2>Why ids are collected before any write</h2>
 * Same reason as {@link MongoVersionSplitMigration}: iterating a cursor while writing through
 * the documents it's reading is not something to rely on, so the untitled headers' identities
 * are collected first (a small, bounded projection) and each is then resolved and written one
 * at a time.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoAdrTitleBackfillStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoAdrTitleBackfillStep.class);

    /** Same placeholder {@code MongoAdrStore} writes for a brand-new ADR with no title. */
    private static final String UNTITLED_ADR = "Untitled ADR";

    private final MongoCollection<Document> headerCollection;
    private final MongoVersionDocumentStore documentStore;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoAdrTitleBackfillStep(MongoDatabase database) {
        this.headerCollection = database.getCollection("adrs");
        this.documentStore = new MongoVersionDocumentStore(
                headerCollection, database.getCollection("adrVersions"), "adrId", "ADR", VersionScheme.NUMERIC);
    }

    @Override
    public int fromVersion() {
        return 10;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping ADR title backfill (database mode: {})", databaseMode);
            return;
        }
        backfill();
    }

    /**
     * Runs the backfill unconditionally — no {@code databaseMode} check. Public for the same
     * reason as the version-split steps': integration tests with a real MongoDB container
     * call it directly.
     */
    public void backfill() {
        List<Document> untitledHeaders = new ArrayList<>();
        headerCollection.find()
                .projection(Projections.include("namespace", "adrId", "name"))
                .forEach(header -> {
                    String name = header.getString("name");
                    if (name == null || name.isBlank()) {
                        untitledHeaders.add(header);
                    }
                });

        int updated = 0;
        for (Document header : untitledHeaders) {
            String namespace = header.getString("namespace");
            Integer adrId = header.getInteger("adrId");
            if (namespace == null || adrId == null) {
                // A malformed header search already renders and ignores elsewhere — not this
                // step's job to fail the whole backfill over one bad document.
                LOG.warn("Skipping ADR header with no namespace/adrId during title backfill");
                continue;
            }
            documentStore.updatePresentHeaderDetails(namespace, adrId, resolveTitle(namespace, adrId), null);
            updated++;
        }
        LOG.info("ADR title backfill complete: {} header(s) updated", updated);
    }

    private String resolveTitle(String namespace, int adrId) {
        Document latest = documentStore.getLatestVersionContent(namespace, adrId);
        String title = latest == null ? null : latest.getString("title");
        return title == null || title.isBlank() ? UNTITLED_ADR : title;
    }
}
