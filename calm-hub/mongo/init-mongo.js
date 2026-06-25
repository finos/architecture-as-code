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

const dbName = (typeof process !== 'undefined' && process.env.CALM_DB_NAME)
    ? process.env.CALM_DB_NAME
    : 'calmSchemas';
logSuccess(`Using database: ${dbName}`);
db = db.getSiblingDB(dbName);

logSection("Counters");
// Insert the initial counter document if it doesn't exist
if (db.counters.countDocuments({ _id: "patternStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "patternStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized patternStoreCounter with sequence_value 2");
} else {
    logSkip("patternStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized architectureStoreCounter with sequence_value 2");
} else {
    logSkip("architectureStoreCounter already exists, no initialization needed");
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
    logSkip("flowStoreCounter already exists, no initialization needed");
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
        { name: "qcon", description: "QCon scenario 3 namespace" }
    ]);
    logSuccess("Initialized namespaces: finos, workshop, traderx, ai-governance-v2, qcon");
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
if (db.patterns.countDocuments() === 0) {
    db.patterns.insertMany([
        {
            namespace: "finos",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "API Gateway Pattern",
                    description: "A pattern for securing and routing API traffic through a gateway with identity provider integration",
                    versions:
                    {
                        "1-0-0": {
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
                        "1-0-0": {
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
                        "1-0-0": {
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
                        "1-0-0": {
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
    ]);
    logSuccess("Initialized patterns for finos, workshop, and qcon namespaces");
} else {
    logSkip("Patterns already initialized, skipping...");
}

logSection("Flows");
if (db.flows.countDocuments() === 0) {
    db.flows.insertMany([
        {
            namespace: "finos",
            flows: [
                {
                    flowId: NumberInt(1),
                    name: "Flow 1",
                    description: "This is a non-compliant flow document. Just creating something to simulate",
                    versions:
                    {
                        "1-0-0": {
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
                        "1-0-0": {
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
                        "1-0-0": {
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
                        "1-0-0": {
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
    ]
    );
    logSuccess("Initialized flows for finos and traderx namespaces");
} else {
    logSkip("Flows already initialized, skipping...");
}

logSection("Architectures");
if (db.architectures.countDocuments() === 0) {
    db.architectures.insertMany([
        {
            namespace: "finos",
            architectures: [{
                architectureId: NumberInt(1),
                name: "Architecture 1",
                description: "This is a non-compliant arch document. Just creating something to simulate",
                versions:
                {
                    "1-0-0": {
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
                    architectureId: NumberInt(1),
                    name: "Conference Signup Architecture",
                    description: "Conference signup system with load-balanced services and Kubernetes deployment",
                    versions:
                    {
                        "1-0-0": {
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
                architectureId: NumberInt(1),
                name: "TraderX",
                description: "Simple Trading System architecture",
                versions:
                {
                    "1-0-0": {
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
                architectureId: NumberInt(2),
                name: "mcp-api-pipeline",
                description: "User → MCP Server (cloud-hosted) → API Service → Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
                versions: {
                    "1-0-0": {
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
                architectureId: NumberInt(1),
                name: "Trades API and MCP Architecture (Conforming)",
                description: "Conforming architecture with all required controls: micro-segmentation on cluster, permitted connections on all relationships, and MCP guardrail on MCP server",
                versions: {
                    "1-0-0": {
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
    ]);
    logSuccess("Initialized architectures for finos, workshop, traderx, ai-governance-v2, and qcon namespaces");
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
        }
    ]);
    logSuccess("Initialized user access for demo_admin, demo, and * (public read) users");
} else {
    logSkip("User access already initialized, skipping...");
}

logSection("ADRs");
if (db.adrs.countDocuments() === 0) {
    db.adrs.insertMany([
        {
            namespace: 'finos',
            adrs: [
                {
                    adrId: NumberInt(1),
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
                                { rel: 'Conference Signup Architecture', href: '/calm/namespaces/workshop/architectures/1/versions/1-0-0' },
                            ],
                        },
                    },
                },
            ],
        },
    ]);
    logSuccess("Initialized ADRs for finos and workshop namespaces");
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
                            "/calm/namespaces/workshop/architectures/1/versions/1-0-0"
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
                            "/calm/namespaces/workshop/architectures/1/versions/1-0-0"
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
if (db.interfaces.countDocuments() === 0) {
    db.interfaces.insertOne({
        namespace: "finos",
        interfaces: [
            {
                interfaceId: NumberInt(1),
                name: "Host Port Interface",
                description: "A standard host and port interface definition for network-accessible services",
                versions: {
                    "1-0-0": {
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
    });
    logSuccess("Initialized interfaces for finos namespace");
} else {
    logSkip("Interfaces already initialized, skipping...");
}

logSection("Resource Mappings");
db.resource_mappings.createIndex({ namespace: 1, customId: 1 }, { unique: true });
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
        { namespace: "traderx", customId: "traderx", resourceType: "ARCHITECTURE", numericId: NumberInt(1) },
        { namespace: "workshop", customId: "conference-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "workshop", customId: "conference-secure-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(2) },
        { namespace: "workshop", customId: "conference-signup-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(1) },
        { namespace: "qcon", customId: "trades-api-and-mcp", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "qcon", customId: "trades-api-and-mcp-conforming-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(1) }
    ]);
    logSuccess("Initialized resource_mappings with seed data");
} else {
    logSkip("Resource mappings already exist, no initialization needed");
}

logSection("Initialization complete");