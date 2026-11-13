package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.nitrite.NitriteDecoratorStore;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.dizitart.no2.filters.FluentFilter.where;
import static org.finos.calm.store.nitrite.NitriteDecoratorStore.DECORATOR_FIELD;
import static org.finos.calm.store.nitrite.NitriteDecoratorStore.DECORATOR_ID_FIELD;
import static org.finos.calm.store.nitrite.NitriteDecoratorStore.NAMESPACE_FIELD;

/**
 * NitriteDB counterpart to {@link MongoDecoratorSplitStep}: splits each namespace document
 * into one document per decorator. Version 16 → 17, gated on a different
 * {@code calm.database.mode}, so the two never coexist. See
 * {@code calm-hub/decisions/0019-decorator-storage-one-document-per-decorator.md}.
 *
 * <p>Same rules as the Mongo step: a duplicate ID stops the step before it writes, entries
 * without an ID or content move to {@code decoratorsUnmigrated}, and the old document is
 * removed last, so a second run after a failure is safe.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteDecoratorSplitStep implements SchemaMigrationStep {

    static final String UNMIGRATED_COLLECTION = "decoratorsUnmigrated";

    private static final Logger LOG = LoggerFactory.getLogger(NitriteDecoratorSplitStep.class);
    private static final String OLD_ARRAY_FIELD = "decorators";

    private final NitriteCollection decorators;
    private final NitriteCollection unmigrated;

    @Inject
    public NitriteDecoratorSplitStep(@StandaloneQualifier Nitrite db) {
        this.decorators = db.getCollection(NitriteDecoratorStore.COLLECTION_NAME);
        this.unmigrated = db.getCollection(UNMIGRATED_COLLECTION);
    }

    @Override
    public int fromVersion() {
        return 16;
    }

    @Override
    public void apply() {
        migrate();
    }

    /** Public, matching the other split steps, so that integration tests can call it. */
    public void migrate() {
        List<Document> oldDocuments = new ArrayList<>();
        decorators.find().forEach(doc -> {
            if (doc.get(OLD_ARRAY_FIELD) != null) {
                oldDocuments.add(doc);
            }
        });

        int split = 0;
        for (Document old : oldDocuments) {
            split += splitNamespaceDocument(old);
        }
        LOG.info("Decorator split complete: {} namespace document(s), {} decorator(s)", oldDocuments.size(), split);
    }

    private int splitNamespaceDocument(Document old) {
        String namespace = old.get(NAMESPACE_FIELD, String.class);
        List<Document> entries = new TypeSafeNitriteDocument<>(old, Document.class).getList(OLD_ARRAY_FIELD);
        List<Document> valid = new ArrayList<>();
        List<Document> invalid = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();

        for (Document entry : entries == null ? List.<Document>of() : entries) {
            Integer id = entry.get(DECORATOR_ID_FIELD) instanceof Integer i ? i : null;
            if (id == null || !(entry.get(DECORATOR_FIELD) instanceof Document)) {
                invalid.add(entry);
            } else if (!seen.add(id)) {
                throw new IllegalStateException("Namespace '" + namespace + "' has more than one decorator with id "
                        + id + ". Remove the duplicate, clear the migration lock, then restart CALM Hub.");
            } else {
                valid.add(entry);
            }
        }

        for (Document entry : valid) {
            int id = entry.get(DECORATOR_ID_FIELD, Integer.class);
            Filter byId = Filter.and(where(NAMESPACE_FIELD).eq(namespace), where(DECORATOR_ID_FIELD).eq(id));
            decorators.remove(byId);
            decorators.insert(NitriteDecoratorStore.toStoredDocument(namespace, id, entry.get(DECORATOR_FIELD, Document.class)));
        }

        if (!invalid.isEmpty()) {
            LOG.warn("Namespace '{}': {} decorator entr(ies) without an id or content moved to {}",
                    namespace, invalid.size(), UNMIGRATED_COLLECTION);
            unmigrated.remove(where(NAMESPACE_FIELD).eq(namespace));
            unmigrated.insert(Document.createDocument(NAMESPACE_FIELD, namespace).put(OLD_ARRAY_FIELD, invalid));
        }

        decorators.remove(old);
        return valid.size();
    }
}
