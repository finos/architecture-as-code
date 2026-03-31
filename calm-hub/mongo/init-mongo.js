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
        sequence_value: 1
    });
    logSuccess("Initialized patternStoreCounter with sequence_value 1");
} else {
    logSkip("patternStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized architectureStoreCounter with sequence_value 1");
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
        sequence_value: 1
    });
    logSuccess("Initialized flowStoreCounter with sequence_value 1");
} else {
    logSkip("flowStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "userAccessStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "userAccessStoreCounter",
        sequence_value: 6
    });
    logSuccess("Initialized userAccessStoreCounter with sequence_value 6");
} else {
    logSkip("userAccessStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "controlStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "controlStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized controlStoreCounter with sequence_value 2");
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

logSection("Namespaces");
// Insert namespaces if they don't exist
if (db.namespaces.countDocuments() === 0) {
    db.namespaces.insertMany([
        { name: "finos", description: "FINOS namespace" },
        { name: "workshop", description: "Workshop namespace" },
        { name: "traderx", description: "TraderX namespace" }
    ]);
    logSuccess("Initialized namespaces: finos, workshop, traderx");
} else {
    logSkip("Namespaces already exist, no initialization needed");
}

logSection("Domains");
// Insert domains if they don't exist
if (db.domains.countDocuments() === 0) {
    db.domains.insertMany([
        { name: "security" }
    ]);
    logSuccess("Initialized domains: security");
} else {
    logSkip("Domains already exist, no initialization needed");
}

logSection("Controls");
// Insert example controls for the security domain
if (db.controls.countDocuments() === 0) {
    db.controls.insertOne({
        domain: "security",
        controls: [
            {
                controlId: NumberInt(1),
                name: "Data Encryption",
                description: "Ensures all sensitive data is encrypted at rest and in transit using approved algorithms",
                requirement: {
                    "1-0-0": {
                        "$schema": "https://json-schema.org/draft/2020-12/schema",
                        "$id": "https://calm.finos.org/calm/domains/security/controls/1/requirement/versions/1.0.0",
                        "title": "Data Encryption Control Requirement",
                        "description": "Requirements for data encryption controls within the security domain",
                        "type": "object",
                        "properties": {
                            "control-id": {
                                "const": "SEC-ENC-001"
                            },
                            "name": {
                                "const": "Data Encryption"
                            },
                            "description": {
                                "const": "Ensure that all sensitive data is encrypted at rest and in transit"
                            },
                            "encryption-algorithm": {
                                "type": "string",
                                "description": "The encryption algorithm to use",
                                "enum": ["AES-128", "AES-256", "ChaCha20-Poly1305"]
                            },
                            "key-rotation-period": {
                                "type": "string",
                                "description": "How often encryption keys should be rotated",
                                "enum": ["30-days", "60-days", "90-days", "180-days", "365-days"]
                            },
                            "data-at-rest": {
                                "type": "boolean",
                                "description": "Whether data at rest must be encrypted"
                            },
                            "data-in-transit": {
                                "type": "boolean",
                                "description": "Whether data in transit must be encrypted"
                            }
                        },
                        "required": [
                            "control-id",
                            "name",
                            "description",
                            "encryption-algorithm",
                            "data-at-rest",
                            "data-in-transit"
                        ]
                    }
                },
                configurations: [
                    {
                        configurationId: NumberInt(1),
                        versions: {
                            "1-0-0": {
                                "control-id": "SEC-ENC-001",
                                "name": "Data Encryption",
                                "description": "Ensure that all sensitive data is encrypted at rest and in transit",
                                "encryption-algorithm": "AES-256",
                                "key-rotation-period": "90-days",
                                "data-at-rest": true,
                                "data-in-transit": true
                            }
                        }
                    }
                ]
            }
        ]
    });
    logSuccess("Initialized controls for security domain with example Data Encryption control");
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
        }
    ]);
    logSuccess("Initialized patterns for finos and workshop namespaces");
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
        }
    ]);
    logSuccess("Initialized architectures for finos and traderx namespaces");
} else {
    logSkip("Architectures already initialized, skipping...");
}

logSection("User Access");
if (db.userAccess.countDocuments() === 0) {
    db.userAccess.insertMany([
        {
            "userAccessId": NumberInt(1),
            "username": "demo_admin",
            "permission": "write",
            "namespace": "finos",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(2),
            "username": "demo_admin",
            "permission": "write",
            "namespace": "workshop",
            "resourceType": "patterns"
        },
        {
            "userAccessId": NumberInt(3),
            "username": "demo_admin",
            "permission": "read",
            "namespace": "traderx",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(4),
            "username": "demo",
            "permission": "read",
            "namespace": "finos",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(5),
            "username": "demo",
            "permission": "read",
            "namespace": "traderx",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(6),
            "username": "demo",
            "permission": "read",
            "namespace": "workshop",
            "resourceType": "all"
        }
    ]);
    logSuccess("Initialized user access for demo_admin and demo users");
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
    ]);
    logSuccess("Initialized ADRs for finos namespace");
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

logSection("Initialization complete");
