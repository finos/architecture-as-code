package org.finos.calm.store.mongo;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import org.bson.Document;
import org.finos.calm.domain.search.GroupedSearchResults;
import org.finos.calm.domain.search.SearchResult;
import org.finos.calm.store.SearchStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * MongoDB-backed implementation of {@link SearchStore}.
 * <p>
 * Searches across 7 resource collections by matching the query (case-insensitive)
 * against the {@code name} and {@code description} fields of each resource entry.
 * For ADRs, the {@code title} field of the latest revision is searched instead.
 * Controls are scoped by domain rather than namespace.
 */
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
    public GroupedSearchResults search(String query) {
        String escapedQuery = Pattern.quote(query);
        Pattern compiledPattern = Pattern.compile(escapedQuery, Pattern.CASE_INSENSITIVE);

        return new GroupedSearchResults(
                searchNamespacedCollection(architectureCollection, "architectures", "architectureId", compiledPattern),
                searchNamespacedCollection(patternCollection, "patterns", "patternId", compiledPattern),
                searchNamespacedCollection(flowCollection, "flows", "flowId", compiledPattern),
                searchNamespacedCollection(standardCollection, "standards", "standardId", compiledPattern),
                searchNamespacedCollection(interfaceCollection, "interfaces", "interfaceId", compiledPattern),
                searchControlCollection(compiledPattern),
                searchAdrCollection(compiledPattern)
        );
    }

    private List<SearchResult> searchNamespacedCollection(MongoCollection<Document> collection,
                                                          String arrayField,
                                                          String idField,
                                                          Pattern compiledPattern) {
        List<SearchResult> results = new ArrayList<>();

        for (Document namespaceDoc : collection.find()) {
            String namespace = namespaceDoc.getString("namespace");
            List<Document> entries = namespaceDoc.getList(arrayField, Document.class);
            if (entries == null) {
                continue;
            }
            for (Document entry : entries) {
                String name = entry.getString("name");
                String description = entry.getString("description");
                if (matchesQuery(name, compiledPattern) || matchesQuery(description, compiledPattern)) {
                    results.add(new SearchResult(
                            namespace,
                            entry.getInteger(idField),
                            name != null ? name : "",
                            description != null ? description : ""
                    ));
                }
            }
        }

        return results;
    }

    private List<SearchResult> searchControlCollection(Pattern compiledPattern) {
        List<SearchResult> results = new ArrayList<>();

        for (Document domainDoc : controlCollection.find()) {
            String domain = domainDoc.getString("domain");
            List<Document> controls = domainDoc.getList("controls", Document.class);
            if (controls == null) {
                continue;
            }
            for (Document control : controls) {
                String name = control.getString("name");
                String description = control.getString("description");
                if (matchesQuery(name, compiledPattern) || matchesQuery(description, compiledPattern)) {
                    results.add(new SearchResult(
                            domain,
                            control.getInteger("controlId"),
                            name != null ? name : "",
                            description != null ? description : ""
                    ));
                }
            }
        }

        return results;
    }

    private List<SearchResult> searchAdrCollection(Pattern compiledPattern) {
        List<SearchResult> results = new ArrayList<>();

        for (Document namespaceDoc : adrCollection.find()) {
            String namespace = namespaceDoc.getString("namespace");
            List<Document> adrs = namespaceDoc.getList("adrs", Document.class);
            if (adrs == null) {
                continue;
            }
            for (Document adr : adrs) {
                int adrId = adr.getInteger("adrId");
                String title = "ADR " + adrId;

                Document revisions = (Document) adr.get("revisions");
                if (revisions != null && !revisions.isEmpty()) {
                    int latestRevision = revisions.keySet().stream()
                            .map(Integer::parseInt)
                            .mapToInt(i -> i)
                            .max()
                            .getAsInt();
                    Document revisionDoc = (Document) revisions.get(String.valueOf(latestRevision));
                    if (revisionDoc != null) {
                        String docTitle = revisionDoc.getString("title");
                        if (docTitle != null) {
                            title = docTitle;
                        }
                    }
                }

                if (matchesQuery(title, compiledPattern)) {
                    results.add(new SearchResult(namespace, adrId, title, ""));
                }
            }
        }

        return results;
    }

    private boolean matchesQuery(String value, Pattern compiledPattern) {
        if (value == null) {
            return false;
        }
        return compiledPattern.matcher(value).find();
    }
}
