package org.finos.calm.store.nitrite;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
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
 * NitriteDB-backed implementation of {@link SearchStore}.
 * <p>
 * Searches across 7 resource collections by matching the query (case-insensitive)
 * against the {@code name} and {@code description} fields of each resource entry.
 * ADR's header carries a denormalized copy of the latest revision's title (see
 * {@code calm-hub/decisions/0006-denormalize-adr-title-onto-header.md}), so it reads the
 * same as every other type. Controls are scoped by domain rather than namespace, so they
 * bypass the readable-namespaces filter.
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitriteSearchStore.class)
public class NitriteSearchStore implements SearchStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteSearchStore.class);

    private final NitriteCollection architectureCollection;
    private final NitriteCollection patternCollection;
    private final NitriteCollection flowCollection;
    private final NitriteCollection standardCollection;
    private final NitriteCollection interfaceCollection;
    private final NitriteCollection controlCollection;
    private final NitriteCollection adrCollection;

    @Inject
    public NitriteSearchStore(@StandaloneQualifier Nitrite db) {
        this.architectureCollection = db.getCollection("architectures");
        this.patternCollection = db.getCollection("patterns");
        this.flowCollection = db.getCollection("flows");
        this.standardCollection = db.getCollection("standards");
        this.interfaceCollection = db.getCollection("interfaces");
        this.controlCollection = db.getCollection("controls");
        this.adrCollection = db.getCollection("adrs");
        LOG.info("NitriteSearchStore initialized");
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
                // Optional.empty() bypasses the readable-namespaces filter — controls are
                // scoped by domain, not namespace (ADR 0007).
                searchHeaderCollection(controlCollection, "controlId", lowerQuery, Optional.empty()),
                searchAdrCollection(lowerQuery, readableNamespaces)
        );
    }

    /**
     * Searches a collection in the header/version shape, where each document <em>is</em> one
     * resource rather than a namespace-wide array of them. The array-shaped path this once
     * sat beside was retired when Interface, the last of the namespaced types, migrated —
     * see {@code MongoSearchStore.searchHeaderCollection} for the silent failure mode it
     * guarded against, which is worth remembering rather than the method itself.
     */
    private List<SearchResult> searchHeaderCollection(NitriteCollection collection,
                                                      String idField,
                                                      String lowerQuery,
                                                      Optional<Set<String>> readableNamespaces) {
        List<SearchResult> results = new ArrayList<>();

        for (Document header : collection.find()) {
            if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                return results;
            }
            String namespace = header.get("namespace", String.class);
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            Integer id = header.get(idField, Integer.class);
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
            String name = header.get("name", String.class);
            String description = header.get("description", String.class);
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


    /**
     * ADR's header carries a denormalized copy of the latest revision's title (written by
     * {@code NitriteAdrStore} on every version write — see
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
            String namespace = header.get("namespace", String.class);
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            Integer adrId = header.get("adrId", Integer.class);
            if (adrId == null) {
                // SearchResult takes a primitive id, so a header missing its id field would
                // unbox to a NullPointerException. An ADR with no id is not addressable.
                continue;
            }
            String title = header.get("name", String.class);
            if (title == null || title.isBlank()) {
                title = "ADR " + adrId;
            }

            if (SearchTextMatcher.containsIgnoreCase(title, lowerQuery)) {
                results.add(new SearchResult(namespace, adrId, title, ""));
            }
        }

        return results;
    }
}
