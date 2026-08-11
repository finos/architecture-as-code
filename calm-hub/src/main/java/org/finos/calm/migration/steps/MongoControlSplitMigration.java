package org.finos.calm.migration.steps;

import com.mongodb.MongoCommandException;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Projections;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.Document;
import org.finos.calm.store.util.VersionScheme;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The MongoDB half of ADR 0007's Control migration: split one document per domain, holding
 * a {@code controls} array whose entries each carry a versioned {@code requirement} map and
 * a nested {@code configurations} array (each with its own versioned {@code versions} map),
 * into two header/version collection pairs — {@code controls}/{@code controlVersions} for
 * requirements, {@code controlConfigurations}/{@code controlConfigurationVersions} for
 * configurations, the latter scoped under a synthetic {@code domain::controlId} namespace.
 *
 * <h2>Not {@link MongoVersionSplitMigration}</h2>
 * That shared class fans out a single level under a field literally named {@code namespace}.
 * Control's old-shape document groups by {@code domain} and needs <em>two</em> levels of
 * fan-out — controls, then each control's nested configurations — into two different
 * collection pairs from one shared read. Retrofitting that in would have made the shared
 * class harder to read for the seven types that don't need it, so this mirrors its structure
 * instead of extending it. See {@code calm-hub/decisions/0007-control-storage-header-version-split.md}.
 *
 * <h2>Idempotency</h2>
 * Only documents that still carry the {@code controls} array are processed (already-migrated
 * headers don't have one). Headers and versions are written with {@code replaceOne(upsert)},
 * so re-running a partially-applied attempt overwrites rather than fails on the unique index.
 * The old domain document is deleted only once both fan-outs (requirement-level and
 * configuration-level) for every control in it have succeeded, so a crash mid-domain leaves
 * the source intact and the whole domain is redone next attempt.
 *
 * <h2>Why the new unique indexes have to wait until after the fan-out</h2>
 * Unlike {@link MongoVersionSplitMigration}, where the old-shape document's grouping field is
 * literally named {@code namespace} — so it already carries a distinct value per document, and
 * only the (missing) {@code idField} collides — Control's old-shape document groups by
 * {@code domain}, a different field name entirely. Every old-shape control document is
 * therefore missing <em>both</em> halves of the new {@code (namespace, controlId)} compound
 * key, and MongoDB treats a missing field as {@code null}: two or more old-shape documents
 * would all collide on {@code (null, null)}, and building the unique index against them fails
 * outright with a duplicate-key error before a single one is fanned out. So {@link #migrate()}
 * creates the new indexes only after the old-shape documents are gone; {@link #transitionIndexes()}
 * still does both steps together for its other caller (test/integration-harness setup against
 * an empty database, with nothing to collide).
 */
public class MongoControlSplitMigration {

    private static final Logger LOG = LoggerFactory.getLogger(MongoControlSplitMigration.class);

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

    /** The index {@code MongoIndexInitializationStep} created on {@code controls.domain}. */
    private static final String OLD_DOMAIN_INDEX = "domain_1";

    /** MongoDB's {@code IndexNotFound} error code. */
    private static final int INDEX_NOT_FOUND = 27;

    private final MongoDatabase database;

    public MongoControlSplitMigration(MongoDatabase database) {
        this.database = database;
    }

    public void migrate() {
        dropOldDomainIndex(database.getCollection("controls"));
        fanOutDomainDocuments();
        createNewIndexes();
    }

    /**
     * Replaces the old one-document-per-domain constraint with the four the new shape needs,
     * in one call. Only safe against a database with no old-shape documents left — see the
     * class javadoc's "Why the new unique indexes have to wait" section. {@link #migrate()}
     * does not call this; it does the same two things with the fan-out in between.
     */
    public void transitionIndexes() {
        dropOldDomainIndex(database.getCollection("controls"));
        createNewIndexes();
    }

    private void createNewIndexes() {
        MongoCollection<Document> controlHeaders = database.getCollection("controls");
        IndexOptions unique = new IndexOptions().unique(true);
        controlHeaders.createIndex(new Document(NAMESPACE_FIELD, 1).append(CONTROL_ID_FIELD, 1), unique);
        LOG.info("Ensured unique index on controls.({}, {})", NAMESPACE_FIELD, CONTROL_ID_FIELD);

        database.getCollection("controlVersions").createIndex(
                new Document(NAMESPACE_FIELD, 1).append(CONTROL_ID_FIELD, 1).append(VERSION_FIELD, 1), unique);
        LOG.info("Ensured unique index on controlVersions.({}, {}, version)", NAMESPACE_FIELD, CONTROL_ID_FIELD);

        database.getCollection("controlConfigurations").createIndex(
                new Document(NAMESPACE_FIELD, 1).append(CONFIGURATION_ID_FIELD, 1), unique);
        LOG.info("Ensured unique index on controlConfigurations.({}, {})", NAMESPACE_FIELD, CONFIGURATION_ID_FIELD);

        database.getCollection("controlConfigurationVersions").createIndex(
                new Document(NAMESPACE_FIELD, 1).append(CONFIGURATION_ID_FIELD, 1).append(VERSION_FIELD, 1), unique);
        LOG.info("Ensured unique index on controlConfigurationVersions.({}, {}, version)",
                NAMESPACE_FIELD, CONFIGURATION_ID_FIELD);
    }

    private void dropOldDomainIndex(MongoCollection<Document> controlHeaders) {
        try {
            controlHeaders.dropIndex(OLD_DOMAIN_INDEX);
            LOG.info("Dropped the old unique index controls.{}", OLD_DOMAIN_INDEX);
        } catch (MongoCommandException e) {
            if (e.getErrorCode() != INDEX_NOT_FOUND) {
                throw e;
            }
            LOG.info("Old unique index controls.{} was already absent", OLD_DOMAIN_INDEX);
        }
    }

    private void fanOutDomainDocuments() {
        MongoCollection<Document> oldDomainDocs = database.getCollection("controls");
        MongoCollection<Document> controlHeaders = database.getCollection("controls");
        MongoCollection<Document> controlVersions = database.getCollection("controlVersions");
        MongoCollection<Document> configHeaders = database.getCollection("controlConfigurations");
        MongoCollection<Document> configVersions = database.getCollection("controlConfigurationVersions");

        // Ids only, not the documents themselves — see MongoVersionSplitMigration for why:
        // these are precisely the documents this migration exists to break up.
        List<Object> oldDocumentIds = new ArrayList<>();
        oldDomainDocs.find(Filters.exists(CONTROLS_FIELD))
                .projection(Projections.include("_id"))
                .forEach(document -> oldDocumentIds.add(document.get("_id")));

        int migratedControls = 0;
        int migratedConfigurations = 0;
        for (Object oldDocumentId : oldDocumentIds) {
            Document oldDocument = oldDomainDocs.find(Filters.eq("_id", oldDocumentId)).first();
            if (oldDocument == null) {
                continue;
            }
            String domain = oldDocument.getString(DOMAIN_FIELD);
            for (Document control : oldDocument.getList(CONTROLS_FIELD, Document.class, List.of())) {
                writeControlHeaderAndVersions(controlHeaders, controlVersions, domain, control);
                migratedControls++;

                String configNamespace = domain + "::" + control.getInteger(CONTROL_ID_FIELD);
                for (Document config : control.getList(CONFIGURATIONS_FIELD, Document.class, List.of())) {
                    writeConfigurationHeaderAndVersions(configHeaders, configVersions, configNamespace, config);
                    migratedConfigurations++;
                }
            }
            // Only once every control and configuration in this domain is safely rewritten.
            oldDomainDocs.deleteOne(Filters.eq("_id", oldDocumentId));
        }

        LOG.info("Control version split complete: {} domain document(s) fanned out into "
                        + "{} control header(s) and {} configuration header(s)",
                oldDocumentIds.size(), migratedControls, migratedConfigurations);
    }

    private void writeControlHeaderAndVersions(MongoCollection<Document> headers, MongoCollection<Document> versions,
                                               String domain, Document control) {
        Integer controlId = control.getInteger(CONTROL_ID_FIELD);
        Document storedVersions = control.get(REQUIREMENT_FIELD, Document.class);
        Map<String, String> keysByCanonicalVersion = collapseToCanonicalVersions(storedVersions, domain, controlId);

        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        Document header = new Document(NAMESPACE_FIELD, domain)
                .append(CONTROL_ID_FIELD, controlId)
                .append(NAME_FIELD, control.getString(NAME_FIELD))
                .append(DESCRIPTION_FIELD, control.getString(DESCRIPTION_FIELD))
                .append(VERSION_COUNT_FIELD, keysByCanonicalVersion.size())
                .append(METADATA_FIELD, new Document());
        headers.replaceOne(
                Filters.and(Filters.eq(NAMESPACE_FIELD, domain), Filters.eq(CONTROL_ID_FIELD, controlId)),
                header, upsert);

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            Document versionDocument = new Document(NAMESPACE_FIELD, domain)
                    .append(CONTROL_ID_FIELD, controlId)
                    .append(VERSION_FIELD, version.getKey())
                    .append("content", contentOf(storedVersions, version.getValue(), domain, controlId))
                    .append(METADATA_FIELD, new Document());
            versions.replaceOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, domain),
                            Filters.eq(CONTROL_ID_FIELD, controlId),
                            Filters.eq(VERSION_FIELD, version.getKey())),
                    versionDocument, upsert);
        }
    }

    private void writeConfigurationHeaderAndVersions(MongoCollection<Document> headers, MongoCollection<Document> versions,
                                                      String configNamespace, Document config) {
        Integer configurationId = config.getInteger(CONFIGURATION_ID_FIELD);
        Document storedVersions = config.get(VERSIONS_FIELD, Document.class);
        Map<String, String> keysByCanonicalVersion =
                collapseToCanonicalVersions(storedVersions, configNamespace, configurationId);

        ReplaceOptions upsert = new ReplaceOptions().upsert(true);

        Document header = new Document(NAMESPACE_FIELD, configNamespace)
                .append(CONFIGURATION_ID_FIELD, configurationId)
                .append(NAME_FIELD, config.getString(NAME_FIELD))
                .append(DESCRIPTION_FIELD, null)
                .append(VERSION_COUNT_FIELD, keysByCanonicalVersion.size())
                .append(METADATA_FIELD, new Document());
        headers.replaceOne(
                Filters.and(Filters.eq(NAMESPACE_FIELD, configNamespace), Filters.eq(CONFIGURATION_ID_FIELD, configurationId)),
                header, upsert);

        for (Map.Entry<String, String> version : keysByCanonicalVersion.entrySet()) {
            Document versionDocument = new Document(NAMESPACE_FIELD, configNamespace)
                    .append(CONFIGURATION_ID_FIELD, configurationId)
                    .append(VERSION_FIELD, version.getKey())
                    .append("content", contentOf(storedVersions, version.getValue(), configNamespace, configurationId))
                    .append(METADATA_FIELD, new Document());
            versions.replaceOne(
                    Filters.and(Filters.eq(NAMESPACE_FIELD, configNamespace),
                            Filters.eq(CONFIGURATION_ID_FIELD, configurationId),
                            Filters.eq(VERSION_FIELD, version.getKey())),
                    versionDocument, upsert);
        }
    }

    /**
     * Reads one version's stored content, preserving whatever is there rather than casting.
     * See {@link MongoVersionSplitMigration#contentOf} for why: a migration is the wrong place
     * to abort over one malformed document.
     */
    private Object contentOf(Document storedVersions, String key, String scopeLabel, Integer id) {
        Object content = storedVersions.get(key);
        if (!(content instanceof Document)) {
            LOG.warn("Version [{}] [scope={}, id={}] holds content of type [{}] rather than a document. "
                            + "Migrating it unchanged so nothing is lost; repair the document if reads of "
                            + "that version do not behave.",
                    key, scopeLabel, id, content == null ? "null" : content.getClass().getName());
        }
        return content;
    }

    /**
     * Maps each canonical version to the stored key it came from, keeping the first when
     * several collapse onto one. See {@link MongoVersionSplitMigration#collapseToCanonicalVersions}
     * for why the old shape can hold several keys meaning one version.
     */
    private Map<String, String> collapseToCanonicalVersions(Document storedVersions, String scopeLabel, Integer id) {
        Map<String, String> keysByCanonicalVersion = new LinkedHashMap<>();
        if (storedVersions == null) {
            return keysByCanonicalVersion;
        }
        for (String storedKey : storedVersions.keySet()) {
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
