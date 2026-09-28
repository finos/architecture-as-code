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
import org.finos.calm.domain.implementations.PatternImplementation;
import org.finos.calm.domain.implementations.PatternImplementations;
import org.finos.calm.domain.implementations.PatternReference;
import org.finos.calm.store.PageRequest;
import org.finos.calm.store.PatternImplementationStore;
import org.finos.calm.store.util.PatternReferenceMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * NitriteDB-backed implementation of {@link PatternImplementationStore}.
 *
 * <p>Unlike the MongoDB implementation this cannot push the match down to the database. Nitrite
 * stores an architecture's content as an opaque JSON string rather than a nested document, so
 * {@code $schema} is not addressable as a field, and CalmHub creates no Nitrite indexes in any case
 * — see {@code NitriteVersionDocumentStore}. Every version is therefore read and parsed here. That
 * is the standing cost of this backend rather than a choice made for this query: it is the embedded
 * mode, and every other read on it scans the same way.</p>
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
    public PatternImplementations findImplementations(String namespace, String patternName, String version,
                                                      Optional<Set<String>> readableNamespaces, PageRequest page) {
        List<PatternImplementation> implementations = new ArrayList<>();

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
            if (!PatternReferenceMatcher.references(schemaOf(versionDocument), namespace, patternName, version)) {
                continue;
            }
            implementations.add(new PatternImplementation(
                    documentNamespace, architectureId, versionDocument.get(VERSION_FIELD, String.class), null));
        }

        return new PatternImplementations(
                new PatternReference(namespace, patternName, version), page.apply(implementations));
    }

    /**
     * Reads the top-level {@code $schema} of a stored architecture, or null when there is none.
     * Content that will not parse is skipped rather than failing the request. One bad document
     * should not make the whole answer unavailable.
     */
    private String schemaOf(Document versionDocument) {
        Object content = versionDocument.get(CONTENT_FIELD);
        if (!(content instanceof String stored)) {
            return null;
        }
        try {
            JsonNode schema = objectMapper.readTree(stored).path("$schema");
            return schema.isTextual() ? schema.asText() : null;
        } catch (Exception e) {
            LOG.debug("Skipping architecture version whose content could not be parsed", e);
            return null;
        }
    }
}
