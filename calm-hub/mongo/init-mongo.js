// Environment variables:
// - CALM_DB_NAME: Name of the MongoDB database to use (default: calmSchemas)
// - CALM_SCHEMA_BASE_PATH: Base path to load schemas from (default: /calm)
//
// Set environment variables if required, and run `mongosh init-mongo.js` to
// initialize the database with counters, schema, namespaces, and patterns.

// Simple logging functions for better readability of the initialization process
function logSection(title) {
    print(`=== ${title} ===`);
}

function logSuccess(message) {
    print(`  ✅ ${message}`);
}

function logSkip(message) {
    print(`  - ${message}`);
}

function logFail(message) {
    print(`  ❌ ${message}`);
}

// Mirror of CanonicalVersion.java, which folds every spelling the API accepts
// ("1.0.0", "1-0-0", "100", ...) onto one form. The seed data below is already written
// dot-separated, so this is a guard rather than a conversion: a version stored under any
// other spelling would be invisible to the store, which canonicalizes the version it
// looks for before querying. Keep the pattern identical to
// ResourceValidationConstants.VERSION_REGEX.
function canonicalVersion(version) {
    const match = /^(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)[-.]?(0|[1-9][0-9]*)$/.exec(version);
    return match ? `${match[1]}.${match[2]}.${match[3]}` : version;
}

// Writes a versioned resource type in the header/version shape of
// calm-hub/decisions/0001-versioned-artefact-storage.md: one header document per resource
// in its own collection, plus one document per version in a sibling <type>Versions
// collection.
//
// The seed data itself stays grouped by namespace because that reads far better than two
// flat lists with the parent-child relationship left implicit — so what is written here is
// deliberately NOT the literal shape of the source below. Change this function, not the
// data, if the storage shape changes again.
function seedVersionedResource(groupedByNamespace, headerCollection, versionCollection, arrayField, idField, versionsField, versionScheme) {
    // "versions" for every type but ADR, whose map is called "revisions".
    const versionsKey = versionsField || "versions";
    // "semantic" for every type but ADR, whose revisions are integers and must be stored
    // verbatim: VERSION_REGEX makes both separators optional, so canonicalVersion reads
    // "100" as a spelling of 1.0.0 and would store revision 100 as "1.0.0". Mirrors
    // VersionScheme on the Java side — see calm-hub/decisions/0003.
    const canonicalise = versionScheme !== "numeric";
    const headers = [];
    const versions = [];

    for (const namespaceDocument of groupedByNamespace) {
        for (const entry of namespaceDocument[arrayField]) {
            // Collapse first: two source keys can canonicalise to one version (canonicalVersion
            // accepts "1-0-0" and "100" as the same thing), and only one document can exist per
            // (namespace, id, version). Counting raw keys and writing one document each would
            // insert duplicates that the unique index — created further down, after these
            // inserts — then refuses, aborting the script before it records the schema version.
            // Mirrors collapseToCanonicalVersions in the two migration steps.
            const contentByCanonicalVersion = new Map();
            for (const storedKey of Object.keys(entry[versionsKey] || {})) {
                const version = canonicalise ? canonicalVersion(storedKey) : storedKey;
                if (contentByCanonicalVersion.has(version)) {
                    logFail(`Seed data has two keys meaning version ${version} for `
                        + `${namespaceDocument.namespace}/${entry[idField]} — keeping the first, dropping '${storedKey}'`);
                    continue;
                }
                contentByCanonicalVersion.set(version, entry[versionsKey][storedKey]);
            }

            headers.push({
                namespace: namespaceDocument.namespace,
                [idField]: entry[idField],
                name: entry.name,
                description: entry.description,
                // NumberInt, not a plain JS number: a double here reads back as a Double and
                // the store's getInteger call fails on it. Counts the collapsed set, so the
                // header can never advertise more versions than there are documents.
                versionCount: NumberInt(contentByCanonicalVersion.size),
                metadata: {}
            });

            for (const [version, content] of contentByCanonicalVersion) {
                versions.push({
                    namespace: namespaceDocument.namespace,
                    [idField]: entry[idField],
                    version: version,
                    content: content,
                    metadata: {}
                });
            }
        }
    }

    db[headerCollection].insertMany(headers);
    if (versions.length > 0) {
        db[versionCollection].insertMany(versions);
    }
    return { headers: headers.length, versions: versions.length };
}

const dbName = (typeof process !== 'undefined' && process.env.CALM_DB_NAME)
    ? process.env.CALM_DB_NAME
    : 'calmSchemas';
logSuccess(`Using database: ${dbName}`);
db = db.getSiblingDB(dbName);

logSection("Schema baseline");
// Runs BEFORE any data is written, and this ordering is load-bearing.
//
// This script seeds documents in the shape the current code reads, so on a database it
// created there is nothing for SchemaMigrationRunner to do — and step 0 would actively
// fail, because its unique index on architectures.namespace permits one document per
// namespace while the new shape seeds several (finos.fluxnova alone has six). A failed
// step leaves the migration lock held and CalmHub refusing every request. So the schema
// version is pinned and the indexes step 0 would have created are created here instead.
//
// Two failure modes drive the ordering and the guard, both found reviewing #2923:
//
//   Pinning last meant a seed that died partway — the container killed, a disk full —
//   left new-shape headers with no version marker. Startup then ran step 0, its index
//   build failed on the duplicate namespaces, and the hub was bricked behind the held
//   lock with no way back short of clearing migrationLock by hand. Nothing re-runs this
//   script either: docker-entrypoint-initdb.d only fires on an empty data directory.
//   Writing the marker and the indexes first means an interrupted seed leaves a
//   startable hub with incomplete data instead of an unstartable one.
//
//   Guarding only on "no pre-migration architecture documents" was too narrow, because
//   the pin suppresses EVERY step, not just the architecture split. A database with
//   existing namespaces but no architectures passed that guard, so pinning silently
//   skipped NamespaceAccessBackfillStep (version 1 -> 2) and those namespaces never
//   received their `* read` grant — going dark once entitlements are enforced.
//
// Hence: pin only on a genuinely empty database, which is the only case this was ever
// meant for. Anything else keeps version 0 and lets the real migrations run.
//
// Raise LATEST_SCHEMA_VERSION whenever a migration step is added, and seed that step's
// target shape below. Document shape must match MongoSchemaVersionStore: _id
// "schemaVersion", int version, in the calm collection.
const LATEST_SCHEMA_VERSION = 14;
const unique = { unique: true };

const existingSchemaVersion = db.calm.findOne({ _id: "schemaVersion" });
const isEmptyDatabase = existingSchemaVersion === null
    && db.namespaces.countDocuments() === 0
    && db.architectures.countDocuments() === 0;

if (isEmptyDatabase) {
    db.calm.updateOne(
        { _id: "schemaVersion" },
        { $set: { version: NumberInt(LATEST_SCHEMA_VERSION) } },
        { upsert: true });

    // Mirrors MongoIndexInitializationStep, MongoLayoutIndexStep, and
    // MongoPatternLayoutIndexStep, which the pin above skips. Keep all four in step. All
    // seven versioned types now use the header/version shape (ADR 0001), so each gets a
    // unique (namespace, <type>Id) instead of the old unique (namespace) — which is what
    // allows more than one resource of a type per namespace at all — plus a unique
    // (namespace, <type>Id, version) on its sibling versions collection. Controls and
    // decorators keep the one-document-per-namespace index, by ADR 0004 rather than
    // pending migration. Layouts and pattern_layouts are a fourth, distinct shape: flat
    // and non-versioned, one document per (namespace, architectureId) / (namespace,
    // patternId), with no sibling versions collection and no version axis at all — see
    // MongoLayoutIndexStep / MongoPatternLayoutIndexStep. Do not fold either into the
    // one-document-per-namespace loop below.
    db.namespaces.createIndex({ name: 1 }, unique);
    db.domains.createIndex({ name: 1 }, unique);
    db.schemas.createIndex({ version: 1 }, unique);

    db.architectures.createIndex({ namespace: 1, architectureId: 1 }, unique);
    db.architectureVersions.createIndex({ namespace: 1, architectureId: 1, version: 1 }, unique);
    db.patterns.createIndex({ namespace: 1, patternId: 1 }, unique);
    db.patternVersions.createIndex({ namespace: 1, patternId: 1, version: 1 }, unique);
    db.flows.createIndex({ namespace: 1, flowId: 1 }, unique);
    db.flowVersions.createIndex({ namespace: 1, flowId: 1, version: 1 }, unique);
    // Standards are not seeded by this script, but the indexes still have to match the
    // shape the store reads, since pinning the version skips the migration that creates them.
    db.standards.createIndex({ namespace: 1, standardId: 1 }, unique);
    db.standardVersions.createIndex({ namespace: 1, standardId: 1, version: 1 }, unique);
    db.interfaces.createIndex({ namespace: 1, interfaceId: 1 }, unique);
    db.interfaceVersions.createIndex({ namespace: 1, interfaceId: 1, version: 1 }, unique);
    // Timelines are not seeded by this script, but the indexes still have to match the
    // shape the store reads, since pinning the version skips the migration that creates them.
    db.timelines.createIndex({ namespace: 1, timelineId: 1 }, unique);
    db.timelineVersions.createIndex({ namespace: 1, timelineId: 1, version: 1 }, unique);
    db.adrs.createIndex({ namespace: 1, adrId: 1 }, unique);
    db.adrVersions.createIndex({ namespace: 1, adrId: 1, version: 1 }, unique);
    db.layouts.createIndex({ namespace: 1, architectureId: 1 }, unique);
    db.pattern_layouts.createIndex({ namespace: 1, patternId: 1 }, unique);

    // Still one document per namespace until each of these migrates, at which point its
    // entry moves up alongside architectures and patterns.
    // Decorator is the only namespaced collection left on the one-document-per-namespace
    // shape — it is not versioned at all, so this redesign does not touch it (ADR 0004).
    for (const collection of ["decorators"]) {
        db[collection].createIndex({ namespace: 1 }, unique);
    }
    db.controls.createIndex({ domain: 1 }, unique);

    // Two partial indexes rather than one compound: namespace-scoped and domain-scoped
    // grant documents share no discriminating field.
    db.userAccess.createIndex({ username: 1, namespace: 1, permission: 1 },
        { unique: true, partialFilterExpression: { namespace: { $exists: true } } });
    db.userAccess.createIndex({ username: 1, domain: 1, permission: 1 },
        { unique: true, partialFilterExpression: { domain: { $exists: true } } });

    // Non-unique: the audit trail is append-only with no uniqueness invariant, so these
    // only support AuditLogStore's lookup shapes.
    db.auditLogs.createIndex({ namespace: 1, entityType: 1, entityId: 1, timestamp: -1 });
    db.auditLogs.createIndex({ domain: 1, entityType: 1, entityId: 1, timestamp: -1 });
    db.auditLogs.createIndex({ actor: 1, timestamp: -1 });
    db.auditLogs.createIndex({ timestamp: -1 });

    logSuccess(`Recorded schema version ${LATEST_SCHEMA_VERSION} and created indexes — startup migrations will be skipped`);
} else {
    logSkip("Existing database — leaving the schema version and indexes to SchemaMigrationRunner. "
        + "Any data seeded below is additive; the migrations will bring the rest of the database up to date.");
}

logSection("Counters");
// Insert the initial counter document if it doesn't exist
if (db.counters.countDocuments({ _id: "patternStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "patternStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized patternStoreCounter with sequence_value 2");
} else {
    const patternUpgrade = db.counters.updateOne(
        { _id: "patternStoreCounter", sequence_value: { $lt: 2 } },
        { $set: { sequence_value: 2 } }
    );
    if (patternUpgrade.modifiedCount > 0) {
        logSuccess("Upgraded patternStoreCounter to sequence_value 2 (was below minimum)");
    } else {
        logSkip("patternStoreCounter already exists with sequence_value >= 2, no update needed");
    }
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 11
    });
    logSuccess("Initialized architectureStoreCounter with sequence_value 11");
} else {
    const architectureUpgrade = db.counters.updateOne(
        { _id: "architectureStoreCounter", sequence_value: { $lt: 11 } },
        { $set: { sequence_value: 11 } }
    );
    if (architectureUpgrade.modifiedCount > 0) {
        logSuccess("Upgraded architectureStoreCounter to sequence_value 11 (was below minimum)");
    } else {
        logSkip("architectureStoreCounter already exists with sequence_value >= 11, no update needed");
    }
}

