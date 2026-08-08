package org.finos.calm.migration.steps;

import org.dizitart.no2.Nitrite;
import org.dizitart.no2.collection.Document;
import org.dizitart.no2.collection.NitriteCollection;
import org.dizitart.no2.collection.NitriteId;
import org.dizitart.no2.filters.Filter;
import org.finos.calm.store.util.TypeSafeNitriteDocument;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.dizitart.no2.filters.FluentFilter.where;

/**
 * NitriteDB counterpart to {@link MongoControlSplitMigration}: the same two-level fan-out
 * of {@code controls} (one document per domain) into {@code controls}/{@code controlVersions}
 * for requirements and {@code controlConfigurations}/{@code controlConfigurationVersions} for
 * configurations, the latter under a synthetic {@code domain::controlId} namespace.
 *
 * <h2>Differences from the Mongo migration</h2>
 * As with {@link NitriteVersionSplitMigration} versus {@link MongoVersionSplitMigration}: no
 * index work (Nitrite creates none; {@code NitriteVersionDocumentStore} enforces uniqueness
 * with a lock instead), and version content is a JSON string rather than a parsed document.
 */
public class NitriteControlSplitMigration {

    private static final Logger LOG = LoggerFactory.getLogger(NitriteControlSplitMigration.class);

    private static final String NAMESPACE_FIELD = "namespace";
    private static final String VERSION_FIELD = "version";
    private static final String DOMAIN_FIELD = "domain";
    private static final String CONTROLS_FIELD = "controls";
    private static final String CONFIGURATIONS_FIELD = "configurations";
    private static final String CONTROL_ID_FIELD = "controlId";
    private static final String CONFIGURATION_ID_FIELD = "configurationId";
    private static final String REQUIREMENT_FIELD = "requirement";
    private static final String VERSIONS_FIELD = "versions";
    private static final String NAME_FIELD = "name";
    private static final String DESCRIPTION_FIELD = "description";
    private static final String VERSION_COUNT_FIELD = "versionCount";
    private static final String METADATA_FIELD = "metadata";

    private final NitriteCollection oldDomainDocs;
    private final NitriteCollection controlHeaders;
    private final NitriteCollection controlVersions;
    private final NitriteCollection configHeaders;
    private final NitriteCollection configVersions;

    public NitriteControlSplitMigration(Nitrite db) {
        this.oldDomainDocs = db.getCollection("controls");
        this.controlHeaders = db.getCollection("controls");
        this.controlVersions = db.getCollection("controlVersions");
        this.configHeaders = db.getCollection("controlConfigurations");
        this.configVersions = db.getCollection("controlConfigurationVersions");
    }

    public void migrate() {
        List<NitriteId> oldDocumentIds = new ArrayList<>();
        for (Document document : oldDomainDocs.find()) {
            if (document.get(CONTROLS_FIELD) != null) {
                oldDocumentIds.add(document.getId());
            }
        }

        int migratedControls = 0;
        int migratedConfigurations = 0;
        for (NitriteId oldDocumentId : oldDocumentIds) {
            Document oldDocument = oldDomainDocs.getById(oldDocumentId);
            if (oldDocument == null) {
                continue;
            }
            String domain = oldDocument.get(DOMAIN_FIELD, String.class);
            List<Document> controls = new TypeSafeNitriteDocument<>(oldDocument, Document.class).getList(CONTROLS_FIELD);
            if (controls != null) {
                for (Document control : controls) {
                    writeControlHeaderAndVersions(domain, control);
                    migratedControls++;

                    String configNamespace = domain + "::" + control.get(CONTROL_ID_FIELD, Integer.class);
                    List<Document> configurations =
                            new TypeSafeNitriteDocument<>(control, Document.class).getList(CONFIGURATIONS_FIELD);
                    if (configurations != null) {
                        for (Document config : configurations) {
                            writeConfigurationHeaderAndVersions(configNamespace, config);
                            migratedConfigurations++;
                        }
                    }
                }
            }
            // By identity, not a domain filter: the headers just written share no key with the
            // old domain document, so removing it by its own id can't touch them.
            oldDomainDocs.remove(oldDocument);
        }

        LOG.info("Control version split complete: {} domain document(s) fanned out into "
                        + "{} control header(s) and {} configuration header(s)",
                oldDocumentIds.size(), migratedControls, migratedConfigurations);
    }

