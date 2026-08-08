package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.finos.calm.store.util.SearchTextMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * MongoDB-backed implementation of {@link SearchStore}.
 * <p>
 * Searches across 7 resource collections by matching the query (case-insensitive)
 * against the {@code name} and {@code description} fields of each resource entry.
 * ADR's header carries a denormalized copy of the latest revision's title (see
 * {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}), so it reads the
 * same as every other type. Controls are scoped by domain rather than namespace, so they
 * bypass the readable-namespaces filter.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "mongo", lookupIfMissing = true)
@ApplicationScoped
@Typed(MongoSearchStore.class)
public class MongoSearchStore implements SearchStore {

    private final Logger log = LoggerFactory.getLogger(getClass());

    private final MongoCollection<Document> architectureCollection;
    private final MongoCollection<Document> patternCollection;
    private final MongoCollection<Document> flowCollection;
    private final MongoCollection<Document> standardCollection;
    private final MongoCollection<Document> interfaceCollection;
    private final MongoCollection<Document> controlCollection;
    private final MongoCollection<Document> adrCollection;

    public MongoSearchStore(MongoDatabase database) {
        this.architectureCollection = database.getCollection("architectures");
        this.patternCollection = database.getCollection("patterns");
        this.flowCollection = database.getCollection("flows");
        this.standardCollection = database.getCollection("standards");
        this.interfaceCollection = database.getCollection("interfaces");
        this.controlCollection = database.getCollection("controls");
        this.adrCollection = database.getCollection("adrs");
    }

    @Override
    public GroupedSearchResults search(String query, Optional<Set<String>> readableNamespaces) {
        String lowerQuery = query.toLowerCase();

        return new GroupedSearchResults(
                searchHeaderCollection(architectureCollection, "architectureId", lowerQuery, readableNamespaces),
                searchHeaderCollection(patternCollection, "patternId", lowerQuery, readableNamespaces),
                searchHeaderCollection(flowCollection, "flowId", lowerQuery, readableNamespaces),
                searchHeaderCollection(standardCollection, "standardId", lowerQuery, readableNamespaces),
                searchHeaderCollection(interfaceCollection, "interfaceId", lowerQuery, readableNamespaces),
                searchControlCollection(lowerQuery),
                searchAdrCollection(lowerQuery, readableNamespaces)
        );
    }

    /**
     * Searches a collection in the header/version shape, where each document <em>is</em> one
     * resource rather than a namespace-wide array of them.
     *
     * <p>This was one of two search paths while ADR 0001's rollout was part-done: the other
     * read a namespace-wide array of entries and was retired once Interface — the last of the
     * five namespaced types — moved to this shape. The failure mode it guarded against is
     * worth remembering for any type still to migrate: leave one on an array-shaped read and
     * {@code getList} returns null for a header document, so every document is skipped and
     * the type silently returns no results at all, with nothing logged.</p>
     */
    private List<SearchResult> searchHeaderCollection(MongoCollection<Document> collection,
                                                      String idField,
                                                      String lowerQuery,
                                                      Optional<Set<String>> readableNamespaces) {
        List<SearchResult> results = new ArrayList<>();

        for (Document header : collection.find()) {
            if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                return results;
            }
            String namespace = header.getString("namespace");
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            Integer id = header.getInteger(idField);
            if (id == null) {
                // Same reason the ADR branch below skips these: SearchResult takes a
                // primitive id, so a header missing its id field unboxes to a
                // NullPointerException thrown out of search() — which builds every type's
                // results eagerly, so one malformed document fails the whole request rather
                // than one resource type. A resource with no id is not addressable anyway.
                //
                // Deliberately unlike the namespace listing, which renders the same malformed
                // header as "<Type> null" rather than hiding it (see
                // NitriteVersionDocumentStore.listSummariesPaged). The two differ because the
                // outputs differ: a search hit is a link the caller is expected to follow, so
                // one that cannot be addressed is worse than absent, whereas a listing row is
                // informational and showing it is how an operator learns the bad header is
                // there. Dropping it from both would hide the problem entirely.
                continue;
            }
            String name = header.getString("name");
            String description = header.getString("description");
            if (SearchTextMatcher.containsIgnoreCase(name, lowerQuery) || SearchTextMatcher.containsIgnoreCase(description, lowerQuery)) {
                results.add(new SearchResult(
                        namespace,
                        id,
                        SearchTextMatcher.nullToEmpty(name),
                        SearchTextMatcher.nullToEmpty(description)
                ));
            }
        }

        return results;
    }


    private List<SearchResult> searchControlCollection(String lowerQuery) {
        List<SearchResult> results = new ArrayList<>();

        for (Document domainDoc : controlCollection.find()) {
            String domain = domainDoc.getString("domain");
            List<Document> controls = domainDoc.getList("controls", Document.class);
            if (controls == null) {
                continue;
            }
            for (Document control : controls) {
                if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                    return results;
                }
                String name = control.getString("name");
                String description = control.getString("description");
                if (SearchTextMatcher.containsIgnoreCase(name, lowerQuery) || SearchTextMatcher.containsIgnoreCase(description, lowerQuery)) {
                    results.add(new SearchResult(
                            domain,
                            control.getInteger("controlId"),
                            SearchTextMatcher.nullToEmpty(name),
                            SearchTextMatcher.nullToEmpty(description)
                    ));
                }
            }
        }

        return results;
    }

    /**
     * ADR's header carries a denormalized copy of the latest revision's title (written by
     * {@code MongoAdrStore} on every version write — see
     * {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}), so this reads
     * exactly like {@link #searchHeaderCollection} rather than resolving the version
     * collection per header. The {@code "ADR " + adrId} fallback only fires for a header
     * that predates both the write-path change and its one-time migration backfill.
     */
    private List<SearchResult> searchAdrCollection(String lowerQuery, Optional<Set<String>> readableNamespaces) {
        List<SearchResult> results = new ArrayList<>();

        for (Document header : adrCollection.find()) {
            if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                return results;
            }
            String namespace = header.getString("namespace");
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            Integer adrId = header.getInteger("adrId");
            if (adrId == null) {
                // SearchResult takes a primitive id, so a header missing its id field would
                // unbox to a NullPointerException. An ADR with no id is not addressable.
                continue;
            }
            String title = header.getString("name");
            if (title == null) {
                title = "ADR " + adrId;
            }

            if (SearchTextMatcher.containsIgnoreCase(title, lowerQuery)) {
                results.add(new SearchResult(namespace, adrId, title, ""));
            }
        }

        return results;
    }
}
