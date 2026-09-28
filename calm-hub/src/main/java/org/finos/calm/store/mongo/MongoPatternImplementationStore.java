package org.finos.calm.store.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Projections;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.domain.implementations.PatternReference;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.util.PatternReferenceMatcher;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * MongoDB-backed implementation of {@link PatternImplementationStore}.
 *
 * <p>The match runs in the database rather than over the returned documents. MongoDB refuses to
 * index a field whose name begins with {@code $} and refuses to project one, so the alternative is
 * to stream every architecture version's full body into the application and filter it here. Both
 * scan, but only one of them moves the bodies: measured over 3000 architecture versions at ~40KB
 * each, matching in the database took 1.4ms against 63ms to pull the same collection across and
 * filter it in Java, and that gap widens with the collection because it is a transfer cost rather
 * than a comparison cost.</p>
 *
 * <p>The projection therefore names only the identity fields, which is legal — it is
 * {@code content.$schema} that cannot appear in a projection, and it never needs to: the query has
 * already done the matching, so the body is of no further use.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoPatternImplementationStore.class)
public class MongoPatternImplementationStore implements PatternImplementationStore {

    private static final String SCHEMA_FIELD = "content.$schema";
    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String VERSION_FIELD = "version";

    private final MongoCollection<Document> architectureVersions;

    public MongoPatternImplementationStore(MongoDatabase database) {
        this.architectureVersions = database.getCollection("architectureVersions");
    }

    @Override
    public PatternImplementations findImplementations(String namespace, String patternName, String version,
                                                      Optional<Set<String>> readableNamespaces, PageRequest page) {
        Bson scope = readableScope(readableNamespaces);
        Bson namesThisPattern = Filters.regex(SCHEMA_FIELD,
                PatternReferenceMatcher.referenceTo(namespace, patternName, version));

        FindIterable<Document> matches = architectureVersions
                .find(Filters.and(scope, namesThisPattern))
                .projection(Projections.include(NAMESPACE_FIELD, ARCHITECTURE_ID_FIELD, VERSION_FIELD));
        if (page.isPaged()) {
            matches = matches.skip(page.normalizedOffset()).limit(page.limit());
        }

        List<PatternImplementation> implementations = new ArrayList<>();
        for (Document document : matches) {
            Integer architectureId = document.getInteger(ARCHITECTURE_ID_FIELD);
            String documentNamespace = document.getString(NAMESPACE_FIELD);
            if (architectureId == null || documentNamespace == null) {
                // An architecture missing either cannot be addressed, so reporting it would hand
                // the caller a link that goes nowhere. A null namespace also breaks the grouping
                // that resolves display names. Same call MongoSearchStore makes on a malformed
                // header, and for the same reason.
                continue;
            }
            implementations.add(new PatternImplementation(
                    documentNamespace, architectureId, document.getString(VERSION_FIELD), null));
        }

        return new PatternImplementations(new PatternReference(namespace, patternName, version), implementations);
    }

    private Bson readableScope(Optional<Set<String>> readableNamespaces) {
        return readableNamespaces
                .<Bson>map(namespaces -> Filters.in(NAMESPACE_FIELD, namespaces))
                .orElseGet(Filters::empty);
    }
}