    private void writeControlHeaderAndVersions(String domain, Document control) {
        Integer controlId = control.get(CONTROL_ID_FIELD, Integer.class);
        Document storedVersions = control.get(REQUIREMENT_FIELD, Document.class);
        Map<String, String> keysByCanonicalVersion = collapseToCanonicalVersions(storedVersions, domain, controlId);

        Filter headerFilter = Filter.and(where(NAMESPACE_FIELD).eq(domain), where(CONTROL_ID_FIELD).eq(controlId));
        controlHeaders.remove(headerFilter);
        controlHeaders.insert(Document.createDocument()
                .put(NAMESPACE_FIELD, domain)
                .put(CONTROL_ID_FIELD, controlId)
                .put(NAME_FIELD, control.get(NAME_FIELD, String.class))
                .put(DESCRIPTION_FIELD, control.get(DESCRIPTION_FIELD, String.class))
                .put(VERSION_COUNT_FIELD, keysByCanonicalVersion.size())
                .put(METADATA_FIELD, Document.createDocument()));

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            controlVersions.remove(Filter.and(where(NAMESPACE_FIELD).eq(domain),
                    where(CONTROL_ID_FIELD).eq(controlId), where(VERSION_FIELD).eq(version.getKey())));
            controlVersions.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, domain)
                    .put(CONTROL_ID_FIELD, controlId)
                    .put(VERSION_FIELD, version.getKey())
                    .put("content", contentOf(storedVersions, version.getValue(), domain, controlId))
                    .put(METADATA_FIELD, Document.createDocument()));
        }
    }

    private void writeConfigurationHeaderAndVersions(String configNamespace, Document config) {
        Integer configurationId = config.get(CONFIGURATION_ID_FIELD, Integer.class);
        Document storedVersions = config.get(VERSIONS_FIELD, Document.class);
        Map<String, String> keysByCanonicalVersion =
                collapseToCanonicalVersions(storedVersions, configNamespace, configurationId);

        Filter headerFilter = Filter.and(
                where(NAMESPACE_FIELD).eq(configNamespace), where(CONFIGURATION_ID_FIELD).eq(configurationId));
        configHeaders.remove(headerFilter);
        configHeaders.insert(Document.createDocument()
                .put(NAMESPACE_FIELD, configNamespace)
                .put(CONFIGURATION_ID_FIELD, configurationId)
                .put(NAME_FIELD, config.get(NAME_FIELD, String.class))
                .put(DESCRIPTION_FIELD, null)
                .put(VERSION_COUNT_FIELD, keysByCanonicalVersion.size())
                .put(METADATA_FIELD, Document.createDocument()));

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            configVersions.remove(Filter.and(where(NAMESPACE_FIELD).eq(configNamespace),
                    where(CONFIGURATION_ID_FIELD).eq(configurationId), where(VERSION_FIELD).eq(version.getKey())));
            configVersions.insert(Document.createDocument()
                    .put(NAMESPACE_FIELD, configNamespace)
                    .put(CONFIGURATION_ID_FIELD, configurationId)
                    .put(VERSION_FIELD, version.getKey())
                    .put("content", contentOf(storedVersions, version.getValue(), configNamespace, configurationId))
                    .put(METADATA_FIELD, Document.createDocument()));
        }
    }

    /**
     * Reads one version's stored content, preserving whatever is there rather than casting.
     * See {@link NitriteVersionSplitMigration#contentOf} for why.
     */
    private Object contentOf(Document storedVersions, String key, String scopeLabel, Integer id) {
        Object content = storedVersions.get(key);
        if (!(content instanceof String)) {
            LOG.warn("Version [{}] [scope={}, id={}] holds content of type [{}] rather than a string. "
                            + "Migrating it unchanged; reads of it will report the version as not found "
                            + "until the document is repaired.",
                    key, scopeLabel, id, content == null ? "null" : content.getClass().getName());
        }
        return content;
    }

    /**
     * Maps each canonical version to the stored key it came from, keeping the first when
     * several collapse onto one. See {@link MongoVersionSplitMigration#collapseToCanonicalVersions}.
     */
    private Map<String, String> collapseToCanonicalVersions(Document storedVersions, String scopeLabel, Integer id) {
        Map<String, String> keysByCanonicalVersion = new LinkedHashMap<>();
        if (storedVersions == null) {
            return keysByCanonicalVersion;
        }
        for (String storedKey : storedVersions.getFields()) {
            String version = VersionScheme.SEMANTIC.canonicalise(storedKey);
            String alreadyMapped = keysByCanonicalVersion.putIfAbsent(version, storedKey);
            if (alreadyMapped != null) {
                LOG.warn("Discarding version key '{}' [scope={}, id={}] — it means the same version as "
                                + "'{}' ({}), which the new shape stores once. The discarded content is only "
                                + "recoverable from a backup.",
                        storedKey, scopeLabel, id, alreadyMapped, version);
            }
        }
        return keysByCanonicalVersion;
    }
}
