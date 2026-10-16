package org.finos.calm.store.nitrite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.finos.calm.config.StandaloneQualifier;
import org.finos.calm.store.ArchitectureSchema;
import org.finos.calm.store.PatternImplementationStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * NitriteDB-backed implementation of {@link PatternImplementationStore}.
 *
 * <p>Unlike the MongoDB implementation this cannot push the filter down to the database. Nitrite
 * stores an architecture's content as an opaque JSON string rather than a nested document, so
 * {@code $schema} is not addressable as a field, and CalmHub creates no Nitrite indexes in any case
 * — see {@code NitriteVersionDocumentStore}. Every version is therefore read here, and only a
 * version whose raw content contains the path is parsed.</p>
 */
@LookupIfProperty(name = "calm.database.mode", stringValue = "standalone")
@ApplicationScoped
@Typed(NitritePatternImplementationStore.class)
public class NitritePatternImplementationStore implements PatternImplementationStore {

    private static final Logger LOG = LoggerFactory.getLogger(NitritePatternImplementationStore.class);

    private static final String NAMESPACE_FIELD = "namespace";
    private static final String ARCHITECTURE_ID_FIELD = "architectureId";
    private static final String VERSION_FIELD = "version";
    private static final String CONTENT_FIELD = "content";

    private final NitriteCollection architectureVersions;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Inject
    public NitritePatternImplementationStore(@StandaloneQualifier Nitrite db) {
        this.architectureVersions = db.getCollection("architectureVersions");
        LOG.info("NitritePatternImplementationStore initialized");
    }

    @Override
    public List<ArchitectureSchema> findSchemasContaining(String schemaPath, Optional<Set<String>> readableNamespaces) {
        List<ArchitectureSchema> candidates = new ArrayList<>();

        for (Document versionDocument : architectureVersions.find()) {
            String documentNamespace = versionDocument.get(NAMESPACE_FIELD, String.class);
            Integer architectureId = versionDocument.get(ARCHITECTURE_ID_FIELD, Integer.class);
            if (documentNamespace == null || architectureId == null) {
                // Unaddressable, so a result row would be a link that goes nowhere. Checked before
                // the namespace filter because an immutable readable set rejects a null argument.
                continue;
            }
            if (readableNamespaces.isPresent() && !readableNamespaces.get().contains(documentNamespace)) {
                continue;
            }
            String schema = schemaContaining(versionDocument, schemaPath);
            if (schema != null) {
                candidates.add(new ArchitectureSchema(documentNamespace, architectureId,
                        versionDocument.get(VERSION_FIELD, String.class), schema));
            }
        }
        return candidates;
    }

    /**
     * Reads the top-level {@code $schema} of a stored architecture when it contains
     * {@code schemaPath}, or returns null. Content that will not parse is skipped rather than failing
     * the request. One bad document should not make the whole answer unavailable.
     */
    private String schemaContaining(Document versionDocument, String schemaPath) {
        if (!(versionDocument.get(CONTENT_FIELD) instanceof String stored) || !stored.contains(schemaPath)) {
            return null;
        }
        try {
            JsonNode schema = objectMapper.readTree(stored).path("$schema");
            return schema.isTextual() && schema.asText().contains(schemaPath) ? schema.asText() : null;
        } catch (Exception e) {
            LOG.debug("Skipping architecture version whose content could not be parsed", e);
            return null;
        }
    }
}