if (db.counters.countDocuments({ _id: "adrStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "adrStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized adrStoreCounter with sequence_value 1");
} else {
    logSkip("adrStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "standardStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "standardStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized standardStoreCounter with sequence_value 1");
} else {
    logSkip("standardStoreCounter already exists, no initialization needed");
}


if (db.counters.countDocuments({ _id: "flowStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "flowStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized flowStoreCounter with sequence_value 2");
} else {
    const flowUpgrade = db.counters.updateOne(
        { _id: "flowStoreCounter", sequence_value: { $lt: 2 } },
        { $set: { sequence_value: 2 } }
    );
    if (flowUpgrade.modifiedCount > 0) {
        logSuccess("Upgraded flowStoreCounter to sequence_value 2 (was below minimum)");
    } else {
        logSkip("flowStoreCounter already exists with sequence_value >= 2, no update needed");
    }
}

if (db.counters.countDocuments({ _id: "userAccessStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "userAccessStoreCounter",
        sequence_value: 12
    });
    logSuccess("Initialized userAccessStoreCounter with sequence_value 12");
} else {
    logSkip("userAccessStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "controlStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "controlStoreCounter",
        sequence_value: 18
    });
    logSuccess("Initialized controlStoreCounter with sequence_value 18");
} else {
    logSkip("controlStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "decoratorStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "decoratorStoreCounter",
        sequence_value: 4
    });
    logSuccess("Initialized decoratorStoreCounter with sequence_value 4");
} else {
    logSkip("decoratorStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "interfaceStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "interfaceStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized interfaceStoreCounter with sequence_value 2");
} else {
    logSkip("interfaceStoreCounter already exists, no initialization needed");
}

logSection("Schemas");
// Load schemas dynamically from the CALM release and draft directories.
// Set CALM_SCHEMA_BASE_PATH env var to override the default base path (/calm).
const fs = require('fs');
const basePath = (typeof process !== 'undefined' && process.env.CALM_SCHEMA_BASE_PATH)
    ? process.env.CALM_SCHEMA_BASE_PATH
    : '/calm';

// Load controls dynamically from domain subdirectories.
// Set CALM_CONTROLS_BASE_PATH env var to override the default base path (/controls).
const controlsBasePath = (typeof process !== 'undefined' && process.env.CALM_CONTROLS_BASE_PATH)
    ? process.env.CALM_CONTROLS_BASE_PATH
    : '/controls';

function loadSchemasFromDir(baseDir, prefix) {
    if (!fs.existsSync(baseDir)) {
        logFail(`Schema directory not found at ${baseDir}, skipping`);
        logFail(`Set CALM_SCHEMA_BASE_PATH environment variable to load schemas from a different location`);
        return;
    }
    const versions = fs.readdirSync(baseDir).filter(f =>
        fs.statSync(`${baseDir}/${f}`).isDirectory() && !f.startsWith('.')
    );
    for (const ver of versions) {
        const version = `${prefix}/${ver}`;
        if (db.schemas.countDocuments({ version: version }) === 0) {
            const metaPath = `${baseDir}/${ver}/meta`;
            if (fs.existsSync(metaPath)) {
                const schemaFiles = fs.readdirSync(metaPath).filter(f => f.endsWith('.json'));
                const schemas = {};
                for (const file of schemaFiles) {
                    schemas[file] = JSON.parse(fs.readFileSync(`${metaPath}/${file}`, 'utf8'));
                }
                db.schemas.insertOne({ version, schemas });
                logSuccess(`Inserted schemas for version ${version}`);
            }
        } else {
            logSkip(`Schemas for version ${version} already exist, skipping`);
        }
    }
}

loadSchemasFromDir(`${basePath}/release`, 'release');
loadSchemasFromDir(`${basePath}/draft`, 'draft');

function loadControlsFromDir(baseDir) {
    if (!fs.existsSync(baseDir)) {
        logFail(`Controls directory not found at ${baseDir}, skipping`);
        logFail(`Set CALM_CONTROLS_BASE_PATH environment variable to load controls from a different location`);
        return;
    }
    const domains = fs.readdirSync(baseDir).filter(f =>
        fs.statSync(`${baseDir}/${f}`).isDirectory() && !f.startsWith('.')
    );
    const domainDocs = [];
    for (const domain of domains) {
        const domainDir = `${baseDir}/${domain}`;
        const controlFiles = fs.readdirSync(domainDir).filter(f => f.endsWith('.json'));
        const controls = [];
        for (const file of controlFiles) {
            const control = JSON.parse(fs.readFileSync(`${domainDir}/${file}`, 'utf8'));
            control.controlId = NumberInt(control.controlId);
            if (Array.isArray(control.configurations)) {
                control.configurations = control.configurations.map(cfg => ({
                    ...cfg,
                    configurationId: NumberInt(cfg.configurationId)
                }));
            }
            controls.push(control);
        }
        domainDocs.push({ domain, controls });
    }
    if (domainDocs.length > 0) {
        db.controls.insertMany(domainDocs);
        logSuccess(`Inserted controls for domains: ${domainDocs.map(d => d.domain).join(', ')}`);
    }
}

logSection("Namespaces");
// Insert namespaces if they don't exist
if (db.namespaces.countDocuments() === 0) {
    db.namespaces.insertMany([
        { name: "finos", description: "FINOS namespace" },
        { name: "workshop", description: "Workshop namespace" },
        { name: "traderx", description: "TraderX namespace" },
        { name: "ai-governance-v2", description: "AI Governance v2 namespace" },
        { name: "qcon", description: "QCon scenario 3 namespace" },
        { name: "finos.fluxnova", description: "FluxNova BPM example architectures" }
    ]);
    logSuccess("Initialized namespaces: finos, workshop, traderx, ai-governance-v2, qcon, finos.fluxnova");
} else {
    logSkip("Namespaces already exist, no initialization needed");
}

logSection("Domains");
// Insert domains if they don't exist
if (db.domains.countDocuments() === 0) {
    db.domains.insertMany([
        { name: "security" },
        { name: "ai-governance" },
        { name: "mcp-controls" },
        { name: "network" },
        { name: "compliance" },
        { name: "observability" }
    ]);
    logSuccess("Initialized domains: security, ai-governance, mcp-controls, network, compliance, observability");
} else {
    logSkip("Domains already exist, no initialization needed");
}

logSection("Controls");
// Controls are loaded from files under CALM_CONTROLS_BASE_PATH (default: /controls).
// Each subdirectory represents a domain; each JSON file within is one control.
if (db.controls.countDocuments() === 0) {
    loadControlsFromDir(controlsBasePath);

    // Add Permitted Connection control to the file-seeded security domain
    db.controls.updateOne(
        { domain: "security" },
        {
            $push: {
                controls: {
                    controlId: NumberInt(2),
                    name: "Permitted Connection",
                    description: "Defines requirements for explicitly authorizing connections between services. Every connection must declare the protocol being used and provide a business justification for why the connection is necessary.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/release/1.0/meta/control.json",
                            "$id": "https://calm.finos.org/qcon/controls/permitted-connection.requirement.json",
                            "title": "Permitted Connection Control Requirement",
                            "description": "Defines requirements for explicitly authorizing connections between services. Every connection must declare the protocol being used and provide a business justification for why the connection is necessary.",
                            "control-id": "security-002",
                            "type": "object",
                            "properties": {
                                "reason": {
                                    "type": "string",
                                    "description": "Business justification for why this connection is required"
                                },
                                "protocol": {
                                    "type": "string",
                                    "enum": ["HTTP", "HTTPS", "JDBC", "gRPC", "WebSocket", "TCP", "UDP"],
                                    "description": "The network protocol used for this connection"
                                }
                            },
                            "required": [
                                "reason",
                                "protocol"
                            ]
                        }
                    },
                    configurations: [
                        {
                            configurationId: NumberInt(1),
                            versions: {
                                "1-0-0": {
                                    "reason": "MCP client and Trades API require HTTP access to MCP server for querying trade data",
                                    "protocol": "HTTP"
                                }
                            }
                        }
                    ]
                }
            }
        }
    );
    logSuccess("Added Permitted Connection control to security domain");

    // Insert Micro-Segmentation control for the network domain
    db.controls.insertOne({
        domain: "network",
        controls: [
            {
                controlId: NumberInt(3),
                name: "Micro-Segmentation",
                description: "Defines the requirement for Kubernetes clusters to support network policy enforcement through micro-segmentation. This control ensures that clusters can implement deny-by-default network policies and enforce fine-grained traffic rules between services.",
                requirement: {
                    "1-0-0": {
                        "$schema": "https://calm.finos.org/release/1.0/meta/control.json",
                        "$id": "https://calm.finos.org/qcon/scenario3/calm/controls/micro-segmentation.requirement.json",
                        "title": "Micro-Segmentation Control Requirement",
                        "description": "Defines the requirement for Kubernetes clusters to support network policy enforcement through micro-segmentation. This control ensures that clusters can implement deny-by-default network policies and enforce fine-grained traffic rules between services.",
                        "control-id": "security-001",
                        "type": "object",
                        "properties": {
                            "permit-ingress": {
                                "type": "boolean",
                                "description": "Whether to permit ingress traffic from external sources to services within the cluster"
                            },
                            "permit-egress": {
                                "type": "boolean",
                                "description": "Whether to permit egress traffic from services within the cluster to external destinations"
                            }
                        },
                        "required": [
                            "permit-ingress",
                            "permit-egress"
                        ]
                    }
                },
                configurations: [
                    {
                        configurationId: NumberInt(1),
                        versions: {
                            "1-0-0": {
                                "permit-ingress": true,
                                "permit-egress": false
                            }
                        }
                    }
                ]
            }
        ]
    });
    logSuccess("Initialized controls for network domain with Micro-Segmentation control");

    // Insert MCP Guardrail control for the mcp-controls domain
    db.controls.insertOne({
        domain: "mcp-controls",
        controls: [
            {
                controlId: NumberInt(4),
                name: "MCP Guardrail",
                description: "Defines a control for restricting access to specific trading symbols in an MCP server. This prevents queries for high-risk or restricted securities.",
                requirement: {
                    "1-0-0": {
                        "$schema": "https://calm.finos.org/release/1.0/meta/control.json",
                        "$id": "https://calm.finos.org/qcon/scenario3/calm/controls/mcp-guardrail.requirement.json",
                        "title": "MCP Guardrail Control",
                        "description": "Defines a control for restricting access to specific trading symbols in an MCP server. This prevents queries for high-risk or restricted securities.",
                        "control-id": "mcp-001",
                        "type": "object",
                        "properties": {
                            "denied-symbols": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                },
                                "description": "List of trading symbols that the MCP server must not allow access to"
                            },
                            "enforcement-point": {
                                "type": "string",
                                "description": "Where this control is enforced (e.g., 'mcp-server', 'api-gateway')"
                            }
                        },
                        "required": [
                            "denied-symbols",
                            "enforcement-point"
                        ]
                    }
                },
                configurations: [
                    {
                        configurationId: NumberInt(1),
                        versions: {
                            "1-0-0": {
                                "denied-symbols": ["VOD", "GME", "AMC"],
                                "enforcement-point": "mcp-server"
                            }
                        }
                    }
                ]
            }
        ]
    });
    logSuccess("Initialized controls for mcp-controls domain with MCP Guardrail control");
} else {
    logSkip("Controls already exist, no initialization needed");
}


logSection("Patterns");
// Gated on the database being empty for the same reason as architectures: Pattern is
// now seeded in the header/version shape, which needs the index swap the schema
// baseline performs. On a database this script did not create, that swap is left to
// the migration, so seeding the new shape here would leave documents step 0 chokes on.
if (isEmptyDatabase && db.patterns.countDocuments() === 0) {
    // Grouped by namespace for readability only — seedVersionedResource fans this out
    // into one header document per pattern plus one document per version.
    const patternsByNamespace = [
        {
            namespace: "finos",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "API Gateway Pattern",
                    description: "A pattern for securing and routing API traffic through a gateway with identity provider integration",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/finos/patterns/1/versions/1.0.0",
                            "title": "API Gateway Pattern",
                            "type": "object",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "well-known-endpoint": {
                                                    "type": "string"
                                                },
                                                "description": {
                                                    "const": "The API Gateway used to verify authorization and access to downstream system"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Gateway"
                                                },
                                                "unique-id": {
                                                    "const": "api-gateway"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "api-gateway-ingress"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "required": [
                                                "well-known-endpoint",
                                                "interfaces"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The API Consumer making an authenticated and authorized request"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Consumer"
                                                },
                                                "unique-id": {
                                                    "const": "api-consumer"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The API Producer serving content"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Producer"
                                                },
                                                "unique-id": {
                                                    "const": "api-producer"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "producer-ingress"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "required": [
                                                "interfaces"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The Identity Provider used to verify the bearer token"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "Identity Provider"
                                                },
                                                "unique-id": {
                                                    "const": "idp"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-consumer-api-gateway"
                                                },
                                                "description": {
                                                    "const": "Issue calculation request"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-consumer"
                                                            },
                                                            "destination": {
                                                                "node": "api-gateway",
                                                                "interfaces": [
                                                                    "api-gateway-ingress"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                "parties": {},
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "authentication": {
                                                    "const": "OAuth2"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-gateway-idp"
                                                },
                                                "description": {
                                                    "const": "Validate bearer token"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-gateway"
                                                            },
                                                            "destination": {
                                                                "node": "idp"
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-gateway-api-producer"
                                                },
                                                "description": {
                                                    "const": "Forward request"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-gateway"
                                                            },
                                                            "destination": {
                                                                "node": "api-producer",
                                                                "interfaces": [
                                                                    "producer-ingress"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-consumer-idp"
                                                },
                                                "description": {
                                                    "const": "Acquire a bearer token"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-consumer"
                                                            },
                                                            "destination": {
                                                                "node": "idp"
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                }
            ]
        },
        {
            namespace: "workshop",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "Conference Signup Pattern",
                    description: "A reusable architecture pattern for conference signup systems with Kubernetes deployment",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0",
                            "type": "object",
                            "title": "Conference Signup Pattern",
                            "description": "A reusable architecture pattern for conference signup systems with Kubernetes deployment.",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 5,
                                    "maxItems": 5,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website"
                                                },
                                                "name": {
                                                    "const": "Conference Website"
                                                },
                                                "description": {
                                                    "const": "Website to sign up for a conference"
                                                },
                                                "node-type": {
                                                    "const": "webclient"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "conference-website-url"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer"
                                                },
                                                "name": {
                                                    "const": "Load Balancer"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "network"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "load-balancer-host-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees"
                                                },
                                                "name": {
                                                    "const": "Attendees Service"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "service"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-store"
                                                },
                                                "name": {
                                                    "const": "Attendees Store"
                                                },
                                                "description": {
                                                    "const": "Persistent storage for attendees"
                                                },
                                                "node-type": {
                                                    "const": "database"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "k8s-cluster"
                                                },
                                                "name": {
                                                    "const": "Kubernetes Cluster"
                                                },
                                                "description": {
                                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 4,
                                    "maxItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-load-balancer"
                                                },
                                                "description": {
                                                    "const": "Request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "conference-website"
                                                            },
                                                            "destination": {
                                                                "node": "load-balancer"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-attendees-service"
                                                },
                                                "description": {
                                                    "const": "Forward"
                                                },
                                                "protocol": {
                                                    "const": "mTLS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "load-balancer"
                                                            },
                                                            "destination": {
                                                                "node": "attendees"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-attendees-store"
                                                },
                                                "description": {
                                                    "const": "Store or request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "JDBC"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "attendees"
                                                            },
                                                            "destination": {
                                                                "node": "attendees-store"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "deployed-in-k8s-cluster"
                                                },
                                                "description": {
                                                    "const": "Components deployed on the k8s cluster"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "deployed-in": {
                                                            "container": "k8s-cluster",
                                                            "nodes": [
                                                                "load-balancer",
                                                                "attendees",
                                                                "attendees-store"
                                                            ]
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                },
                {
                    patternId: NumberInt(2),
                    name: "Conference Secure Signup Pattern",
                    description: "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/2/versions/1.0.0",
                            "type": "object",
                            "title": "Conference Secure Signup Pattern",
                            "description": "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment.",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 5,
                                    "maxItems": 5,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website"
                                                },
                                                "name": {
                                                    "const": "Conference Website"
                                                },
                                                "description": {
                                                    "const": "Website to sign up for a conference"
                                                },
                                                "node-type": {
                                                    "const": "webclient"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "conference-website-url"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer"
                                                },
                                                "name": {
                                                    "const": "Load Balancer"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "network"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "load-balancer-host-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees"
                                                },
                                                "name": {
                                                    "const": "Attendees Service"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "service"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-store"
                                                },
                                                "name": {
                                                    "const": "Attendees Store"
                                                },
                                                "description": {
                                                    "const": "Persistent storage for attendees"
                                                },
                                                "node-type": {
                                                    "const": "database"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "k8s-cluster"
                                                },
                                                "name": {
                                                    "const": "Kubernetes Cluster"
                                                },
                                                "description": {
                                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security requirements for the Kubernetes cluster"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-load-balancer"
                                                },
                                                "description": {
                                                    "const": "Request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "conference-website"
                                                            },
                                                            "destination": {
                                                                "node": "load-balancer"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-attendees"
                                                },
                                                "description": {
                                                    "const": "Forward"
                                                },
                                                "protocol": {
                                                    "const": "mTLS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "load-balancer"
                                                            },
                                                            "destination": {
                                                                "node": "attendees"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-attendees-store"
                                                },
                                                "description": {
                                                    "const": "Store or request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "JDBC"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "attendees"
                                                            },
                                                            "destination": {
                                                                "node": "attendees-store"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description",
                                                "controls"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "deployed-in-k8s-cluster"
                                                },
                                                "description": {
                                                    "const": "Components deployed on the k8s cluster"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "deployed-in": {
                                                            "container": "k8s-cluster",
                                                            "nodes": [
                                                                "load-balancer",
                                                                "attendees",
                                                                "attendees-store"
                                                            ]
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                }
            ]
        },
        {
            namespace: "qcon",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "Trades API and MCP Pattern",
                    description: "A pattern for an MCP-based architecture with enforced network segmentation and connection controls. The Kubernetes cluster must have micro-segmentation enabled, and all connections must be explicitly permitted through controls.",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.0/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/qcon/patterns/trades-api-and-mcp/versions/1.0.0",
                            "title": "Secure Trades API and MCP Pattern with Network Controls",
                            "description": "A pattern for an MCP-based architecture with enforced network segmentation and connection controls. The Kubernetes cluster must have micro-segmentation enabled, and all connections must be explicitly permitted through controls.",
                            "type": "object",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 4,
                                    "maxItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                                            "properties": {
                                                "unique-id": { "const": "mcp-client" },
                                                "name": { "const": "Claude" },
                                                "description": { "const": "MCP client that queries trade data using natural language via the MCP server" },
                                                "node-type": { "const": "actor" }
                                            },
                                            "required": ["unique-id", "name", "description", "node-type"]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                                            "properties": {
                                                "unique-id": { "const": "mcp-server" },
                                                "name": { "const": "Trades MCP Server" },
                                                "description": { "const": "MCP server that exposes tools for querying and interacting with trade data" },
                                                "node-type": { "const": "service" },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "#/defs/container-image-interface",
                                                            "properties": { "unique-id": { "const": "mcp-server-image" } },
                                                            "required": ["unique-id", "image"]
                                                        },
                                                        {
                                                            "$ref": "#/defs/port-interface",
                                                            "properties": { "unique-id": { "const": "mcp-server-port" } },
                                                            "required": ["unique-id", "port"]
                                                        }
                                                    ]
                                                },
                                                "controls": {
                                                    "type": "object",
                                                    "properties": {
                                                        "mcp-guardrail": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": { "const": "Enforces restrictions on trading symbols that the MCP server cannot access" },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "type": "object",
                                                                            "properties": {
                                                                                "requirement-url": { "const": "controls/mcp-guardrail.requirement.json" },
                                                                                "config-url": { "const": "controls/mcp-guardrail.config.json" }
                                                                            },
                                                                            "required": ["requirement-url", "config-url"]
                                                                        }
                                                                    ]
                                                                }
                                                            },
                                                            "required": ["description", "requirements"]
                                                        }
                                                    },
                                                    "required": ["mcp-guardrail"]
                                                }
                                            },
                                            "required": ["unique-id", "name", "description", "node-type", "interfaces"]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                                            "properties": {
                                                "unique-id": { "const": "trades-api" },
                                                "name": { "const": "Trades API" },
                                                "description": { "const": "REST API for accessing and managing trade data" },
                                                "node-type": { "const": "service" },
                                                "details": {
                                                    "type": "object",
                                                    "properties": {
                                                        "required-pattern": { "const": "trades-api.pattern.json" }
                                                    },
                                                    "required": ["required-pattern"]
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "#/defs/container-image-interface",
                                                            "properties": { "unique-id": { "const": "trades-api-image" } },
                                                            "required": ["unique-id", "image"]
                                                        },
                                                        {
                                                            "$ref": "#/defs/port-interface",
                                                            "properties": { "unique-id": { "const": "trades-api-port" } },
                                                            "required": ["unique-id", "port"]
                                                        }
                                                    ]
                                                }
                                            },
                                            "required": ["unique-id", "name", "description", "node-type", "interfaces"]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/node",
                                            "properties": {
                                                "unique-id": { "const": "k8s-cluster" },
                                                "name": { "const": "Kubernetes Cluster" },
                                                "description": { "const": "Kubernetes cluster with network policy enforcement" },
                                                "node-type": { "const": "system" },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "#/defs/cluster-type-interface",
                                                            "properties": { "unique-id": { "const": "cluster-type" } },
                                                            "required": ["unique-id", "value"]
                                                        }
                                                    ]
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": { "const": "Security requirements for the Kubernetes cluster" },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "requirement-url": { "const": "controls/micro-segmentation.requirement.json" },
                                                                                "config-url": { "const": "controls/micro-segmentation.config.json" }
                                                                            },
                                                                            "required": ["requirement-url", "config-url"]
                                                                        }
                                                                    ]
                                                                }
                                                            },
                                                            "required": ["description", "requirements"]
                                                        }
                                                    },
                                                    "required": ["security"]
                                                }
                                            },
                                            "required": ["unique-id", "name", "description", "node-type", "interfaces", "controls"]
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 3,
                                    "maxItems": 3,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": { "const": "mcp-client-to-mcp-server" },
                                                "description": { "const": "MCP client connects to MCP server to query trade data" },
                                                "protocol": { "const": "HTTP" },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": { "node": "mcp-client" },
                                                            "destination": { "node": "mcp-server", "interfaces": ["mcp-server-port"] }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": { "const": "Connection authorization for MCP client to MCP server" },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "type": "object",
                                                                            "properties": {
                                                                                "requirement-url": { "const": "controls/permitted-connection.requirement.json" },
                                                                                "config-url": { "const": "controls/permitted-connection-http.config.json" }
                                                                            }
                                                                        }
                                                                    ]
                                                                }
                                                            },
                                                            "required": ["description", "requirements"]
                                                        }
                                                    },
                                                    "required": ["security"]
                                                }
                                            },
                                            "required": ["unique-id", "description", "protocol", "relationship-type", "controls"]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": { "const": "mcp-server-to-trades-api" },
                                                "description": { "const": "MCP server connects to Trades API to fetch trade data" },
                                                "protocol": { "const": "HTTP" },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": { "node": "mcp-server" },
                                                            "destination": { "node": "trades-api", "interfaces": ["trades-api-port"] }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/release/1.0/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": { "const": "Connection authorization for MCP server to Trades API" },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "type": "object",
                                                                            "properties": {
                                                                                "requirement-url": { "const": "controls/permitted-connection.requirement.json" },
                                                                                "config-url": { "const": "controls/permitted-connection-http.config.json" }
                                                                            }
                                                                        }
                                                                    ]
                                                                }
                                                            },
                                                            "required": ["description", "requirements"]
                                                        }
                                                    },
                                                    "required": ["security"]
                                                }
                                            },
                                            "required": ["unique-id", "description", "protocol", "relationship-type", "controls"]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": { "const": "deployed-in-k8s-cluster" },
                                                "description": { "const": "MCP server and Trades API deployed on the Kubernetes cluster" },
                                                "relationship-type": {
                                                    "const": {
                                                        "deployed-in": {
                                                            "container": "k8s-cluster",
                                                            "nodes": ["mcp-server", "trades-api"]
                                                        }
                                                    }
                                                }
                                            },
                                            "required": ["unique-id", "description", "relationship-type"]
                                        }
                                    ]
                                }
                            },
                            "required": ["nodes", "relationships"],
                            "defs": {
                                "container-image-interface": {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/interface-type",
                                    "type": "object",
                                    "properties": { "image": { "type": "string" } },
                                    "required": ["image"]
                                },
                                "port-interface": {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/interface-type",
                                    "type": "object",
                                    "properties": { "port": { "type": "integer" } },
                                    "required": ["port"]
                                },
                                "cluster-type-interface": {
                                    "$ref": "https://calm.finos.org/release/1.0/meta/interface.json#/defs/interface-type",
                                    "type": "object",
                                    "properties": { "value": { "type": "string" } },
                                    "required": ["value"]
                                }
                            }
                        }
                    }
                }
            ]
        }
    ];
    const seededPatterns = seedVersionedResource(
        patternsByNamespace, "patterns", "patternVersions", "patterns", "patternId");
    logSuccess(`Initialized ${seededPatterns.headers} patterns and ${seededPatterns.versions} versions for finos, workshop, and qcon namespaces`);
} else if (!isEmptyDatabase) {
    logSkip("Existing database — not seeding patterns; the new shape needs the index swap "
        + "that SchemaMigrationRunner will perform on startup");
} else {
    logSkip("Patterns already initialized, skipping...");
}

