package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.finos.calm.store.util.NitriteVersionDocumentStore;
import org.finos.calm.store.util.VersionScheme;
import org.finos.calm.store.util.SearchTextMatcher;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
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
 * For ADRs, the {@code title} field of the latest revision is searched.
 * Controls are scoped by domain rather than namespace, so they bypass the
 * readable-namespaces filter.
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
    /**
     * Read-only. Do not add a write path through this field.
     *
     * <p>This is a second {@link NitriteVersionDocumentStore} over the same two collections
     * {@link NitriteAdrStore} uses, and the two carry independent
     * {@link java.util.concurrent.locks.ReentrantReadWriteLock}s. Writes are safe there only
     * because that store's lock serialises every writer; a write issued through this instance
     * would take a different lock and so would not be serialised against them, reintroducing
     * the duplicate-revision race the lock exists to prevent — {@code createVersion}'s
     * check-then-act would no longer be atomic with respect to the other instance.</p>
     *
     * <p>Reads need no such coordination, which is why two instances are tolerable at all. If
     * this ever needs to write, share {@code NitriteAdrStore}'s instance rather than widening
     * this one.</p>
     */
    private final NitriteVersionDocumentStore adrDocuments;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public NitriteSearchStore(@StandaloneQualifier Nitrite db) {
        this.architectureCollection = db.getCollection("architectures");
        this.patternCollection = db.getCollection("patterns");
        this.flowCollection = db.getCollection("flows");
        this.standardCollection = db.getCollection("standards");
        this.interfaceCollection = db.getCollection("interfaces");
        this.controlCollection = db.getCollection("controls");
        this.adrCollection = db.getCollection("adrs");
        this.adrDocuments = new NitriteVersionDocumentStore(adrCollection,
                db.getCollection("adrVersions"), "adrId", "ADR", VersionScheme.NUMERIC);
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
                searchControlCollection(lowerQuery),
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


    private List<SearchResult> searchControlCollection(String lowerQuery) {
        List<SearchResult> results = new ArrayList<>();

        for (Document domainDoc : controlCollection.find()) {
            String domain = domainDoc.get("domain", String.class);
            TypeSafeNitriteDocument<Document> wrapper = new TypeSafeNitriteDocument<>(domainDoc, Document.class);
            List<Document> controls = wrapper.getList("controls");
            if (controls == null) {
                continue;
            }
            for (Document control : controls) {
                if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                    return results;
                }
                String name = control.get("name", String.class);
                String description = control.get("description", String.class);
                if (SearchTextMatcher.containsIgnoreCase(name, lowerQuery) || SearchTextMatcher.containsIgnoreCase(description, lowerQuery)) {
                    results.add(new SearchResult(
                            domain,
                            control.get("controlId", Integer.class),
                            SearchTextMatcher.nullToEmpty(name),
                            SearchTextMatcher.nullToEmpty(description)
                    ));
                }
            }
        }

        return results;
    }

    /**
     * ADR searches on the latest revision's title. See
     * {@code MongoSearchStore.searchAdrCollection} for why this goes through the helper.
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
                // SearchResult takes a primitive id, and resolving the latest revision would
                // unbox this too. An ADR with no id is not addressable, so it is not a result.
                continue;
            }
            String title = "ADR " + adrId;

            String latest = adrDocuments.getLatestVersionContent(namespace, adrId);
            if (latest != null) {
                String documentTitle = titleOf(latest);
                if (documentTitle != null) {
                    title = documentTitle;
                }
            }

            if (SearchTextMatcher.containsIgnoreCase(title, lowerQuery)) {
                results.add(new SearchResult(namespace, adrId, title, ""));
            }
        }

        return results;
    }

    /**
     * @return the title from a stored ADR revision, or {@code null} if it cannot be read.
     * Content is a JSON string in this backend, so the field has to be parsed out; a search
     * must not fail because one ADR's content is unreadable.
     */
    /**
     * Reads an ADR revision's title with the same parser {@code NitriteAdrStore} uses.
     *
     * <p>Deliberately Jackson rather than {@code org.bson.Document.parse}: the two disagree
     * about what is readable, so a BSON-only parse here would show a title in the ADR
     * listing and a bare "ADR n" in search results for the same document. BSON also has no
     * business in the Nitrite path, which stores content as a plain JSON string.</p>
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
