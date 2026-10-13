package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.store.ArchitectureSchema;
import org.finos.calm.store.PatternImplementationStore;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * MongoDB-backed implementation of {@link PatternImplementationStore}.
 *
 * <p>The path filter runs in the database, so only candidate rows cross the wire. Measured over
 * 3000 architecture versions at ~40KB each, matching in the database took 1.4ms against 63ms to
 * pull every body across and filter it in Java (ADR 0008).</p>
 *
 * <p>MongoDB refuses a {@code $}-prefixed field in an index and in a plain projection, so the
 * {@code $schema} value is read through {@code $objectToArray}. MongoDB 4.4, which the integration
 * suite runs, has no {@code $getField}.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoPatternImplementationStore.class)
public class MongoPatternImplementationStore implements PatternImplementationStore {

    private static final String SCHEMA_FIELD = "content.$schema";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String VERSION_FIELD = "version";
    private static final String SCHEMA_VALUE = "schema";

    /** The value of the {@code content} entry whose key is {@code $schema}. */
    private static final Bson SCHEMA_EXPRESSION = new Document("$let", new Document()
            .append("vars", new Document("entry", new Document("$arrayElemAt", List.of(
                    new Document("$filter", new Document("input", new Document("$objectToArray", "$content"))
                            .append("cond", new Document("$eq", List.of("$$this.k", new Document("$literal", "$schema"))))),
                    0))))
            .append("in", "$$entry.v"));

    private final MongoCollection<Document> architectureVersions;

    public MongoPatternImplementationStore(MongoDatabase database) {
        this.architectureVersions = database.getCollection("architectureVersions");
    }

    @Override
    public List<ArchitectureSchema> findSchemasContaining(String schemaPath, Optional<Set<String>> readableNamespaces) {
        Bson filter = Filters.and(readableScope(readableNamespaces),
                Filters.regex(SCHEMA_FIELD, Pattern.quote(schemaPath)));
        Bson projection = Projections.fields(
                Projections.include(NAMESPACE_FIELD, ARCHITECTURE_ID_FIELD, VERSION_FIELD),
                Projections.computed(SCHEMA_VALUE, SCHEMA_EXPRESSION));

        List<ArchitectureSchema> candidates = new ArrayList<>();
        for (Document document : architectureVersions.find(filter).projection(projection)) {
            // A row with no id or namespace cannot be addressed, and a field of the wrong type
            // would make the typed getters throw.
            if (document.get(ARCHITECTURE_ID_FIELD) instanceof Integer architectureId
                    && document.get(NAMESPACE_FIELD) instanceof String namespace
                    && document.get(SCHEMA_VALUE) instanceof String schema) {
                candidates.add(new ArchitectureSchema(
                        namespace, architectureId, document.getString(VERSION_FIELD), schema));
            }
        }
        return candidates;
    }

    private Bson readableScope(Optional<Set<String>> readableNamespaces) {
        return readableNamespaces
                .<Bson>map(namespaces -> Filters.in(NAMESPACE_FIELD, namespaces))
                .orElseGet(Filters::empty);
    }
}
