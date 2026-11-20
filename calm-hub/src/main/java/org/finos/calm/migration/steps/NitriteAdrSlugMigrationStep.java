package org.finos.calm.migration.steps;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.index.IndexOptions;
import org.dizitart.no2.index.IndexType;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.AdrSlugAllocator;
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB counterpart to {@link MongoAdrSlugMigrationStep}: gives every existing ADR header
 * a slug, with the same deterministic collision suffixes, then creates a unique
 * {@code (namespace, slug)} index.
 *
 * <p>Version 16 → 17. Nitrite's unique index cannot be partial: headers without a slug
 * collide with each other, and a failed {@code createIndex} still leaves the index
 * registered. So the index is only created once every header has a namespace and a slug.
 * {@code NitriteAdrStore} does not depend on it; see that class for why.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteAdrSlugMigrationStep implements SchemaMigrationStep {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteAdrSlugMigrationStep.class);
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ID_FIELD = "adrId";
    private static final String SLUG_FIELD = "slug";

    private final NitriteCollection headerCollection;
    private final NitriteVersionDocumentStore documentStore;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public NitriteAdrSlugMigrationStep(@StandaloneQualifier Nitrite db) {
        this.headerCollection = db.getCollection("adrs");
        this.documentStore = new NitriteVersionDocumentStore(
                headerCollection, db.getCollection("adrVersions"), ID_FIELD, "ADR", VersionScheme.NUMERIC);
    }

    @Override
    public int fromVersion() {
        return 16;
    }

    @Override
    public void apply() {
        backfill();
        createIndexes();
    }

    public void backfill() {
        Map<String, Set<String>> slugsByNamespace = new HashMap<>();
        List<Document> unslugged = new ArrayList<>();
        for (Document header : headerCollection.find()) {
            String namespace = header.get(NAMESPACE_FIELD, String.class);
            if (namespace == null || header.get(ID_FIELD, Integer.class) == null) {
                LOG.warn("Skipping ADR header with no namespace/adrId during slug migration");
                continue;
            }
            String slug = header.get(SLUG_FIELD, String.class);
            if (slug != null) {
                slugsByNamespace.computeIfAbsent(namespace, ns -> new HashSet<>()).add(slug);
            } else {
                unslugged.add(header);
            }
        }
        unslugged.sort(Comparator.comparing((Document header) -> header.get(NAMESPACE_FIELD, String.class))
                .thenComparing(header -> header.get(ID_FIELD, Integer.class)));

        for (Document header : unslugged) {
            String namespace = header.get(NAMESPACE_FIELD, String.class);
            int adrId = header.get(ID_FIELD, Integer.class);
            Set<String> taken = slugsByNamespace.computeIfAbsent(namespace, ns -> new HashSet<>());
            String slug = AdrSlugAllocator.allocateDerived(firstTitle(namespace, adrId), adrId, taken::add);
            header.put(SLUG_FIELD, slug);
            headerCollection.update(where(NAMESPACE_FIELD).eq(namespace).and(where(ID_FIELD).eq(adrId)), header);
        }
        LOG.info("ADR slug migration complete: {} header(s) given a slug", unslugged.size());
    }

    public void createIndexes() {
        if (headerCollection.hasIndex(NAMESPACE_FIELD, SLUG_FIELD)) {
            return;
        }
        for (Document header : headerCollection.find()) {
            if (header.get(NAMESPACE_FIELD, String.class) == null || header.get(SLUG_FIELD, String.class) == null) {
                LOG.warn("Not creating the unique (namespace, slug) index on adrs: a header has no namespace or slug");
                return;
            }
        }
        headerCollection.createIndex(IndexOptions.indexOptions(IndexType.UNIQUE), NAMESPACE_FIELD, SLUG_FIELD);
        LOG.info("Ensured unique index on adrs.(namespace, slug)");
    }

    /** Revision 1's title, or the earliest revision's if revision 1 is gone. */
    private String firstTitle(String namespace, int adrId) {
        String first = documentStore.getVersion(namespace, adrId, "1");
        if (first == null) {
            List<String> revisions = documentStore.listVersions(namespace, adrId);
            first = revisions.isEmpty() ? null : documentStore.getVersion(namespace, adrId, revisions.get(0));
        }
        return first == null ? null : titleOf(first);
    }

    private String titleOf(String content) {
        try {
            JsonNode title = objectMapper.readTree(content).get("title");
            return title == null || !title.isTextual() ? null : title.asText();
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
