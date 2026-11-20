package org.finos.calm.migration.steps;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.model.Updates;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.bson.Document;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.AdrSlugAllocator;
import org.finos.calm.store.util.MongoVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Gives every existing ADR header a slug, then creates the unique {@code (namespace, slug)}
 * index that {@code MongoAdrStore} relies on to keep slugs unique.
 *
 * <p>Version 16 → 17. The slug is derived from revision 1's title, as for a new ADR
 * ({@link AdrSlugAllocator}). Headers are visited in ascending {@code adrId} order within a
 * namespace, so when two titles give the same slug the older ADR keeps it and the newer one
 * gets {@code -2}, {@code -3}, ... — the same result on every run.</p>
 *
 * <h2>Idempotency</h2>
 * A header that already has a slug keeps it, and its slug is reserved before any other is
 * assigned. {@code createIndex} is a no-op when the index already exists.
 *
 * <h2>Partial index</h2>
 * The index covers only headers whose slug is a string, so a header without one (written by
 * an older instance during a rolling upgrade) cannot collide with another.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
public class MongoAdrSlugMigrationStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(MongoAdrSlugMigrationStep.class);
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ID_FIELD = "adrId";
    private static final String SLUG_FIELD = "slug";

    private final MongoCollection<Document> headerCollection;
    private final MongoVersionDocumentStore documentStore;

    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    public MongoAdrSlugMigrationStep(MongoDatabase database) {
        this.headerCollection = database.getCollection("adrs");
        this.documentStore = new MongoVersionDocumentStore(
                headerCollection, database.getCollection("adrVersions"), ID_FIELD, "ADR", VersionScheme.NUMERIC);
    }

    @Override
    public int fromVersion() {
        return 16;
    }

    @Override
    public void apply() {
        if (!"mongo".equals(databaseMode)) {
            LOG.info("Skipping ADR slug migration (database mode: {})", databaseMode);
            return;
        }
        backfill();
        createIndexes();
    }

    /** Public, like the other steps, so integration tests can run it against a real MongoDB. */
    public void backfill() {
        Map<String, Set<String>> slugsByNamespace = new HashMap<>();
        List<Document> unslugged = new ArrayList<>();
        headerCollection.find()
                .projection(Projections.include(NAMESPACE_FIELD, ID_FIELD, SLUG_FIELD))
                .sort(Sorts.ascending(NAMESPACE_FIELD, ID_FIELD))
                .forEach(header -> {
                    String namespace = header.getString(NAMESPACE_FIELD);
                    if (namespace == null || header.getInteger(ID_FIELD) == null) {
                        LOG.warn("Skipping ADR header with no namespace/adrId during slug migration");
                        return;
                    }
                    String slug = header.getString(SLUG_FIELD);
                    if (slug != null) {
                        slugsByNamespace.computeIfAbsent(namespace, ns -> new HashSet<>()).add(slug);
                    } else {
                        unslugged.add(header);
                    }
                });

        for (Document header : unslugged) {
            String namespace = header.getString(NAMESPACE_FIELD);
            int adrId = header.getInteger(ID_FIELD);
            Set<String> taken = slugsByNamespace.computeIfAbsent(namespace, ns -> new HashSet<>());
            String slug = AdrSlugAllocator.allocateDerived(firstTitle(namespace, adrId), adrId, taken::add);
            headerCollection.updateOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, namespace), Filters.eq(ID_FIELD, adrId)),
                    Updates.set(SLUG_FIELD, slug));
        }
        LOG.info("ADR slug migration complete: {} header(s) given a slug", unslugged.size());
    }

    public void createIndexes() {
        headerCollection.createIndex(
                new Document(NAMESPACE_FIELD, 1).append(SLUG_FIELD, 1),
                new IndexOptions().unique(true)
                        .partialFilterExpression(new Document(SLUG_FIELD, new Document("$type", "string"))));
        LOG.info("Ensured unique partial index on adrs.(namespace, slug)");
    }

    /** Revision 1's title, or the earliest revision's if revision 1 is gone. */
    private String firstTitle(String namespace, int adrId) {
        Document first = documentStore.getVersion(namespace, adrId, "1");
        if (first == null) {
            List<String> revisions = documentStore.listVersions(namespace, adrId);
            first = revisions.isEmpty() ? null : documentStore.getVersion(namespace, adrId, revisions.get(0));
        }
        return first == null ? null : first.getString("title");
    }
}
