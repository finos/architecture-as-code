package org.finos.calm.migration.steps;

import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.migration.SchemaMigrationStep;
import org.finos.calm.store.util.VersionScheme;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.dizitart.no2.filters.FluentFilter.where;

/** Splits old embedded narrative documents into document headers and versions. */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
public class NitriteDocumentVersionSplitStep implements SchemaMigrationStep {

    private final Nitrite database;

    @Inject
    public NitriteDocumentVersionSplitStep(@StandaloneQualifier Nitrite database) {
        this.database = database;
    }

    @Override
    public int fromVersion() {
        return 15;
    }

    @Override
    public void apply() {
        NitriteCollection headers = database.getCollection("documents");
        NitriteCollection versions = database.getCollection("documentVersions");
        List<NitriteId> oldRoots = new ArrayList<>();
        for (Document document : headers.find()) {
            if (document.get("documents") != null) {
                oldRoots.add(document.getId());
            }
        }
        for (NitriteId rootId : oldRoots) {
            Document root = headers.getById(rootId);
            if (root != null) {
                migrateRoot(headers, versions, root);
            }
        }
    }

    private static void migrateRoot(NitriteCollection headers, NitriteCollection versions, Document root) {
        String namespace = root.get("namespace", String.class);
        String documentType = root.get("documentType", String.class);
        @SuppressWarnings("unchecked")
        List<Document> documents = (List<Document>) root.get("documents");
        for (Document document : documents) {
            Integer documentId = document.get("documentId", Integer.class);
            Map<String, String> canonicalVersions = canonicalVersions(document, namespace, documentType, documentId);
            Filter headerFilter = headerFilter(namespace, documentType, documentId);
            headers.remove(headerFilter);
            headers.insert(Document.createDocument()
                    .put("namespace", namespace)
                    .put("documentType", documentType)
                    .put("documentId", documentId)
                    .put("name", document.get("name", String.class))
                    .put("description", document.get("description", String.class))
                    .put("versionCount", canonicalVersions.size())
                    .put("metadata", Document.createDocument()));
            Document oldVersions = document.get("versions", Document.class);
            for (Map.Entry<String, String> version : canonicalVersions.entrySet()) {
                Object markdown = oldVersions.get(version.getValue());
                if (!(markdown instanceof String)) {
                    throw new IllegalStateException("Narrative Markdown must be a string");
                }
                Filter versionFilter = Filter.and(headerFilter, where("version").eq(version.getKey()));
                versions.remove(versionFilter);
                versions.insert(Document.createDocument()
                        .put("namespace", namespace)
                        .put("documentType", documentType)
                        .put("documentId", documentId)
                        .put("version", version.getKey())
                        .put("content", Document.createDocument().put("documentMarkdown", markdown))
                        .put("metadata", Document.createDocument()));
            }
        }
        headers.remove(root);
    }

    private static Map<String, String> canonicalVersions(
            Document document, String namespace, String documentType, Integer documentId) {
        Document versions = document.get("versions", Document.class);
        Map<String, String> canonicalVersions = new LinkedHashMap<>();
        for (String storedVersion : versions.getFields()) {
            String canonicalVersion = VersionScheme.SEMANTIC.canonicalise(storedVersion);
            String existing = canonicalVersions.putIfAbsent(canonicalVersion, storedVersion);
            if (existing != null && !java.util.Objects.equals(versions.get(existing), versions.get(storedVersion))) {
                throw new IllegalStateException(
                        "Conflicting narrative versions for " + namespace + "/" + documentType + "/" + documentId);
            }
        }
        return canonicalVersions;
    }

    private static Filter headerFilter(String namespace, String documentType, Integer documentId) {
        return Filter.and(
                where("namespace").eq(namespace),
                where("documentType").eq(documentType),
                where("documentId").eq(documentId));
    }
}