logSection("Flows");
// Gated on the database being empty, like the other migrated types — the new shape
// depends on the index swap the schema baseline performs.
if (isEmptyDatabase && db.flows.countDocuments() === 0) {
    // Grouped by namespace for readability only — seedVersionedResource fans this out.
    const flowsByNamespace = [
        {
            namespace: "finos",
            flows: [
                {
                    flowId: NumberInt(1),
                    name: "Flow 1",
                    description: "This is a non-compliant flow document. Just creating something to simulate",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-1",
                            "title": "Flow 1",
                            "description": "This is a non-compliant flow document. Just creating something to simulate"
                        }
                    }
                },
                {
                    flowId: NumberInt(2),
                    name: "Flow 2",
                    description: "This is a non-compliant flow document. Just creating something to simulate",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-2",
                            "title": "Flow 2",
                            "description": "This is a non-compliant flow document. Just creating something to simulate"


                        }
                    }
                }
            ]
        },
        {
            namespace: "traderx",
            flows: [
                {
                    flowId: NumberInt(1),
                    name: "Add or Update Account",
                    description: "Flow for adding or updating account information in the database",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
                            "$id": "https://calm.finos.org/traderx/flows/add-update-account.json",
                            "unique-id": "flow-add-update-account",
                            "name": "Add or Update Account",
                            "description": "Flow for adding or updating account information in the database.",
                            "transitions": [
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 1,
                                    "summary": "Submit Account Create/Update"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 2,
                                    "summary": "inserts or updates account"
                                },
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 3,
                                    "summary": "Returns Account Create/Update Response Status",
                                    "direction": "destination-to-source"
                                }
                            ],
                            "controls": {
                                "add-update-account-sla": {
                                    "description": "Control requirement for flow SLA",
                                    "requirements": [
                                        {
                                            "control-requirement-url": "https://calm.finos.org/samples/traderx/controls/flow-sla-control-requirement.json",
                                            "control-config": "https://calm.finos.org/samples/traderx/flows/add-update-account/add-update-account-control-configuration.json"
                                        }
                                    ]
                                }
                            }
                        }

                    }
                },
                {
                    flowId: NumberInt(2),
                    name: "Load List of Accounts",
                    description: "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection",
                    versions:
                    {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
                            "$id": "https://calm.finos.org/samples/traderx/flows/load-list-of-accounts.json",
                            "unique-id": "flow-load-list-of-accounts",
                            "name": "Load List of Accounts",
                            "description": "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection.",
                            "transitions": [
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 1,
                                    "summary": "Load list of accounts"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 2,
                                    "summary": "Query for all Accounts"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 3,
                                    "summary": "Returns list of accounts",
                                    "direction": "destination-to-source"
                                },
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 4,
                                    "summary": "Returns list of accounts",
                                    "direction": "destination-to-source"
                                }
                            ]
                        }

                    }
                }
            ]
        }
    ];

    const seededFlows = seedVersionedResource(
        flowsByNamespace, "flows", "flowVersions", "flows", "flowId");
    logSuccess(`Initialized ${seededFlows.headers} flows and ${seededFlows.versions} versions for finos and traderx namespaces`);
} else if (!isEmptyDatabase) {
    logSkip("Existing database — not seeding flows; the new shape needs the index swap "
        + "that SchemaMigrationRunner will perform on startup");
} else {
    logSkip("Flows already initialized, skipping...");
}

