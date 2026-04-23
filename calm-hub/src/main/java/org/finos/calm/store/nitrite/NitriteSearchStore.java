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
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * NitriteDB-backed implementation of {@link SearchStore}.
 * <p>
 * Searches across 7 resource collections by matching the query (case-insensitive)
 * against the {@code name} and {@code description} fields of each resource entry.
 * For ADRs, the {@code title} field of the latest revision is searched.
 * Controls are scoped by domain rather than namespace, so they bypass the
 * readable-namespaces filter.
 */
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
                searchNamespacedCollection(architectureCollection, "architectures", "architectureId", lowerQuery, readableNamespaces),
                searchNamespacedCollection(patternCollection, "patterns", "patternId", lowerQuery, readableNamespaces),
                searchNamespacedCollection(flowCollection, "flows", "flowId", lowerQuery, readableNamespaces),
                searchNamespacedCollection(standardCollection, "standards", "standardId", lowerQuery, readableNamespaces),
                searchNamespacedCollection(interfaceCollection, "interfaces", "interfaceId", lowerQuery, readableNamespaces),
                searchControlCollection(lowerQuery),
                searchAdrCollection(lowerQuery, readableNamespaces)
        );
    }

    private List<SearchResult> searchNamespacedCollection(NitriteCollection collection,
                                                          String arrayField,
                                                          String idField,
                                                          String lowerQuery,
                                                          Optional<Set<String>> readableNamespaces) {
        List<SearchResult> results = new ArrayList<>();

        for (Document namespaceDoc : collection.find()) {
            String namespace = namespaceDoc.get("namespace", String.class);
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            TypeSafeNitriteDocument<Document> wrapper = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
            List<Document> entries = wrapper.getList(arrayField);
            if (entries == null) {
                continue;
            }
            for (Document entry : entries) {
                if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                    return results;
                }
                String name = entry.get("name", String.class);
                String description = entry.get("description", String.class);
                if (SearchTextMatcher.containsIgnoreCase(name, lowerQuery) || SearchTextMatcher.containsIgnoreCase(description, lowerQuery)) {
                    results.add(new SearchResult(
                            namespace,
                            entry.get(idField, Integer.class),
                            SearchTextMatcher.nullToEmpty(name),
                            SearchTextMatcher.nullToEmpty(description)
                    ));
                }
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

    @SuppressWarnings("unchecked")
    private List<SearchResult> searchAdrCollection(String lowerQuery, Optional<Set<String>> readableNamespaces) {
        List<SearchResult> results = new ArrayList<>();

        for (Document namespaceDoc : adrCollection.find()) {
            String namespace = namespaceDoc.get("namespace", String.class);
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(namespace)) {
                continue;
            }
            TypeSafeNitriteDocument<Document> wrapper = new TypeSafeNitriteDocument<>(namespaceDoc, Document.class);
            List<Document> adrs = wrapper.getList("adrs");
            if (adrs == null) {
                continue;
            }
            for (Document adr : adrs) {
                if (results.size() >= SearchStore.MAX_RESULTS_PER_TYPE) {
                    return results;
                }
                Integer adrId = adr.get("adrId", Integer.class);
                String title = "ADR " + adrId;

                Map<String, Object> revisions = (Map<String, Object>) adr.get("revisions");
                if (revisions != null && !revisions.isEmpty()) {
                    int latestRevision = revisions.keySet().stream()
                            .map(Integer::parseInt)
                            .mapToInt(i -> i)
                            .max()
                            .getAsInt();
                    Object revObj = revisions.get(String.valueOf(latestRevision));
                    if (revObj instanceof Document revisionDoc) {
                        String docTitle = revisionDoc.get("title", String.class);
                        if (docTitle != null) {
                            title = docTitle;
                        }
                    }
                }

                if (SearchTextMatcher.containsIgnoreCase(title, lowerQuery)) {
                    results.add(new SearchResult(namespace, adrId, title, ""));
                }
            }
        }

        return results;
    }
}
