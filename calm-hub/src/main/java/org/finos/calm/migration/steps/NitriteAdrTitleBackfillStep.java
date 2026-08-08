package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * NitriteDB counterpart to {@link MongoAdrTitleBackfillStep}: backfills the denormalized
 * title onto every existing ADR header that doesn't have one yet.
 *
 * <p>Version 10 → 11 of the schema, matching the Mongo step's {@code fromVersion()} — the
 * two are gated by mutually exclusive {@code @LookupIfProperty} values, so
 * {@code SchemaMigrationRunner}'s duplicate-{@code fromVersion} guard never sees both as CDI
 * beans at once. See {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}.
 *
 * <p>Reads headers with a plain unfiltered {@code find()} rather than a Nitrite filter on a
 * missing/null field: Nitrite creates no indexes at all (see
 * {@code NitriteVersionDocumentStore}'s javadoc), so a filtered scan costs the same as an
 * unfiltered one here, and it matches how the rest of this class's Nitrite siblings
 * (e.g. {@code NitriteVersionDocumentStore#listSummariesPaged}) already filter in memory.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteAdrTitleBackfillStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteAdrTitleBackfillStep.class);

    /** Same placeholder {@code NitriteAdrStore} writes for a brand-new ADR with no title. */
    private static final String UNTITLED_ADR = "Untitled ADR";

    private final NitriteCollection headerCollection;
    private final NitriteVersionDocumentStore documentStore;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public NitriteAdrTitleBackfillStep(@StandaloneQualifier Nitrite db) {
        this.headerCollection = db.getCollection("adrs");
        this.documentStore = new NitriteVersionDocumentStore(
                headerCollection, db.getCollection("adrVersions"), "adrId", "ADR", VersionScheme.NUMERIC);
    }

    @Override
    public int fromVersion() {
        return 10;
    }

    @Override
    public void apply() {
        backfill();
    }

    /** Public, matching the version-split steps, so integration tests can call it directly. */
    public void backfill() {
        List<Document> untitledHeaders = new ArrayList<>();
        for (Document header : headerCollection.find()) {
            String name = header.get("name", String.class);
            if (name == null || name.isBlank()) {
                untitledHeaders.add(header);
            }
        }

        int updated = 0;
        for (Document header : untitledHeaders) {
            String namespace = header.get("namespace", String.class);
            Integer adrId = header.get("adrId", Integer.class);
            if (namespace == null || adrId == null) {
                LOG.warn("Skipping ADR header with no namespace/adrId during title backfill");
                continue;
            }
            documentStore.updatePresentHeaderDetails(namespace, adrId, resolveTitle(namespace, adrId), null);
            updated++;
        }
        LOG.info("ADR title backfill complete: {} header(s) updated", updated);
    }

    private String resolveTitle(String namespace, int adrId) {
        String latest = documentStore.getLatestVersionContent(namespace, adrId);
        String title = latest == null ? null : titleOf(latest);
        return title == null || title.isBlank() ? UNTITLED_ADR : title;
    }

    /**
     * Content is a JSON string on this backend, matching the parser
     * {@code NitriteAdrStore}/the old {@code NitriteSearchStore} used.
     */
    private String titleOf(String content) {
        try {
            JsonNode title = objectMapper.readTree(content).get("title");
            return title == null || !title.isTextual() ? null : title.asText();
        } catch (JsonProcessingException | RuntimeException e) {
            return null;
        }
    }
}