logSection("Architectures");
// Gated on the database being empty, unlike the other types. Architecture is the only one
// seeded in the header/version shape, which needs the unique index swap above to permit
// several documents per namespace. On a database this script did not create, that swap is
// deliberately left to the migration — so seeding the new shape here anyway would leave
// documents that step 0's index build then chokes on, bricking startup behind the
// migration lock. The other types are seeded in the shape step 0's indexes already expect.
if (isEmptyDatabase && db.architectures.countDocuments() === 0) {
    // Grouped by namespace for readability only — seedVersionedResource fans this out into
    // one header document per architecture plus one document per version.
    const architecturesByNamespace = [
        {
            namespace: "finos",
            architectures: [{
                architectureId: NumberInt(1),
                name: "Architecture 1",
                description: "This is a non-compliant arch document. Just creating something to simulate",
                versions:
                {
                    "1.0.0": {
                        "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                        "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/arch-1",
                        "title": "Architecture 1",
                        "description": "This is a non-compliant arch document. Just creating something to simulate"
                    }
                }
            }]
        },
        {
            namespace: "workshop",
            architectures: [
                {
                    architectureId: NumberInt(2),
                    name: "Conference Signup Architecture",
                    description: "Conference signup system with load-balanced services and Kubernetes deployment",
                    versions:
                    {
                        "1.0.0": {
                            "nodes": [
                                {
                                    "unique-id": "conference-website",
                                    "name": "Conference Website",
                                    "description": "Website to sign up for a conference",
                                    "node-type": "webclient",
                                    "interfaces": [
                                        {
                                            "unique-id": "conference-website-url",
                                            "url": "[[ URL ]]"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "load-balancer",
                                    "name": "Load Balancer",
                                    "description": "The attendees service, or a placeholder for another application",
                                    "node-type": "network",
                                    "interfaces": [
                                        {
                                            "unique-id": "load-balancer-host-port",
                                            "host": "[[ HOST ]]",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "attendees",
                                    "name": "Attendees Service",
                                    "description": "The attendees service, or a placeholder for another application",
                                    "node-type": "service",
                                    "interfaces": [
                                        {
                                            "unique-id": "attendees-image",
                                            "image": "[[ IMAGE ]]"
                                        },
                                        {
                                            "unique-id": "attendees-port",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "attendees-store",
                                    "name": "Attendees Store",
                                    "description": "Persistent storage for attendees",
                                    "node-type": "database",
                                    "interfaces": [
                                        {
                                            "unique-id": "database-image",
                                            "image": "[[ IMAGE ]]"
                                        },
                                        {
                                            "unique-id": "database-port",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "k8s-cluster",
                                    "name": "Kubernetes Cluster",
                                    "description": "Kubernetes Cluster with network policy rules enabled",
                                    "node-type": "system"
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "conference-website-load-balancer",
                                    "description": "Request attendee details",
                                    "protocol": "HTTPS",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "conference-website"
                                            },
                                            "destination": {
                                                "node": "load-balancer"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "load-balancer-attendees-service",
                                    "description": "Forward",
                                    "protocol": "mTLS",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "load-balancer"
                                            },
                                            "destination": {
                                                "node": "attendees"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "attendees-attendees-store",
                                    "description": "Store or request attendee details",
                                    "protocol": "JDBC",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "attendees"
                                            },
                                            "destination": {
                                                "node": "attendees-store"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "deployed-in-k8s-cluster",
                                    "description": "Components deployed on the k8s cluster",
                                    "relationship-type": {
                                        "deployed-in": {
                                            "container": "k8s-cluster",
                                            "nodes": [
                                                "load-balancer",
                                                "attendees",
                                                "attendees-store"
                                            ]
                                        }
                                    }
                                }
                            ],
                            "metadata": [
                                {
                                    "kubernetes": {
                                        "namespace": "conference"
                                    }
                                }
                            ],
                            "adrs": [
                                "https://github.com/org/project/docs/adr/0001-use-load-balancer.md",
                                "https://github.com/org/project/docs/adr/0002-use-kubernetes.md",
                                "/calm/namespaces/workshop/adrs/1"
                            ],
                            "$schema": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0"
                        }
                    }
                }
            ]
        },
        {
            namespace: "traderx",
            architectures: [{
                architectureId: NumberInt(3),
                name: "TraderX",
                description: "Simple Trading System architecture",
                versions:
                {
                    "1.0.0": {
                        "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
                        "nodes": [
                            {
                                "unique-id": "traderx-system",
                                "node-type": "system",
                                "name": "TraderX",
                                "description": "Simple Trading System"
                            },
                            {
                                "unique-id": "traderx-trader",
                                "node-type": "actor",
                                "name": "Trader",
                                "description": "Person who manages accounts and executes trades"
                            },
                            {
                                "unique-id": "web-client",
                                "node-type": "webclient",
                                "name": "Web Client",
                                "description": "Browser based web interface for TraderX",
                                "data-classification": "Confidential",
                                "run-as": "user"
                            },
                            {
                                "unique-id": "web-gui-process",
                                "node-type": "service",
                                "name": "Web GUI",
                                "description": "Allows employees to manage accounts and book trades",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "position-service",
                                "node-type": "service",
                                "name": "Position Service",
                                "description": "Server process which processes trading activity and updates positions",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "traderx-db",
                                "node-type": "database",
                                "name": "TraderX DB",
                                "description": "Database which stores account, trade and position state",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "internal-bank-network",
                                "node-type": "network",
                                "name": "Bank ABC Internal Network",
                                "description": "Internal network for Bank ABC",
                                "instance": "Internal Network"
                            },
                            {
                                "unique-id": "reference-data-service",
                                "node-type": "service",
                                "name": "Reference Data Service",
                                "description": "Service which provides reference data",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trading-services",
                                "node-type": "service",
                                "name": "Trading Services",
                                "description": "Service which provides trading services",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trade-feed",
                                "node-type": "service",
                                "name": "Trade Feed",
                                "description": "Message bus for streaming updates to trades and positions",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trade-processor",
                                "node-type": "service",
                                "name": "Trade Processor",
                                "description": "Process incoming trade requests, settle and persist",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "accounts-service",
                                "node-type": "service",
                                "name": "Accounts Service",
                                "description": "Service which provides account management",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "people-service",
                                "node-type": "service",
                                "name": "People Service",
                                "description": "Service which provides user details management",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "user-directory",
                                "node-type": "ldap",
                                "name": "User Directory",
                                "description": "Golden source of user data",
                                "data-classification": "PII",
                                "run-as": "systemId"
                            }
                        ],
                        "relationships": [
                            {
                                "unique-id": "trader-executes-trades",
                                "description": "Executes Trades",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "trader-manages-accounts",
                                "description": "Manage Accounts",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "trader-views-trade-status",
                                "description": "View Trade Status / Positions",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "web-client-uses-web-gui",
                                "description": "Web client interacts with the Web GUI process.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-client"
                                        },
                                        "destination": {
                                            "node": "web-gui-process"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-uses-position-service-for-position-queries",
                                "description": "Load positions for account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "position-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-uses-position-service-for-trade-queries",
                                "description": "Load trades for account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "position-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "position-service-uses-traderx-db-for-positions",
                                "description": "Looks up default positions for a given account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "position-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "position-service-uses-traderx-db-for-trades",
                                "description": "Looks up all trades for a given account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "position-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "traderx-system-is-deployed-in-internal-bank-network",
                                "relationship-type": {
                                    "deployed-in": {
                                        "container": "internal-bank-network",
                                        "nodes": [
                                            "traderx-system"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "traderx-system-is-composed-of",
                                "relationship-type": {
                                    "composed-of": {
                                        "container": "traderx-system",
                                        "nodes": [
                                            "web-client",
                                            "web-gui-process",
                                            "position-service",
                                            "traderx-db",
                                            "people-service",
                                            "reference-data-service",
                                            "trading-services",
                                            "trade-feed",
                                            "trade-processor",
                                            "accounts-service"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "traderx-system-components-are-deployed-in-internal-bank-network",
                                "relationship-type": {
                                    "deployed-in": {
                                        "container": "internal-bank-network",
                                        "nodes": [
                                            "web-client",
                                            "web-gui-process",
                                            "position-service",
                                            "traderx-db",
                                            "people-service",
                                            "reference-data-service",
                                            "trading-services",
                                            "trade-feed",
                                            "trade-processor",
                                            "accounts-service",
                                            "user-directory"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "web-gui-process-uses-reference-data-service",
                                "description": "Looks up securities to assist with creating a trade ticket.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "reference-data-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-trading-services",
                                "description": "Creates new trades and cancels existing trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "trading-services"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-trade-feed",
                                "description": "Subscribes to trade/position updates feed for currently viewed account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "WebSocket"
                            },
                            {
                                "unique-id": "trade-processor-connects-to-trade-feed",
                                "description": "Processes incoming trade requests, persist and publish updates.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trade-processor"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "SocketIO"
                            },
                            {
                                "unique-id": "trade-processor-connects-to-traderx-db",
                                "description": "Looks up current positions when bootstrapping state, persist trade state and position state.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trade-processor"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "web-gui-process-uses-accounts-service",
                                "description": "Creates/Updates accounts. Gets list of accounts.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "accounts-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-people-service",
                                "description": "Looks up people data based on typeahead from GUI.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "people-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "people-service-connects-to-user-directory",
                                "description": "Looks up people data.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "people-service"
                                        },
                                        "destination": {
                                            "node": "user-directory"
                                        }
                                    }
                                },
                                "protocol": "LDAP"
                            },
                            {
                                "unique-id": "trading-services-connects-to-reference-data-service",
                                "description": "Validates securities when creating trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "reference-data-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "trading-services-uses-trade-feed",
                                "description": "Publishes updates to trades and positions after persisting in the DB.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "trading-services-uses-account-service",
                                "description": "Validates accounts when creating trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "accounts-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                "description": "CRUD operations on account",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "accounts-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            }
                        ]
                    }
                }
            }]
        },
        {
            namespace: "ai-governance-v2",
            architectures: [{
                architectureId: NumberInt(4),
                name: "mcp-api-pipeline",
                description: "User → MCP Server (cloud-hosted) → API Service → Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
                versions: {
                    "1.0.0": {
                        "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
                        "unique-id": "mcp-api-pipeline",
                        "name": "MCP Server API Pipeline",
                        "description": "User → MCP Server (cloud-hosted) → API Service → Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
                        "nodes": [
                            {
                                "unique-id": "user",
                                "name": "User",
                                "description": "Human end-user interacting with the MCP Server via a client application.",
                                "node-type": "actor",
                                "interfaces": [
                                    {
                                        "unique-id": "user-interface",
                                        "name": "User Client Interface"
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/12/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-020",
                                        "name": "Reputational Risk",
                                        "description": "The User receives all AI-generated outputs. Content filtering, output moderation, and AI disclosure must be applied to prevent harmful or misleading content reaching users at scale.",
                                        "requirements": [
                                            "Implement output content filtering before responses are returned to the User.",
                                            "Display AI disclosure notices to the User at session start.",
                                            "Monitor user feedback channels for harm signals from AI outputs.",
                                            "Establish an AI incident response and user remediation process."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/9/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-017",
                                        "name": "Lack of Explainability",
                                        "description": "Users receiving AI-generated responses must be able to understand the basis of outputs, particularly for high-stakes decisions. Source citations and rationale must be surfaced in the User interface.",
                                        "requirements": [
                                            "Surface citations and source document references in all AI-generated responses shown to the User.",
                                            "Provide human-readable rationales for AI recommendations in the User interface.",
                                            "Enable Users to escalate any AI-generated decision to a human agent."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "mcp-server",
                                "name": "MCP Server",
                                "description": "Cloud-hosted Model Context Protocol server. Orchestrates LLM interactions, manages tool calls, and proxies requests to the API Service.",
                                "node-type": "service",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "mcp-server-ingress",
                                        "name": "MCP Server Ingress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    },
                                    {
                                        "unique-id": "mcp-server-egress",
                                        "name": "MCP Server API Egress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-010",
                                        "name": "Prompt Injection",
                                        "description": "The MCP Server ingress is the primary prompt injection attack surface. All user inputs must be validated and sanitised before passing to the LLM or downstream services.",
                                        "requirements": [
                                            "Deploy an AI firewall at the MCP Server ingress to detect and block prompt injection patterns.",
                                            "Sanitise all user-supplied content before inclusion in LLM prompts.",
                                            "Enforce strict system-prompt hierarchy so user messages cannot override system-level instructions.",
                                            "Monitor MCP Server outputs for data exfiltration patterns or instruction-echoing.",
                                            "Conduct regular red-team exercises targeting the MCP Server prompt injection surface."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/3/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-004",
                                        "name": "Hallucination and Inaccurate Outputs",
                                        "description": "The MCP Server is where LLM inference occurs. RAG grounding, output validation, and human-review gates must be applied before responses reach the User.",
                                        "requirements": [
                                            "Implement RAG grounding using verified data sourced from the API Service.",
                                            "Apply output validation pipelines to MCP Server responses before delivery to the User.",
                                            "Route high-stakes outputs through a human-review queue prior to delivery.",
                                            "Log and monitor hallucination incidents by frequency and business impact."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/4/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-005",
                                        "name": "Foundation Model Versioning",
                                        "description": "The MCP Server integrates foundation models whose provider-side updates can cause silent behavioural changes propagating through the entire pipeline.",
                                        "requirements": [
                                            "Pin foundation model versions; only upgrade after regression testing and sign-off.",
                                            "Maintain a model version registry covering all models used by the MCP Server.",
                                            "Obtain advance notification of model changes from providers via contractual obligation.",
                                            "Implement automated regression test suites triggered by model version changes.",
                                            "Define and test rollback procedures to prior pinned model versions."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/6/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-007",
                                        "name": "Availability of Foundational Model",
                                        "description": "The MCP Server depends on GPU-backed third-party model infrastructure. Denial of Wallet attacks, TSP outages, and token exhaustion can render the MCP Server unavailable.",
                                        "requirements": [
                                            "Implement API rate limiting and token budget controls at the MCP Server.",
                                            "Define SLAs with model providers and monitor compliance.",
                                            "Design failover strategies including fallback to alternative model providers.",
                                            "Apply prompt length controls and chunking strategies to prevent token exhaustion."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-024",
                                        "name": "Agent Action Authorization Bypass",
                                        "description": "The MCP Server acts as an AI agent invoking tools and calling the API Service. Injected instructions could trigger unauthorised operations without strict authorisation controls.",
                                        "requirements": [
                                            "Assign the MCP Server least-privilege permissions scoped to required tools and operations only.",
                                            "Implement human-in-the-loop approval gates for irreversible or high-risk API actions.",
                                            "Validate all MCP-to-API requests against an authorised action policy before execution.",
                                            "Log all MCP-originated actions with full user context and authorisation decision."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/7/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-014",
                                        "name": "Inadequate System Alignment",
                                        "description": "MCP Server responses must remain aligned with the system's intended scope. Misalignment can cause scope boundary violations and regulatory exposure.",
                                        "requirements": [
                                            "Define the authorised scope of the MCP Server via system prompt guardrails.",
                                            "Implement continuous alignment monitoring against golden evaluation datasets.",
                                            "Perform prompt injection testing on all content retrieved and injected into prompts.",
                                            "Implement alignment drift detection to trigger re-evaluation when quality degrades."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/8/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-016",
                                        "name": "Bias and Discrimination",
                                        "description": "LLM outputs generated by the MCP Server may reflect training data biases, producing discriminatory responses to users.",
                                        "requirements": [
                                            "Conduct bias audits on MCP Server outputs prior to production launch and at regular intervals.",
                                            "Test for disparate impact across protected user characteristics.",
                                            "Establish a bias incident response process including user remediation procedures."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/18/versions/1-0-0"
                                        },
                                        "control-id": "AIR-RC-023",
                                        "name": "Intellectual Property and Copyright",
                                        "description": "The MCP Server LLM may reproduce copyrighted content from training data in its outputs.",
                                        "requirements": [
                                            "Implement output filters to detect and suppress reproduction of copyrighted material.",
                                            "Ensure model provider contracts include IP indemnification clauses.",
                                            "Train operators on IP risks associated with AI-generated content."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "api-service",
                                "name": "API Service",
                                "description": "Backend REST API service that processes requests from the MCP Server, applies business logic, and reads/writes data to the Database.",
                                "node-type": "service",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "api-service-ingress",
                                        "name": "API Service Ingress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    },
                                    {
                                        "unique-id": "api-service-db-egress",
                                        "name": "API Service Database Egress",
                                        "protocol": "TCP",
                                        "port": 5432
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/17/versions/1-0-0"
                                        },
                                        "control-id": "AIR-RC-022",
                                        "name": "Regulatory Compliance and Oversight",
                                        "description": "The API Service is the enforcement point for regulatory business rules. It must maintain audit trails and support regulatory examination of AI-assisted decisions.",
                                        "requirements": [
                                            "Maintain an audit log of all MCP Server-originated requests and API Service responses.",
                                            "Enforce data classification and handling policies at the API Service layer.",
                                            "Produce decision records for all AI-assisted actions routed through the API Service.",
                                            "Retain request/response logs for the required regulatory retention period."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "The API Service is the data supply layer for the MCP Server RAG pipeline. Data quality issues or staleness here directly degrade AI output accuracy.",
                                        "requirements": [
                                            "Implement automated data quality checks (accuracy, completeness, timeliness) at the API Service ingestion layer.",
                                            "Monitor statistical properties of data served to the MCP Server to detect drift.",
                                            "Define data freshness SLAs per use case and enforce scheduled refresh cycles.",
                                            "Maintain data lineage records to support auditability of AI model inputs."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/10/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-018",
                                        "name": "Model Overreach / Expanded Use",
                                        "description": "The API Service must enforce scope boundaries, rejecting MCP Server requests that exceed the AI system's authorised use cases.",
                                        "requirements": [
                                            "Validate all incoming MCP Server requests against an approved API action register.",
                                            "Reject API calls corresponding to unauthorised or out-of-scope AI operations.",
                                            "Log all scope boundary violations for review by the AI governance function."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "database",
                                "name": "Database",
                                "description": "Persistent data store (relational and/or vector store for RAG) used by the API Service.",
                                "node-type": "datastore",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "database-ingress",
                                        "name": "Database Ingress",
                                        "protocol": "TCP",
                                        "port": 5432
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-002",
                                        "name": "Information Leaked to Vector Store",
                                        "description": "The Database may function as a vector store for the RAG pipeline. Embeddings can expose sensitive data via inversion or inference attacks without proper security controls.",
                                        "requirements": [
                                            "Enforce RBAC on the Database, scoping retrieval to the requesting user's authorisation.",
                                            "Encrypt all data at rest using AES-256 or equivalent approved standard.",
                                            "Implement comprehensive audit logging for all database queries.",
                                            "Classify all stored data and enforce classification-based retrieval policies.",
                                            "Conduct penetration testing targeting embedding inversion and membership inference attacks."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "The Database is the authoritative source of inference data for the RAG pipeline. Poor quality or stale data stored here propagates directly into AI outputs.",
                                        "requirements": [
                                            "Enforce data quality standards at write time including schema validation and completeness checks.",
                                            "Implement scheduled data freshness reviews and automated stale-data flagging.",
                                            "Maintain data lineage metadata for all records used in AI inference pipelines."
                                        ]
                                    }
                                ]
                            }
                        ],
                        "relationships": [
                            {
                                "unique-id": "user-to-mcp",
                                "name": "User to MCP Server",
                                "description": "User sends prompts and receives AI-generated responses via the MCP Server over HTTPS.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "user",
                                            "interface": "user-interface"
                                        },
                                        "destination": {
                                            "node": "mcp-server",
                                            "interface": "mcp-server-ingress"
                                        }
                                    }
                                },
                                "protocol": "HTTPS",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-010",
                                        "name": "Prompt Injection",
                                        "description": "This channel carries untrusted user input directly into the AI system — the highest-risk prompt injection vector. Input must be validated and firewall-inspected before any content reaches the LLM.",
                                        "requirements": [
                                            "Enforce TLS 1.2+ on the User-to-MCP channel.",
                                            "Apply AI firewall inspection on all user messages before LLM processing.",
                                            "Rate-limit user requests to prevent flooding or token-exhaustion attacks.",
                                            "Authenticate and authorise all user sessions before granting MCP Server access."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-028",
                                        "name": "Multi-Agent Trust Boundary Violations",
                                        "description": "The User-to-MCP boundary is an external trust boundary. The MCP Server must treat all inbound user messages as untrusted and enforce strict session isolation.",
                                        "requirements": [
                                            "Treat all user-supplied input as untrusted at the MCP Server ingress.",
                                            "Enforce strict context isolation so one user's session cannot influence another's agent context.",
                                            "Implement session-level sandboxing to limit blast radius of any injected instruction."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "mcp-to-api",
                                "name": "MCP Server to API Service",
                                "description": "MCP Server makes authenticated API calls to the API Service to fulfil tool calls and retrieve data for RAG grounding.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "mcp-server",
                                            "interface": "mcp-server-egress"
                                        },
                                        "destination": {
                                            "node": "api-service",
                                            "interface": "api-service-ingress"
                                        }
                                    }
                                },
                                "protocol": "HTTPS",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-024",
                                        "name": "Agent Action Authorization Bypass",
                                        "description": "This channel carries AI agent tool calls from the MCP Server to the API Service. Injected instructions could invoke unauthorised operations without enforcement here.",
                                        "requirements": [
                                            "Authenticate all MCP Server requests to the API Service using short-lived scoped credentials (mTLS or signed tokens).",
                                            "Enforce least-privilege: MCP Server credentials must only permit specifically required API operations.",
                                            "The API Service must validate each inbound request against the authorised action policy before execution.",
                                            "Require human approval for high-risk or irreversible API operations triggered via the MCP Server.",
                                            "Log all calls on this channel with full request context and authorisation outcome."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-028",
                                        "name": "Multi-Agent Trust Boundary Violations",
                                        "description": "This channel crosses the internal trust boundary between AI orchestration (MCP Server) and the data/logic layer (API Service). MCP Server compromise must not propagate unchecked into the API Service.",
                                        "requirements": [
                                            "Enforce mutual TLS (mTLS) on the MCP-to-API channel.",
                                            "The API Service must independently validate request authorisation — not blindly trust MCP Server-supplied context.",
                                            "Implement circuit breakers to halt MCP Server API calls during detected anomalies or security incidents."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "api-to-db",
                                "name": "API Service to Database",
                                "description": "API Service reads and writes data to the Database using an authenticated, encrypted database connection.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "api-service",
                                            "interface": "api-service-db-egress"
                                        },
                                        "destination": {
                                            "node": "database",
                                            "interface": "database-ingress"
                                        }
                                    }
                                },
                                "protocol": "TCP",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-002",
                                        "name": "Information Leaked to Vector Store",
                                        "description": "This channel carries sensitive embedding queries and raw data between the API Service and the Database. Data in transit must be encrypted and access strictly scoped.",
                                        "requirements": [
                                            "Enforce TLS encryption on the API Service-to-Database connection.",
                                            "Use parameterised queries to prevent SQL and vector injection attacks.",
                                            "Scope database credentials to the minimum required tables and operations.",
                                            "Propagate and audit user context on all data retrieval operations on this channel."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "Data flowing from the Database through this channel feeds the MCP Server RAG pipeline. Stale or degraded data directly impacts AI output accuracy.",
                                        "requirements": [
                                            "Implement query-time data freshness checks before returning data to the API Service.",
                                            "Filter records failing quality thresholds before inclusion in RAG context.",
                                            "Monitor query patterns for anomalies indicating data drift or unexpected schema changes."
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }]
        },
        {
            namespace: "qcon",
            architectures: [{
                architectureId: NumberInt(5),
                name: "Trades API and MCP Architecture (Conforming)",
                description: "Conforming architecture with all required controls: micro-segmentation on cluster, permitted connections on all relationships, and MCP guardrail on MCP server",
                versions: {
                    "1.0.0": {
                        "$schema": "https://calm.finos.org/calm/namespaces/qcon/patterns/trades-api-and-mcp/versions/1.0.0",
                        "$id": "https://calm.finos.org/calm/namespaces/qcon/architectures/trades-api-and-mcp-conforming/versions/1.0.0",
                        "title": "Trades API and MCP Architecture (Conforming)",
                        "unique-id": "trades-api-and-mcp-conforming-architecture",
                        "name": "Trades API and MCP Architecture (Conforming)",
                        "description": "Conforming architecture with all required controls: micro-segmentation on cluster, permitted connections on all relationships, and MCP guardrail on MCP server",
                        "nodes": [
                            {
                                "unique-id": "mcp-client",
                                "node-type": "actor",
                                "name": "Claude",
                                "description": "MCP client that queries trade data using natural language via the MCP server"
                            },
                            {
                                "unique-id": "mcp-server",
                                "node-type": "service",
                                "name": "Trades MCP Server",
                                "description": "MCP server that exposes tools for querying and interacting with trade data",
                                "interfaces": [
                                    { "unique-id": "mcp-server-image", "image": "jpgough/trades-mcp-server:latest" },
                                    { "unique-id": "mcp-server-port", "port": 8080 }
                                ],
                                "controls": {
                                    "mcp-guardrail": {
                                        "description": "Enforces restrictions on trading symbols that the MCP server cannot access",
                                        "requirements": [
                                            {
                                                "requirement-url": "controls/mcp-guardrail.requirement.json",
                                                "config-url": "controls/mcp-guardrail.config.json"
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "trades-api",
                                "node-type": "service",
                                "name": "Trades API",
                                "description": "REST API for accessing and managing trade data",
                                "details": {
                                    "required-pattern": "trades-api.pattern.json",
                                    "detailed-architecture": "trades-api.architecture.json"
                                },
                                "interfaces": [
                                    { "unique-id": "trades-api-image", "image": "jpgough/trades-rest-server:latest" },
                                    { "unique-id": "trades-api-port", "port": 8080 }
                                ]
                            },
                            {
                                "unique-id": "k8s-cluster",
                                "node-type": "system",
                                "name": "Kubernetes Cluster",
                                "description": "Kubernetes cluster with network policy enforcement",
                                "interfaces": [
                                    { "unique-id": "cluster-type", "value": "minikube" }
                                ],
                                "controls": {
                                    "security": {
                                        "description": "Security requirements for the Kubernetes cluster",
                                        "requirements": [
                                            {
                                                "requirement-url": "controls/micro-segmentation.requirement.json",
                                                "config-url": "controls/micro-segmentation.config.json"
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        "relationships": [
                            {
                                "unique-id": "mcp-client-to-mcp-server",
                                "description": "MCP client connects to MCP server to query trade data",
                                "protocol": "HTTP",
                                "relationship-type": {
                                    "connects": {
                                        "source": { "node": "mcp-client" },
                                        "destination": { "node": "mcp-server", "interfaces": ["mcp-server-port"] }
                                    }
                                },
                                "controls": {
                                    "security": {
                                        "description": "Connection authorization for MCP client to MCP server",
                                        "requirements": [
                                            {
                                                "requirement-url": "controls/permitted-connection.requirement.json",
                                                "config-url": "controls/permitted-connection-http.config.json"
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "mcp-server-to-trades-api",
                                "description": "MCP server connects to Trades API to fetch trade data",
                                "protocol": "HTTP",
                                "relationship-type": {
                                    "connects": {
                                        "source": { "node": "mcp-server" },
                                        "destination": { "node": "trades-api", "interfaces": ["trades-api-port"] }
                                    }
                                },
                                "controls": {
                                    "security": {
                                        "description": "Connection authorization for MCP server to Trades API",
                                        "requirements": [
                                            {
                                                "requirement-url": "controls/permitted-connection.requirement.json",
                                                "config-url": "controls/permitted-connection-http.config.json"
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "deployed-in-k8s-cluster",
                                "description": "MCP server and Trades API deployed on the Kubernetes cluster",
                                "relationship-type": {
                                    "deployed-in": {
                                        "container": "k8s-cluster",
                                        "nodes": ["mcp-server", "trades-api"]
                                    }
                                }
                            }
                        ]
                    }
                }
            }]
        }
,
        {
            // Source of truth: examples/fluxnova/*.architecture.json — keep these inserts
            // in sync with those files (and with the heredocs in calm-hub/nitrite/init-nitrite.sh).
            namespace: "finos.fluxnova",
            architectures: [
                {
                    architectureId: NumberInt(6),
                    name: "FluxNova: Platform",
                    description: "Base FluxNova BPM platform deployment topology with engine, web apps, REST API, and process database",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-platform.architecture.json",
                            "title": "FluxNova: Platform",
                            "description": "Base FluxNova BPM platform deployment topology with engine, web apps, REST API, and process database",
                            "nodes": [
                                {
                                    "unique-id": "fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment comprising engine, web applications, REST API, and process database"
                                },
                                {
                                    "unique-id": "fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 process execution engine responsible for orchestrating workflows, managing process state, and executing service tasks",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All process execution events, variable changes, and task assignments are recorded in an immutable audit log",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All process execution events, variable changes, and task assignments are recorded in an immutable audit log",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer providing 200+ endpoints for process deployment, task management, variable access, and external system integration (OpenAPI documented)",
                                    "interfaces": [
                                        {
                                            "unique-id": "rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring and operations dashboard providing real-time visibility into running process instances, incidents, and batch operations",
                                    "interfaces": [
                                        {
                                            "unique-id": "cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for user, group, and tenant administration, authorization configuration, and system settings",
                                    "interfaces": [
                                        {
                                            "unique-id": "admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Task assignment and lifecycle management UI enabling human task claiming, completion, and delegation within BPMN workflows",
                                    "interfaces": [
                                        {
                                            "unique-id": "tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing process definitions, runtime state, history, job executor data, and audit logs",
                                    "interfaces": [
                                        {
                                            "unique-id": "process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists process state, history, and audit data to the process database",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries process instances, incidents, and deployments via the REST API"
                                },
                                {
                                    "unique-id": "admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages users, groups, authorizations, and system configuration via the REST API"
                                },
                                {
                                    "unique-id": "tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist retrieves and completes human tasks via the REST API"
                                },
                                {
                                    "unique-id": "platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fluxnova-platform",
                                            "nodes": [
                                                "fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                }
                            ]
                        }
                    }
                },
                {
                    architectureId: NumberInt(7),
                    name: "FluxNova: Microservices Orchestration",
                    description: "FluxNova BPM orchestrating microservices via the external task worker pattern — payment, notification, and fraud-check workers with an async event bus and API gateway",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-microservices.architecture.json",
                            "title": "FluxNova: Microservices Orchestration",
                            "description": "FluxNova BPM orchestrating microservices via the external task worker pattern — payment, notification, and fraud-check workers with an async event bus and API gateway",
                            "nodes": [
                                {
                                    "unique-id": "ms-fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment hosting the microservices orchestration process"
                                },
                                {
                                    "unique-id": "ms-fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating microservice workers via the external task pattern — coordinates payment, notification, and fraud-check service tasks",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All worker task assignments, completions, and failures are recorded in an immutable audit log for payment traceability",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All worker task assignments, completions, and failures are recorded in an immutable audit log for payment traceability",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "ms-fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer providing external task fetch-and-lock, complete, and failure endpoints for worker microservices",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring dashboard for payment process instances, worker throughput, queue depths, and failed tasks",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for worker registration, user administration, and payment platform configuration",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Human task UI for payment exception handling, fraud review escalations, and manual approval workflows",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing payment process definitions, runtime state, external task queues, and audit logs",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-payment-worker",
                                    "node-type": "fluxnova:external-task-worker",
                                    "name": "Payment Worker",
                                    "description": "External task worker microservice that processes payment transaction tasks — polls the FluxNova engine for tasks, executes payment settlement, and reports completion",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-payment-worker-endpoint",
                                            "type": "url",
                                            "value": "https://payment-worker.internal/health"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-notification-worker",
                                    "node-type": "fluxnova:external-task-worker",
                                    "name": "Notification Worker",
                                    "description": "External task worker microservice that handles notification delivery tasks — sends SMS, email, and push notifications based on process variables",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-notification-worker-endpoint",
                                            "type": "url",
                                            "value": "https://notification-worker.internal/health"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-fraud-check-worker",
                                    "node-type": "fluxnova:external-task-worker",
                                    "name": "Fraud Check Worker",
                                    "description": "External task worker microservice that executes fraud detection tasks — scores transactions via ML models, returns risk scores to the process engine",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-fraud-check-worker-endpoint",
                                            "type": "url",
                                            "value": "https://fraud-check-worker.internal/health"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-message-broker",
                                    "node-type": "service",
                                    "name": "Message Broker",
                                    "description": "Async event bus for worker-to-worker communication and domain event publishing — decouples workers from direct coupling and enables event-driven scaling",
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-message-broker-endpoint",
                                            "type": "host-port",
                                            "value": "message-broker:5672"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ms-api-gateway",
                                    "node-type": "service",
                                    "name": "API Gateway",
                                    "description": "Entry point gateway for external API consumers — handles authentication, rate limiting, TLS termination, and request routing to the FluxNova REST API",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "All external client connections terminate TLS at the API gateway — internal traffic uses mTLS on the service mesh",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "All external client connections terminate TLS at the API gateway — internal traffic uses mTLS on the service mesh",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#api-gateway"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "ms-api-gateway-endpoint",
                                            "type": "url",
                                            "value": "https://api-gateway.internal/v1"
                                        }
                                    ]
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "ms-engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists payment process state, external task queues, and audit data to the process database"
                                },
                                {
                                    "unique-id": "ms-rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "ms-cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries payment process instances and worker metrics via the REST API"
                                },
                                {
                                    "unique-id": "ms-admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages worker registration, users, and payment platform configuration via the REST API"
                                },
                                {
                                    "unique-id": "ms-tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist retrieves and completes human escalation and exception tasks via the REST API"
                                },
                                {
                                    "unique-id": "ms-platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "ms-platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "ms-platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "ms-platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "ms-platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "ms-platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ms-fluxnova-platform",
                                            "nodes": [
                                                "ms-fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                },
                                {
                                    "unique-id": "ms-payment-worker-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-payment-worker"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Payment worker polls FluxNova REST API for external tasks, locks them for execution, and submits completion or failure results"
                                },
                                {
                                    "unique-id": "ms-notification-worker-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-notification-worker"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Notification worker polls FluxNova REST API for notification tasks, executes delivery, and reports back"
                                },
                                {
                                    "unique-id": "ms-fraud-check-worker-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-fraud-check-worker"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Fraud check worker polls FluxNova REST API for fraud scoring tasks, runs ML inference, and reports risk scores"
                                },
                                {
                                    "unique-id": "ms-payment-worker-to-broker",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-payment-worker"
                                            },
                                            "destination": {
                                                "node": "ms-message-broker"
                                            }
                                        }
                                    },
                                    "protocol": "AMQP",
                                    "description": "Payment worker publishes domain events (payment-completed, payment-failed) to the message broker for downstream consumption"
                                },
                                {
                                    "unique-id": "ms-notification-worker-to-broker",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-notification-worker"
                                            },
                                            "destination": {
                                                "node": "ms-message-broker"
                                            }
                                        }
                                    },
                                    "protocol": "AMQP",
                                    "description": "Notification worker subscribes to payment events from the message broker to trigger customer notifications asynchronously"
                                },
                                {
                                    "unique-id": "ms-api-gateway-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ms-api-gateway"
                                            },
                                            "destination": {
                                                "node": "ms-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "API gateway proxies authenticated external requests to the FluxNova REST API after TLS termination and rate-limit checks"
                                }
                            ]
                        }
                    }
                },
                {
                    architectureId: NumberInt(8),
                    name: "FluxNova: KYC Onboarding",
                    description: "Pre-trade KYC onboarding architecture with identity verification, sanctions screening, risk scoring, and compliance review built on FluxNova BPM platform",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-kyc-onboarding.architecture.json",
                            "title": "FluxNova: KYC Onboarding",
                            "description": "Pre-trade KYC onboarding architecture with identity verification, sanctions screening, risk scoring, and compliance review built on FluxNova BPM platform",
                            "nodes": [
                                {
                                    "unique-id": "kyc-fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment hosting the KYC onboarding process"
                                },
                                {
                                    "unique-id": "kyc-fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 engine executing the Client Onboarding KYC process (Process_ClientOnboardingKYC) with boundary timers, escalation gateways, and DMN risk scoring",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All process execution events, variable changes, task assignments, and decision outcomes are recorded in an immutable audit log for regulatory compliance",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All process execution events, variable changes, task assignments, and decision outcomes are recorded in an immutable audit log for regulatory compliance",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer providing endpoints for KYC process deployment, task management, and external task worker integration",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring dashboard for KYC onboarding — tracks in-flight applications, SLA breaches, and escalation incidents",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for KYC user roles, group assignments, and authorization policies",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Task UI for compliance officers and operations staff to claim and complete KYC review tasks, remediation tasks, and enhanced due diligence assessments",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing KYC process definitions, runtime state, decision audit history, and escalation records",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-customer",
                                    "node-type": "actor",
                                    "name": "Customer",
                                    "description": "Prospective client submitting a KYC onboarding application, providing identity documents, proof of address, and corporate documentation"
                                },
                                {
                                    "unique-id": "kyc-compliance-officer",
                                    "node-type": "actor",
                                    "name": "Compliance Officer",
                                    "description": "Reviews medium-risk KYC applications, conducts compliance investigations on sanctions matches, and makes approval/rejection decisions"
                                },
                                {
                                    "unique-id": "kyc-senior-compliance",
                                    "node-type": "actor",
                                    "name": "Senior Compliance Officer",
                                    "description": "Conducts enhanced due diligence for high-risk KYC applications and handles escalated compliance decisions"
                                },
                                {
                                    "unique-id": "kyc-ops-manager",
                                    "node-type": "actor",
                                    "name": "Operations Manager",
                                    "description": "Receives escalations when document verification SLA (48 hours) is breached and manages operational remediation"
                                },
                                {
                                    "unique-id": "kyc-identity-verification-svc",
                                    "node-type": "service",
                                    "name": "Identity Verification Service",
                                    "description": "External task worker performing OCR, biometric verification, and identity document validation via third-party IDV provider (topic: doc-verification)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-idv-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/verify"
                                        }
                                    ],
                                    "data-classification": "PII",
                                    "controls": {
                                        "data-classification": {
                                            "description": "Processes personally identifiable information including identity documents, biometric data, and government IDs — classified as PII",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-data-classification",
                                                        "name": "Data Classification",
                                                        "description": "Processes personally identifiable information including identity documents, biometric data, and government IDs — classified as PII",
                                                        "reference-url": "https://calm.finos.org/core-concepts/data-classification"
                                                    }
                                                }
                                            ]
                                        },
                                        "audit-logging": {
                                            "description": "All verification requests, results, and third-party API calls are logged for regulatory audit trail",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All verification requests, results, and third-party API calls are logged for regulatory audit trail",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-sanctions-screening-svc",
                                    "node-type": "service",
                                    "name": "Sanctions & PEP Screening Service",
                                    "description": "External task worker querying OFAC, UN, EU sanctions lists and PEP databases for compliance checks (topic: sanctions-screen)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-sanctions-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/sanctions"
                                        }
                                    ],
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All sanctions and PEP screening queries, match results, and investigation outcomes are logged for regulatory compliance",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All sanctions and PEP screening queries, match results, and investigation outcomes are logged for regulatory compliance",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-risk-scoring-svc",
                                    "node-type": "service",
                                    "name": "AML/KYC Risk Scoring Service",
                                    "description": "DMN decision table evaluating client type, jurisdiction, transaction profile, PEP status, sanctions results, and beneficial ownership to produce a risk category (Low/Medium/High)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-risk-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/risk-assessment"
                                        }
                                    ],
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All risk scoring inputs, decision table evaluations, and output categories are logged with full decision rationale",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All risk scoring inputs, decision table evaluations, and output categories are logged with full decision rationale",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-document-mgmt-svc",
                                    "node-type": "service",
                                    "name": "Document Management Service",
                                    "description": "External task worker handling secure storage and retrieval of identity documents, proof of address, and corporate documentation (topic: document-management)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-docmgmt-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/documents"
                                        }
                                    ],
                                    "data-classification": "PII",
                                    "controls": {
                                        "data-classification": {
                                            "description": "Stores and manages personally identifiable documents including passports, driving licenses, and proof of address — classified as PII",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-data-classification",
                                                        "name": "Data Classification",
                                                        "description": "Stores and manages personally identifiable documents including passports, driving licenses, and proof of address — classified as PII",
                                                        "reference-url": "https://calm.finos.org/core-concepts/data-classification"
                                                    }
                                                }
                                            ]
                                        },
                                        "encryption-at-rest": {
                                            "description": "All stored documents are encrypted at rest using AES-256 to protect PII",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-at-rest",
                                                        "name": "Encryption At Rest",
                                                        "description": "All stored documents are encrypted at rest using AES-256 to protect PII",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-notification-svc",
                                    "node-type": "service",
                                    "name": "Notification Service",
                                    "description": "External task worker sending email and push notifications to customers, sales teams, and compliance staff for onboarding status updates (topic: notifications)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-notify-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/notifications"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-crm-sync-svc",
                                    "node-type": "service",
                                    "name": "CRM Sync Service",
                                    "description": "External task worker persisting client data to the CRM and provisioning accounts in trading and custodian systems upon approval (topic: crm-sync, account-provisioning)",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-crm-api",
                                            "type": "url",
                                            "value": "https://kyc-services.internal/api/v1/crm"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "kyc-kyc-database",
                                    "node-type": "database",
                                    "name": "KYC Database",
                                    "description": "Dedicated database storing customer PII, verification results, sanctions screening outcomes, risk assessments, and compliance decisions",
                                    "interfaces": [
                                        {
                                            "unique-id": "kyc-kyc-db-port",
                                            "type": "host-port",
                                            "value": "kyc-db:5432"
                                        }
                                    ],
                                    "data-classification": "PII",
                                    "controls": {
                                        "data-classification": {
                                            "description": "Contains personally identifiable information including customer identity data, verification results, and compliance decisions — classified as PII",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-data-classification",
                                                        "name": "Data Classification",
                                                        "description": "Contains personally identifiable information including customer identity data, verification results, and compliance decisions — classified as PII",
                                                        "reference-url": "https://calm.finos.org/core-concepts/data-classification"
                                                    }
                                                }
                                            ]
                                        },
                                        "encryption-at-rest": {
                                            "description": "All PII data is encrypted at rest using AES-256 with key management via HSM",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-at-rest",
                                                        "name": "Encryption At Rest",
                                                        "description": "All PII data is encrypted at rest using AES-256 with key management via HSM",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        },
                                        "access-control": {
                                            "description": "Database access restricted to authorized KYC services only via role-based access control and network segmentation",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-access-control",
                                                        "name": "Access Control",
                                                        "description": "Database access restricted to authorized KYC services only via role-based access control and network segmentation",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-watchlist-provider",
                                    "node-type": "system",
                                    "name": "Watchlist Data Provider",
                                    "description": "External system providing OFAC, UN, EU sanctions lists and PEP databases for compliance screening"
                                },
                                {
                                    "unique-id": "kyc-idv-provider",
                                    "node-type": "system",
                                    "name": "Identity Verification Provider",
                                    "description": "External third-party identity verification provider performing OCR, biometric matching, and document authenticity checks"
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "kyc-engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists KYC process state, history, decision audit data, and escalation records",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "Database connection uses TLS-encrypted JDBC to protect process data and credentials in transit",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "kyc-fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "kyc-cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "kyc-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries KYC process instances, SLA breach incidents, and escalation status"
                                },
                                {
                                    "unique-id": "kyc-admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "kyc-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages KYC user roles, compliance group assignments, and authorization policies"
                                },
                                {
                                    "unique-id": "kyc-tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "kyc-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist enables compliance officers and ops staff to claim and complete KYC review tasks"
                                },
                                {
                                    "unique-id": "kyc-customer-to-tasklist",
                                    "relationship-type": {
                                        "interacts": {
                                            "actor": "kyc-customer",
                                            "nodes": [
                                                "kyc-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "Customer submits onboarding application and uploads identity documents via the client portal"
                                },
                                {
                                    "unique-id": "kyc-compliance-officer-to-tasklist",
                                    "relationship-type": {
                                        "interacts": {
                                            "actor": "kyc-compliance-officer",
                                            "nodes": [
                                                "kyc-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "Compliance officer claims and completes medium-risk review tasks, sanctions investigation tasks, and approval decisions"
                                },
                                {
                                    "unique-id": "kyc-senior-compliance-to-tasklist",
                                    "relationship-type": {
                                        "interacts": {
                                            "actor": "kyc-senior-compliance",
                                            "nodes": [
                                                "kyc-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "Senior compliance officer conducts enhanced due diligence tasks for high-risk applications"
                                },
                                {
                                    "unique-id": "kyc-ops-manager-to-cockpit",
                                    "relationship-type": {
                                        "interacts": {
                                            "actor": "kyc-ops-manager",
                                            "nodes": [
                                                "kyc-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "Operations manager monitors SLA compliance and receives escalation alerts for document verification delays"
                                },
                                {
                                    "unique-id": "kyc-engine-to-idv-svc",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-identity-verification-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches document verification external tasks (ServiceTask_VerifyDocuments) with 48-hour SLA boundary timer",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All verification task dispatches, completions, and SLA breach escalations are audit-logged",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All verification task dispatches, completions, and SLA breach escalations are audit-logged",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-engine-to-sanctions-svc",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-sanctions-screening-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches sanctions and PEP screening external tasks (ServiceTask_SanctionsPEP) after document verification passes",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All screening task dispatches, match results, and routing decisions are audit-logged",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All screening task dispatches, match results, and routing decisions are audit-logged",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-engine-to-risk-scoring",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-risk-scoring-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine invokes DMN risk assessment (BusinessRule_RiskAssessment) with 24-hour SLA boundary timer, producing Low/Medium/High risk category",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All risk scoring inputs, DMN decision table evaluations, and category outputs are audit-logged with full rationale",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All risk scoring inputs, DMN decision table evaluations, and category outputs are audit-logged with full rationale",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-engine-to-doc-mgmt",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-document-mgmt-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches document storage tasks (ServiceTask_StoreDocuments) for uploaded identity documents and corporate documentation",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "PII document transfers use TLS 1.3 encryption in transit",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "PII document transfers use TLS 1.3 encryption in transit",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-engine-to-notification",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-notification-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches notification tasks (ServiceTask_NotifySalesClient) for onboarding status updates and approval/rejection notices"
                                },
                                {
                                    "unique-id": "kyc-engine-to-crm-sync",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "kyc-crm-sync-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches CRM sync tasks (ServiceTask_PersistClientData) and account provisioning tasks (ServiceTask_AccountOpening) for approved clients",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All client data persistence and account provisioning events are audit-logged",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All client data persistence and account provisioning events are audit-logged",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-idv-svc-to-kyc-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-identity-verification-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-kyc-database"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Persists identity verification results, document metadata, and biometric match scores",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "PII data transfers to database use TLS-encrypted JDBC",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "PII data transfers to database use TLS-encrypted JDBC",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-sanctions-svc-to-kyc-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-sanctions-screening-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-kyc-database"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Persists sanctions screening results, PEP match data, and investigation outcomes",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "Screening result transfers to database use TLS-encrypted JDBC",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "Screening result transfers to database use TLS-encrypted JDBC",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-risk-scoring-to-kyc-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-risk-scoring-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-kyc-database"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Persists risk assessment inputs, DMN decision outputs, and risk category assignments"
                                },
                                {
                                    "unique-id": "kyc-doc-mgmt-to-kyc-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-document-mgmt-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-kyc-database"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Persists document metadata, storage references, and verification linkages",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "PII document metadata transfers to database use TLS-encrypted JDBC",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "PII document metadata transfers to database use TLS-encrypted JDBC",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-crm-sync-to-kyc-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-crm-sync-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-kyc-database"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Reads approved client data for CRM synchronization and account provisioning"
                                },
                                {
                                    "unique-id": "kyc-idv-svc-to-idv-provider",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-identity-verification-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-idv-provider"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Calls external IDV provider API for OCR, biometric matching, and document authenticity verification",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "External API calls carrying PII use mTLS for mutual authentication and encryption",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "External API calls carrying PII use mTLS for mutual authentication and encryption",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        },
                                        "audit-logging": {
                                            "description": "All external IDV API calls and responses are logged for compliance audit trail",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All external IDV API calls and responses are logged for compliance audit trail",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-sanctions-svc-to-watchlist",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "kyc-sanctions-screening-svc"
                                            },
                                            "destination": {
                                                "node": "kyc-watchlist-provider"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Queries OFAC, UN, EU sanctions lists and PEP databases for compliance screening",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "External watchlist API calls use TLS 1.3 encryption for data protection",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "External watchlist API calls use TLS 1.3 encryption for data protection",
                                                        "reference-url": "https://calm.finos.org/core-concepts/controls"
                                                    }
                                                }
                                            ]
                                        },
                                        "audit-logging": {
                                            "description": "All sanctions screening queries and results are logged for regulatory compliance",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All sanctions screening queries and results are logged for regulatory compliance",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "kyc-platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "kyc-platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "kyc-platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "kyc-platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "kyc-platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "kyc-platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "kyc-fluxnova-platform",
                                            "nodes": [
                                                "kyc-fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                }
                            ]
                        }
                    }
                },
                {
                    architectureId: NumberInt(9),
                    name: "FluxNova: Post-Trade Settlement",
                    description: "Post-trade settlement blueprint with counterparty gateway, clearing house connector, regulatory reporting, and settlement database built on FluxNova BPM platform",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-settlement.architecture.json",
                            "title": "FluxNova: Post-Trade Settlement",
                            "description": "Post-trade settlement blueprint with counterparty gateway, clearing house connector, regulatory reporting, and settlement database built on FluxNova BPM platform",
                            "nodes": [
                                {
                                    "unique-id": "st-fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment hosting the post-trade settlement process"
                                },
                                {
                                    "unique-id": "st-fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating trade confirmation, netting, novation, and settlement lifecycle workflows",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All settlement process events, trade state transitions, and regulatory submissions are recorded in an immutable audit log",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All settlement process events, trade state transitions, and regulatory submissions are recorded in an immutable audit log",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "st-fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer for trade submission, settlement status queries, and external task worker integration",
                                    "interfaces": [
                                        {
                                            "unique-id": "st-rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring dashboard providing real-time visibility into settlement process instances, failed trades, and regulatory deadlines",
                                    "interfaces": [
                                        {
                                            "unique-id": "st-cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for counterparty onboarding, user administration, and settlement platform configuration",
                                    "interfaces": [
                                        {
                                            "unique-id": "st-admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Task management UI for trade exception handling, manual matching, and compliance review tasks in the settlement workflow",
                                    "interfaces": [
                                        {
                                            "unique-id": "st-tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing settlement process definitions, runtime state, trade history, and compliance audit logs",
                                    "interfaces": [
                                        {
                                            "unique-id": "st-process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-counterparty-gateway",
                                    "node-type": "service",
                                    "name": "Counterparty Gateway",
                                    "description": "Secure gateway for counterparty trade confirmations and matching via FIX, FpML, and SWIFT message protocols",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "All counterparty communications use mTLS to authenticate both parties and encrypt trade confirmation data",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "All counterparty communications use mTLS to authenticate both parties and encrypt trade confirmation data",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#counterparty-auth"
                                                    }
                                                }
                                            ]
                                        },
                                        "audit-logging": {
                                            "description": "All inbound and outbound counterparty messages are logged with timestamps for regulatory audit trails",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All inbound and outbound counterparty messages are logged with timestamps for regulatory audit trails",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "st-counterparty-gateway-endpoint",
                                            "type": "url",
                                            "value": "https://counterparty-gateway.internal/confirm"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-clearing-house-connector",
                                    "node-type": "service",
                                    "name": "Clearing House Connector",
                                    "description": "Connector to central clearing house (CCP) for trade novation, netting, and multilateral settlement instruction submission",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "Clearing house connectivity uses leased line or dedicated VPN with TLS for trade submission integrity",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "Clearing house connectivity uses leased line or dedicated VPN with TLS for trade submission integrity",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#ccp-connectivity"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "st-clearing-house-endpoint",
                                            "type": "url",
                                            "value": "https://ccp-connector.internal/submit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-regulatory-reporting-svc",
                                    "node-type": "service",
                                    "name": "Regulatory Reporting Service",
                                    "description": "Automated regulatory reporting service generating EMIR, MiFIR, and Dodd-Frank trade reports with real-time submission to trade repositories",
                                    "controls": {
                                        "regulatory-compliance": {
                                            "description": "All trade reports are validated against ESMA and CFTC schemas before submission; submission receipts are archived for 7 years",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-regulatory-compliance",
                                                        "name": "Regulatory Compliance",
                                                        "description": "All trade reports are validated against ESMA and CFTC schemas before submission; submission receipts are archived for 7 years",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/regulatory-reporting"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "st-regulatory-reporting-endpoint",
                                            "type": "url",
                                            "value": "https://regulatory-reporting.internal/submit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "st-settlement-db",
                                    "node-type": "database",
                                    "name": "Settlement Database",
                                    "description": "Settlement positions, obligations, and trade lifecycle data store — source of truth for net settlement positions and regulatory reporting",
                                    "controls": {
                                        "encryption-in-transit": {
                                            "description": "All connections to the settlement database use TLS-encrypted JDBC",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "All connections to the settlement database use TLS-encrypted JDBC",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#database-encryption"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "st-settlement-db-port",
                                            "type": "host-port",
                                            "value": "settlement-db:5432"
                                        }
                                    ]
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "st-engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "st-fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists settlement process state, history, and audit data to the process database"
                                },
                                {
                                    "unique-id": "st-rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "st-fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "st-cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "st-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries settlement process instances and compliance deadlines via the REST API"
                                },
                                {
                                    "unique-id": "st-admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "st-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages counterparty onboarding, users, and platform configuration via the REST API"
                                },
                                {
                                    "unique-id": "st-tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "st-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist retrieves and completes trade exception and compliance review tasks via the REST API"
                                },
                                {
                                    "unique-id": "st-platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "st-platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "st-platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "st-platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "st-platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "st-platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "st-fluxnova-platform",
                                            "nodes": [
                                                "st-fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                },
                                {
                                    "unique-id": "st-engine-to-counterparty-gateway",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "st-counterparty-gateway"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine invokes the counterparty gateway for trade confirmation matching and settlement instruction exchange"
                                },
                                {
                                    "unique-id": "st-engine-to-clearing-house",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "st-clearing-house-connector"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine submits cleared trades for novation and netting via the clearing house connector"
                                },
                                {
                                    "unique-id": "st-engine-to-regulatory-reporting",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "st-regulatory-reporting-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine triggers regulatory report generation after trade confirmation and settlement instruction creation"
                                },
                                {
                                    "unique-id": "st-engine-to-settlement-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "st-settlement-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine reads and writes settlement positions and obligations to the settlement database during workflow execution"
                                },
                                {
                                    "unique-id": "st-regulatory-reporting-to-settlement-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "st-regulatory-reporting-svc"
                                            },
                                            "destination": {
                                                "node": "st-settlement-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Regulatory reporting service reads consolidated settlement positions from the settlement database for report generation"
                                }
                            ]
                        }
                    }
                },
                {
                    architectureId: NumberInt(10),
                    name: "FluxNova: Flash Risk Management",
                    description: "Real-time flash risk management blueprint with on-premise and cloud compute, aggregation, and auto-provisioning for latency-sensitive financial risk calculations",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-flash-risk.architecture.json",
                            "title": "FluxNova: Flash Risk Management",
                            "description": "Real-time flash risk management blueprint with on-premise and cloud compute, aggregation, and auto-provisioning for latency-sensitive financial risk calculations",
                            "nodes": [
                                {
                                    "unique-id": "fr-fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment hosting the flash risk orchestration process"
                                },
                                {
                                    "unique-id": "fr-fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating the flash risk calculation workflow, dispatching tasks to on-premise and cloud compute nodes",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All risk calculation dispatches, results, and exceptions are recorded in an immutable audit log",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All risk calculation dispatches, results, and exceptions are recorded in an immutable audit log",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "fr-fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer providing endpoints for risk process deployment, external task worker integration, and risk result retrieval",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring dashboard providing real-time visibility into risk calculation instances, incidents, and batch operations",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for user, group, and tenant administration for the risk management platform",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Task assignment UI for human review and exception handling in risk calculation workflows",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing risk process definitions, runtime state, history, and audit logs",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-risk-compute-onprem",
                                    "node-type": "service",
                                    "name": "On-Premise Risk Engine",
                                    "description": "On-premise risk computation engine for latency-sensitive calculations requiring sub-millisecond response times and access to co-located market data feeds",
                                    "data-classification": "Confidential",
                                    "controls": {
                                        "data-classification": {
                                            "description": "Risk computation results are classified Confidential — position data, P&L, and risk factors must not leave the secure perimeter",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-data-classification",
                                                        "name": "Data Classification",
                                                        "description": "Risk computation results are classified Confidential — position data, P&L, and risk factors must not leave the secure perimeter",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/data-classification"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-onprem-compute-endpoint",
                                            "type": "host-port",
                                            "value": "risk-compute-onprem:8080"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-risk-compute-cloud",
                                    "node-type": "service",
                                    "name": "Cloud Risk Engine",
                                    "description": "Cloud-based risk computation engine for burst capacity scaling during high-volatility market events when on-premise capacity is exhausted",
                                    "data-classification": "Confidential",
                                    "controls": {
                                        "data-classification": {
                                            "description": "Cloud risk computations handle Confidential position data — encryption in transit and at rest is mandatory",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-data-classification",
                                                        "name": "Data Classification",
                                                        "description": "Cloud risk computations handle Confidential position data — encryption in transit and at rest is mandatory",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/data-classification"
                                                    }
                                                }
                                            ]
                                        },
                                        "encryption-in-transit": {
                                            "description": "All position data sent to cloud compute is encrypted in transit using TLS 1.3 minimum",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-encryption-in-transit",
                                                        "name": "Encryption In Transit",
                                                        "description": "All position data sent to cloud compute is encrypted in transit using TLS 1.3 minimum",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/security#cloud-encryption"
                                                    }
                                                }
                                            ]
                                        }
                                    },
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-cloud-compute-endpoint",
                                            "type": "url",
                                            "value": "https://risk-compute-cloud.internal/compute"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-risk-aggregation-svc",
                                    "node-type": "service",
                                    "name": "Risk Aggregation Service",
                                    "description": "Aggregates risk results from on-premise and cloud compute nodes, merges partial risk vectors, and produces consolidated real-time risk reports",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-aggregation-endpoint",
                                            "type": "host-port",
                                            "value": "risk-aggregation-svc:8081"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "fr-cloud-provisioner",
                                    "node-type": "service",
                                    "name": "Cloud Provisioner",
                                    "description": "Auto-provisions cloud compute instances based on market volatility signals, scaling out when VIX or realized volatility exceeds configured thresholds",
                                    "interfaces": [
                                        {
                                            "unique-id": "fr-provisioner-endpoint",
                                            "type": "url",
                                            "value": "https://cloud-provisioner.internal/provision"
                                        }
                                    ]
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "fr-engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "fr-fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists risk process state, history, and audit data to the process database"
                                },
                                {
                                    "unique-id": "fr-rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "fr-fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "fr-cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "fr-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries risk process instances and incidents via the REST API"
                                },
                                {
                                    "unique-id": "fr-admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "fr-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages users, authorizations, and risk platform configuration via the REST API"
                                },
                                {
                                    "unique-id": "fr-tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "fr-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist retrieves and completes human exception-handling tasks via the REST API"
                                },
                                {
                                    "unique-id": "fr-platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "fr-platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "fr-platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "fr-platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "fr-platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "fr-platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "fr-fluxnova-platform",
                                            "nodes": [
                                                "fr-fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                },
                                {
                                    "unique-id": "fr-engine-to-onprem-compute",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "fr-risk-compute-onprem"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches risk calculation tasks to the on-premise compute engine for low-latency position risk calculations"
                                },
                                {
                                    "unique-id": "fr-engine-to-cloud-compute",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "fr-risk-compute-cloud"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches burst risk calculation tasks to the cloud compute engine when on-premise capacity is exceeded"
                                },
                                {
                                    "unique-id": "fr-onprem-to-aggregation",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-risk-compute-onprem"
                                            },
                                            "destination": {
                                                "node": "fr-risk-aggregation-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "On-premise compute pushes partial risk vectors to the aggregation service for consolidation"
                                },
                                {
                                    "unique-id": "fr-cloud-to-aggregation",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-risk-compute-cloud"
                                            },
                                            "destination": {
                                                "node": "fr-risk-aggregation-svc"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cloud compute pushes burst risk results to the aggregation service for consolidation"
                                },
                                {
                                    "unique-id": "fr-provisioner-to-cloud-compute",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-cloud-provisioner"
                                            },
                                            "destination": {
                                                "node": "fr-risk-compute-cloud"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Provisioner scales cloud compute instances up or down based on real-time volatility signals"
                                },
                                {
                                    "unique-id": "fr-engine-to-provisioner",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "fr-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "fr-cloud-provisioner"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine signals the provisioner to scale cloud capacity when market volatility triggers burst mode"
                                }
                            ]
                        }
                    }
                },
                {
                    architectureId: NumberInt(11),
                    name: "FluxNova: AI Agent Orchestration",
                    description: "FluxNova BPM platform orchestrating autonomous AI agents with LLM inference, guardrails, and callable tools — AIGF governance controls pre-applied",
                    versions: {
                        "1.0.0": {
                            "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/examples/fluxnova/fluxnova-ai-agent.architecture.json",
                            "title": "FluxNova: AI Agent Orchestration",
                            "description": "FluxNova BPM platform orchestrating autonomous AI agents with LLM inference, guardrails, and callable tools — AIGF governance controls pre-applied",
                            "nodes": [
                                {
                                    "unique-id": "ai-fluxnova-platform",
                                    "node-type": "fluxnova:platform",
                                    "name": "FluxNova Platform",
                                    "description": "Full FluxNova BPM platform deployment hosting the AI agent orchestration process"
                                },
                                {
                                    "unique-id": "ai-fluxnova-engine",
                                    "node-type": "fluxnova:engine",
                                    "name": "FluxNova BPM Engine",
                                    "description": "Core BPMN 2.0 / DMN 1.3 engine orchestrating AI agent task dispatch, monitoring, and human-in-the-loop escalation workflows",
                                    "controls": {
                                        "audit-logging": {
                                            "description": "All AI agent task dispatches, LLM calls, guardrail verdicts, and tool invocations are recorded in an immutable audit log",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-audit-logging",
                                                        "name": "Audit Logging",
                                                        "description": "All AI agent task dispatches, LLM calls, guardrail verdicts, and tool invocations are recorded in an immutable audit log",
                                                        "reference-url": "https://docs.fluxnova.finos.org/docs/reference/audit-log"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "ai-fluxnova-rest-api",
                                    "node-type": "fluxnova:rest-api",
                                    "name": "FluxNova REST API",
                                    "description": "RESTful API layer for AI process deployment, agent task polling, and result submission",
                                    "interfaces": [
                                        {
                                            "unique-id": "ai-rest-api-endpoint",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/engine-rest"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ai-fluxnova-cockpit",
                                    "node-type": "fluxnova:cockpit",
                                    "name": "FluxNova Cockpit",
                                    "description": "Process monitoring dashboard for AI agent task instances, LLM latency, guardrail rejection rates, and escalation incidents",
                                    "interfaces": [
                                        {
                                            "unique-id": "ai-cockpit-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/cockpit"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ai-fluxnova-admin",
                                    "node-type": "fluxnova:admin",
                                    "name": "FluxNova Admin",
                                    "description": "Management console for AI agent configuration, LLM model version management, and guardrail policy administration",
                                    "interfaces": [
                                        {
                                            "unique-id": "ai-admin-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/admin"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ai-fluxnova-tasklist",
                                    "node-type": "fluxnova:tasklist",
                                    "name": "FluxNova Tasklist",
                                    "description": "Human-in-the-loop task UI for reviewing AI agent decisions, approving high-risk actions, and resolving guardrail rejections",
                                    "interfaces": [
                                        {
                                            "unique-id": "ai-tasklist-url",
                                            "type": "url",
                                            "value": "https://fluxnova.internal/tasklist"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ai-fluxnova-process-db",
                                    "node-type": "fluxnova:process-db",
                                    "name": "Process Database",
                                    "description": "Relational database storing AI agent process definitions, runtime state, LLM interaction history, and AIGF audit logs",
                                    "interfaces": [
                                        {
                                            "unique-id": "ai-process-db-port",
                                            "type": "host-port",
                                            "value": "process-db:5432"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "ai-agent",
                                    "node-type": "ai:agent",
                                    "name": "AI Agent",
                                    "description": "Autonomous AI agent executing tasks assigned by the FluxNova process engine — uses LLM for reasoning, tools for action, and guardrails for safety",
                                    "controls": {
                                        "agent-least-privilege": {
                                            "description": "AI agent operates with least-privilege tool access — only tools explicitly granted per process definition are callable",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-agent-least-privilege",
                                                        "name": "Agent Least Privilege",
                                                        "description": "AI agent operates with least-privilege tool access — only tools explicitly granted per process definition are callable",
                                                        "reference-url": "https://air-governance-framework.finos.org/mitigations/mi-18"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "ai-llm",
                                    "node-type": "ai:llm",
                                    "name": "Large Language Model",
                                    "description": "Large language model providing inference and reasoning capabilities for AI agent decisions — version-pinned for reproducible behaviour",
                                    "controls": {
                                        "model-version-pinning": {
                                            "description": "LLM model version is pinned to a specific checkpoint — no automatic model upgrades without governance review and regression testing",
                                            "requirements": [
                                                {
                                                    "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
                                                    "config": {
                                                        "control-id": "fluxnova-model-version-pinning",
                                                        "name": "Model Version Pinning",
                                                        "description": "LLM model version is pinned to a specific checkpoint — no automatic model upgrades without governance review and regression testing",
                                                        "reference-url": "https://air-governance-framework.finos.org/mitigations/mi-10"
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "unique-id": "ai-guardrail",
                                    "node-type": "ai:guardrail",
                                    "name": "AI Guardrail",
                                    "description": "Safety filter validating AI agent inputs and outputs against policy — rejects hallucinations, PII leakage, prompt injections, and policy violations before action"
                                },
                                {
                                    "unique-id": "ai-tool",
                                    "node-type": "ai:tool",
                                    "name": "AI Tool",
                                    "description": "Callable function exposed to the AI agent for structured external actions — wraps downstream APIs, databases, and services with typed schemas and access controls"
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "ai-engine-to-process-db",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "ai-fluxnova-process-db"
                                            }
                                        }
                                    },
                                    "protocol": "JDBC",
                                    "description": "Engine persists AI agent process state, LLM interaction history, and audit data to the process database"
                                },
                                {
                                    "unique-id": "ai-rest-api-to-engine",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-rest-api"
                                            },
                                            "destination": {
                                                "node": "ai-fluxnova-engine"
                                            }
                                        }
                                    },
                                    "protocol": "HTTP",
                                    "description": "REST API delegates all requests to the embedded engine via internal Java API calls"
                                },
                                {
                                    "unique-id": "ai-cockpit-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-cockpit"
                                            },
                                            "destination": {
                                                "node": "ai-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Cockpit queries AI agent process instances and LLM performance metrics via the REST API"
                                },
                                {
                                    "unique-id": "ai-admin-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-admin"
                                            },
                                            "destination": {
                                                "node": "ai-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Admin manages AI agent configuration, model versions, and guardrail policies via the REST API"
                                },
                                {
                                    "unique-id": "ai-tasklist-to-rest-api",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-tasklist"
                                            },
                                            "destination": {
                                                "node": "ai-fluxnova-rest-api"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Tasklist retrieves and completes human-in-the-loop review and escalation tasks via the REST API"
                                },
                                {
                                    "unique-id": "ai-platform-has-engine",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-engine"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the BPM engine"
                                },
                                {
                                    "unique-id": "ai-platform-has-rest-api",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-rest-api"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the REST API"
                                },
                                {
                                    "unique-id": "ai-platform-has-cockpit",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-cockpit"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Cockpit monitoring app"
                                },
                                {
                                    "unique-id": "ai-platform-has-admin",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-admin"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Admin management app"
                                },
                                {
                                    "unique-id": "ai-platform-has-tasklist",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-tasklist"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the Tasklist app"
                                },
                                {
                                    "unique-id": "ai-platform-has-process-db",
                                    "relationship-type": {
                                        "composed-of": {
                                            "container": "ai-fluxnova-platform",
                                            "nodes": [
                                                "ai-fluxnova-process-db"
                                            ]
                                        }
                                    },
                                    "description": "FluxNova platform contains the process database"
                                },
                                {
                                    "unique-id": "ai-engine-to-agent",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-fluxnova-engine"
                                            },
                                            "destination": {
                                                "node": "ai-agent"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Engine dispatches AI agent tasks via the external task worker pattern — agent polls for tasks, executes, and submits results"
                                },
                                {
                                    "unique-id": "ai-agent-to-llm",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-agent"
                                            },
                                            "destination": {
                                                "node": "ai-llm"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "AI agent sends prompts and context to the LLM for reasoning and decision generation"
                                },
                                {
                                    "unique-id": "ai-guardrail-to-agent",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-guardrail"
                                            },
                                            "destination": {
                                                "node": "ai-agent"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "Guardrail validates agent inputs before LLM invocation and agent outputs before tool execution — acts as a safety filter in the critical path"
                                },
                                {
                                    "unique-id": "ai-agent-to-tool",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "ai-agent"
                                            },
                                            "destination": {
                                                "node": "ai-tool"
                                            }
                                        }
                                    },
                                    "protocol": "HTTPS",
                                    "description": "AI agent invokes callable tools for structured external actions after guardrail approval"
                                }
                            ]
                        }
                    }
                }
            ]
        }
    ];
    const seededArchitectures = seedVersionedResource(
        architecturesByNamespace, "architectures", "architectureVersions", "architectures", "architectureId");
    logSuccess(`Initialized ${seededArchitectures.headers} architectures and ${seededArchitectures.versions} versions for finos, workshop, traderx, ai-governance-v2, qcon, and finos.fluxnova namespaces`);
} else if (!isEmptyDatabase) {
    logSkip("Existing database — not seeding architectures; the new shape needs the index swap "
        + "that SchemaMigrationRunner will perform on startup");
} else {
    logSkip("Architectures already initialized, skipping...");
}

logSection("User Access");
if (db.userAccess.countDocuments() === 0) {
    db.userAccess.insertMany([
        {
            "userAccessId": NumberInt(1),
            "username": "demo_admin",
            "permission": "admin",
            "namespace": "finos"
        },
        {
            "userAccessId": NumberInt(2),
            "username": "demo_admin",
            "permission": "admin",
            "namespace": "workshop"
        },
        {
            "userAccessId": NumberInt(3),
            "username": "demo_admin",
            "permission": "read",
            "namespace": "traderx"
        },
        {
            "userAccessId": NumberInt(4),
            "username": "demo",
            "permission": "read",
            "namespace": "finos"
        },
        {
            "userAccessId": NumberInt(5),
            "username": "demo",
            "permission": "read",
            "namespace": "traderx"
        },
        {
            "userAccessId": NumberInt(6),
            "username": "demo",
            "permission": "read",
            "namespace": "workshop"
        },
        {
            "userAccessId": NumberInt(7),
            "username": "*",
            "permission": "read",
            "namespace": "finos"
        },
        {
            "userAccessId": NumberInt(8),
            "username": "*",
            "permission": "read",
            "namespace": "workshop"
        },
        {
            "userAccessId": NumberInt(9),
            "username": "*",
            "permission": "read",
            "namespace": "traderx"
        },
        {
            "userAccessId": NumberInt(10),
            "username": "*",
            "permission": "read",
            "namespace": "ai-governance-v2"
        },
        {
            "userAccessId": NumberInt(11),
            "username": "*",
            "permission": "read",
            "namespace": "qcon"
        },
        {
            "userAccessId": NumberInt(12),
            "username": "*",
            "permission": "read",
            "namespace": "finos.fluxnova"
        }
    ]);
    logSuccess("Initialized user access for demo_admin, demo, and * (public read) users");
} else {
    logSkip("User access already initialized, skipping...");
}

logSection("ADRs");
// Gated on the database being empty, like the other migrated types.
if (isEmptyDatabase && db.adrs.countDocuments() === 0) {
    // Grouped by namespace for readability only — seedVersionedResource fans this out.
    // ADR keys its map "revisions", by integer, so the field name is passed explicitly.
    const adrsByNamespace = [
        {
            namespace: 'finos',
            adrs: [
                {
                    adrId: NumberInt(1),
                    // Denormalized copy of revisions[1].title — see
                    // calm-hub/decisions/0006-denormalize-adr-title-onto-header.md.
                    // seedVersionedResource writes this onto the header the same way it
                    // already does for every other type's `name`.
                    name: 'Example ADR',
                    revisions: {
                        1: {
                            title: 'Example ADR',
                            status: 'draft',
                            creationDateTime: [2025, 4, 29, 12, 44, 25, 465265627],
                            updateDateTime: [2025, 5, 29, 12, 10, 0, 465338085],
                            contextAndProblemStatement: `**Lorem ipsum dolor sit amet** , consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.  \
    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.  
    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat *nulla pariatur* 

    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        
    ![An Example Flowchart Image](https://s3-eu-west-1.amazonaws.com/arisexpress/info_site/flowchart.png "an example flowchart image")

    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.  \n  \nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                            `,
                            decisionDrivers: [
                                'Lorem ipsum dolor sit amet.',
                                'Consectetur adipiscing elit.',
                                'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                            ],
                            consideredOptions: [
                                {
                                    name: 'Making a table to display the considered options',
                                    description: `Lorem ipsum dolor sit amet, **consectetur adipiscing elit**, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex *ea commodo consequat*. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`,
                                    positiveConsequences: [
                                        'Is compact',
                                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor',
                                    ],
                                    negativeConsequences: [
                                        'Very little reusable code',
                                        'Have to set the border of each cell',
                                        'Both the positive and negative consequesnces are both lists so this will not display nicely',
                                    ],
                                },
                                {
                                    name: 'Using a collapsible list to display the considered options',
                                    description:
                                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                                    positiveConsequences: [
                                        'Looks much better than current design',
                                        'Screen will look less cluttered',
                                    ],
                                    negativeConsequences: [
                                        'Daisy UI will not play ball',
                                    ],
                                },
                            ],
                            decisionOutcome: {
                                chosenOption: {
                                    name: 'Using a collapsible list  to display the considered options',
                                    description:
                                        'Lorem ipsum dolor sit amet, **consectetur adipiscing elit, sed do eiusmod tempor incididunt** ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                                    positiveConsequences: [
                                        'Looks much better than current design',
                                        'Screen will look less cluttered',
                                    ],
                                    negativeConsequences: [
                                        'Daisy UI will not play ball',
                                    ],
                                },
                                rationale:
                                    'It looks much nicer than the current design and allows users to collapse and exand options at will',
                            },
                            links: [
                                { rel: 'Daisy UI', href: 'http://my-link.com' },
                                {
                                    rel: 'Suggested table design',
                                    href: 'http://my-link.com',
                                },
                            ],
                        },
                    },
                },
            ],
        },
        {
            namespace: 'workshop',
            adrs: [
                {
                    adrId: NumberInt(1),
                    // Denormalized copy of revisions[1].title — see
                    // calm-hub/decisions/0006-denormalize-adr-title-onto-header.md.
                    name: 'Use Load Balancer for Traffic Distribution',
                    revisions: {
                        1: {
                            title: 'Use Load Balancer for Traffic Distribution',
                            status: 'accepted',
                            creationDateTime: [2025, 3, 15, 10, 30, 0, 0],
                            updateDateTime: [2025, 3, 20, 14, 0, 0, 0],
                            contextAndProblemStatement: 'The conference signup system needs to handle variable traffic loads during registration periods. We need a strategy to distribute incoming requests across multiple service instances to ensure availability and performance.',
                            decisionDrivers: [
                                'High availability during peak registration periods',
                                'Horizontal scalability of the attendees service',
                                'Even distribution of load across service instances',
                            ],
                            consideredOptions: [
                                {
                                    name: 'DNS Round Robin',
                                    description: 'Use DNS-based load balancing to distribute traffic across service instances.',
                                    positiveConsequences: ['Simple to configure', 'No additional infrastructure required'],
                                    negativeConsequences: ['No health checking', 'Uneven distribution with caching'],
                                },
                                {
                                    name: 'Dedicated Load Balancer',
                                    description: 'Deploy a dedicated load balancer (e.g. NGINX, HAProxy) in front of service instances.',
                                    positiveConsequences: ['Health checking and automatic failover', 'Even traffic distribution', 'SSL termination'],
                                    negativeConsequences: ['Additional infrastructure component', 'Requires configuration management'],
                                },
                            ],
                            decisionOutcome: {
                                chosenOption: {
                                    name: 'Dedicated Load Balancer',
                                    description: 'Deploy a dedicated load balancer in front of the attendees service for health-aware traffic distribution.',
                                    positiveConsequences: ['Health checking and automatic failover', 'Even traffic distribution', 'SSL termination'],
                                    negativeConsequences: ['Additional infrastructure component', 'Requires configuration management'],
                                },
                                rationale: 'A dedicated load balancer provides health checking and automatic failover which are critical for ensuring availability during peak conference registration periods.',
                            },
                            links: [
                                { rel: 'Conference Signup Architecture', href: '/calm/namespaces/workshop/architectures/2/versions/1-0-0' },
                            ],
                        },
                    },
                },
            ],
        },
    ];
    const seededAdrs = seedVersionedResource(
        adrsByNamespace, "adrs", "adrVersions", "adrs", "adrId", "revisions", "numeric");
    logSuccess(`Initialized ${seededAdrs.headers} ADRs and ${seededAdrs.versions} revisions`);
} else if (!isEmptyDatabase) {
    logSkip("Existing database — not seeding ADRs; the new shape needs the index swap "
        + "that SchemaMigrationRunner will perform on startup");
} else {
    logSkip("ADRs already initialized, skipping...");
}

logSection("Decorators");
if (db.decorators.countDocuments() === 0) {
    db.decorators.insertMany([
        {
            namespace: "finos",
            decorators: [
                {
                    decoratorId: NumberInt(1),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-02-23T10:00:00Z",
                            "end-time": "2026-02-23T10:05:30Z",
                            "status": "completed",
                            "observability": "https://grafana.example.com/d/finos-architecture-1",
                            "deployment-url": "https://jenkins.example.com/job/finos-architecture/123/",
                            "notes": "Production deployment of FINOS Architecture 1 with baseline configuration"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(2),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment-v2",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-03-04T15:00:00Z",
                            "end-time": "2026-03-04T15:08:15Z",
                            "status": "failed",
                            "notes": "Second production deployment failed during canary rollout because of a configuration regression"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(3),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment-v3",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-03-10T11:20:00Z",
                            "status": "in-progress",
                            "helm-chart-version": "finos-architecture-service-2.4.1",
                            "namespace": "finos-prod-core",
                            "deployment-url": "https://argocd.example.com/applications/finos-architecture",
                            "notes": "Third production deployment is currently rolling out with updated Helm chart values"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(4),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-pattern-1-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/patterns/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "pattern"
                        ],
                        "applies-to": [
                            "node-a", "relationship-x"
                        ],
                        "data": {
                            "start-time": "2026-02-15T09:30:00Z",
                            "end-time": "2026-02-15T09:35:20Z",
                            "status": "completed",
                            "deployment-url": "https://github.com/finos/actions/runs/987654321",
                            "notes": "Pattern deployment via GitHub Actions"
                        }
                    }
                }
            ]
        },
        {
            namespace: "workshop",
            decorators: [
                {
                    decoratorId: NumberInt(1),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "workshop-conference-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/workshop/architectures/2/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "conference-website",
                            "load-balancer"
                        ],
                        "data": {
                            "start-time": "2026-03-01T14:30:00Z",
                            "end-time": "2026-03-01T14:35:45Z",
                            "status": "completed",
                            "deployment-url": "https://vercel.com/workshop/deployments/abc123xyz",
                            "notes": "Workshop conference system deployment via Vercel"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(2),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/observability/observability.decorator.schema.json",
                        "unique-id": "workshop-conference-monitoring",
                        "type": "observability",
                        "target": [
                            "/calm/namespaces/workshop/architectures/2/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "conference-website"
                        ],
                        "data": {
                            "dashboard-url": "https://datadog.example.com/dashboard/workshop-conference",
                            "notes": "Monitoring dashboard for workshop conference system"
                        }
                    }
                }
            ]
        }
    ]);
    logSuccess("Initialized decorators for finos and workshop namespaces");
} else {
    logSkip("Decorators already initialized, skipping...");
}

logSection("Interfaces");
// Insert a sample Host Port interface for the finos namespace
// Gated on the database being empty, like the other migrated types.
if (isEmptyDatabase && db.interfaces.countDocuments() === 0) {
    // Grouped by namespace for readability only — seedVersionedResource fans this out.
    const interfacesByNamespace = [{
        namespace: "finos",
        interfaces: [
            {
                interfaceId: NumberInt(1),
                name: "Host Port Interface",
                description: "A standard host and port interface definition for network-accessible services",
                versions: {
                    "1.0.0": {
                        "$schema": "https://json-schema.org/draft/2020-12/schema",
                        "$id": "https://calm.finos.org/calm/namespaces/finos/interfaces/1/versions/1.0.0",
                        "title": "Host Port Interface",
                        "description": "Defines a host and port interface for network-accessible services",
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "host": {
                                "type": "string",
                                "description": "The hostname or IP address of the service"
                            },
                            "port": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 65535,
                                "description": "The port number the service listens on"
                            }
                        },
                        "required": [
                            "unique-id",
                            "host",
                            "port"
                        ]
                    },
                    "2-0-0": {
                        "$schema": "https://json-schema.org/draft/2020-12/schema",
                        "$id": "https://calm.finos.org/calm/namespaces/finos/interfaces/1/versions/2.0.0",
                        "title": "Host Port Interface",
                        "description": "Defines a host and port interface for network-accessible services, with optional protocol",
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "host": {
                                "type": "string",
                                "description": "The hostname or IP address of the service"
                            },
                            "port": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 65535,
                                "description": "The port number the service listens on"
                            },
                            "protocol": {
                                "type": "string",
                                "enum": ["HTTP", "HTTPS", "TCP", "UDP", "gRPC"],
                                "description": "The network protocol used by the service"
                            }
                        },
                        "required": [
                            "unique-id",
                            "host",
                            "port"
                        ]
                    }
                }
            }
        ]
    }];
    const seededInterfaces = seedVersionedResource(
        interfacesByNamespace, "interfaces", "interfaceVersions", "interfaces", "interfaceId");
    logSuccess(`Initialized ${seededInterfaces.headers} interfaces and ${seededInterfaces.versions} versions for finos namespace`);
} else if (!isEmptyDatabase) {
    logSkip("Existing database — not seeding interfaces; the new shape needs the index swap "
        + "that SchemaMigrationRunner will perform on startup");
} else {
    logSkip("Interfaces already initialized, skipping...");
}

logSection("Resource Mappings");
// resourceType is part of the unique key so the same customId can be reused across different
// resource types (e.g. a pattern and an architecture can both be named "repo") — see
// MongoResourceMappingIndexStep for the migration that carries existing deployments to this shape.
db.resource_mappings.createIndex({ namespace: 1, resourceType: 1, customId: 1 }, { unique: true });
db.resource_mappings.createIndex({ namespace: 1, resourceType: 1, numericId: 1 });
logSuccess("Created resource_mappings indexes");

if (db.resource_mappings.countDocuments() === 0) {
    db.resource_mappings.insertMany([
        { namespace: "finos", customId: "api-gateway-pattern", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "finos", customId: "flow-1", resourceType: "FLOW", numericId: NumberInt(1) },
        { namespace: "finos", customId: "flow-2", resourceType: "FLOW", numericId: NumberInt(2) },
        { namespace: "finos", customId: "sample-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(1) },
        { namespace: "traderx", customId: "add-update-account", resourceType: "FLOW", numericId: NumberInt(1) },
        { namespace: "traderx", customId: "load-list-of-accounts", resourceType: "FLOW", numericId: NumberInt(2) },
        { namespace: "traderx", customId: "traderx", resourceType: "ARCHITECTURE", numericId: NumberInt(3) },
        { namespace: "workshop", customId: "conference-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "workshop", customId: "conference-secure-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(2) },
        { namespace: "workshop", customId: "conference-signup-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(2) },
        { namespace: "qcon", customId: "trades-api-and-mcp", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "qcon", customId: "trades-api-and-mcp-conforming-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(5) },
        { namespace: "finos.fluxnova", customId: "fluxnova-platform", resourceType: "ARCHITECTURE", numericId: NumberInt(6) },
        { namespace: "finos.fluxnova", customId: "fluxnova-microservices", resourceType: "ARCHITECTURE", numericId: NumberInt(7) },
        { namespace: "finos.fluxnova", customId: "fluxnova-kyc-onboarding", resourceType: "ARCHITECTURE", numericId: NumberInt(8) },
        { namespace: "finos.fluxnova", customId: "fluxnova-settlement", resourceType: "ARCHITECTURE", numericId: NumberInt(9) },
        { namespace: "finos.fluxnova", customId: "fluxnova-flash-risk", resourceType: "ARCHITECTURE", numericId: NumberInt(10) },
        { namespace: "finos.fluxnova", customId: "fluxnova-ai-agent", resourceType: "ARCHITECTURE", numericId: NumberInt(11) }
    ]);
    logSuccess("Initialized resource_mappings with seed data");
} else {
    logSkip("Resource mappings already exist, no initialization needed");
}

logSection("Initialization complete");