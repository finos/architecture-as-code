db = db.getSiblingDB('calmSchemas');  // Use the calmSchemas database

// Insert the initial counter document if it doesn't exist
if (db.counters.countDocuments({ _id: "patternStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "patternStoreCounter",
        sequence_value: 1
    });
    print("Initialized patternStoreCounter with sequence_value 1");
} else {
    print("patternStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 1
    });
    print("Initialized architectureStoreCounter with sequence_value 1");
} else {
    print("architectureStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "adrStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "adrStoreCounter",
        sequence_value: 1
    });
    print("Initialized adrStoreCounter with sequence_value 1");
} else {
    print("adrStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "standardStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "standardStoreCounter",
        sequence_value: 1
    });
    print("Initialized standardStoreCounter with sequence_value 1");
} else {
    print("standardStoreCounter already exists, no initialization needed");
}


if (db.counters.countDocuments({ _id: "flowStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "flowStoreCounter",
        sequence_value: 1
    });
    print("Initialized flowStoreCounter with sequence_value 1");
} else {
    print("flowStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "userAccessStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "userAccessStoreCounter",
        sequence_value: 6
    });
    print("Initialized userAccessStoreCounter with sequence_value 6");
} else {
    print("userAccessStoreCounter already exists, no initialization needed");
}

db.schemas.insertMany([               // Insert initial documents into the schemas collection
    {
        version: "2025-03",
        schemas: {
            "calm.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",

                "$vocabulary": {
                    "https://json-schema.org/draft/2020-12/vocab/core": true,
                    "https://json-schema.org/draft/2020-12/vocab/applicator": true,
                    "https://json-schema.org/draft/2020-12/vocab/validation": true,
                    "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
                    "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
                    "https://json-schema.org/draft/2020-12/vocab/content": true,
                    "https://calm.finos.org/calm/schemas/2025-03/meta/core.json": true
                },
                "$dynamicAnchor": "meta",

                "title": "Common Architecture Language Model (CALM) Schema",
                "allOf": [
                    { "$ref": "https://json-schema.org/draft/2020-12/schema" },
                    { "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json" }
                ]
            },
            "control.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json",
                "title": "Common Architecture Language Model Controls",
                "description": "Controls model requirements for domains. For example, a security domain contains a series of control requirements",
                "defs": {
                    "control-detail": {
                        "type": "object",
                        "properties": {
                            "control-requirement-url": {
                                "type": "string",
                                "description": "The requirement schema that specifies how a control should be defined"
                            },
                            "control-config-url": {
                                "type": "string",
                                "description": "The configuration of how the control requirement schema is met"
                            }
                        },
                        "required": [
                            "control-requirement-url"
                        ]
                    },
                    "controls": {
                        "type": "object",
                        "patternProperties": {
                            "^[a-zA-Z0-9-]+$": {
                                "type": "object",
                                "properties": {
                                    "description": {
                                        "type": "string",
                                        "description": "A description of a control and how it applies to a given architecture"
                                    },
                                    "requirements": {
                                        "type": "array",
                                        "items": {
                                            "$ref": "#/defs/control-detail"
                                        }
                                    }
                                },
                                "required": [
                                    "description",
                                    "requirements"
                                ]
                            }
                        }
                    }
                }
            },
            "control-requirement.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/control-requirement.json",
                "title": "Common Architecture Language Model Control Requirement",
                "description": "Schema for defining control requirements within the Common Architecture Language Model.",
                "type": "object",
                "properties": {
                    "control-id": {
                        "type": "string",
                        "description": "The unique identifier of this control, which has the potential to be used for linking evidence"
                    },
                    "name": {
                        "type": "string",
                        "description": "The name of the control requirement that provides contextual meaning within a given domain"
                    },
                    "description": {
                        "type": "string",
                        "description": "A more detailed description of the control and information on what a developer needs to consider"
                    }
                },
                "required": [
                    "control-id",
                    "name",
                    "description"
                ],
                "examples": [
                    {
                        "control-id": "CR-001",
                        "name": "Access Control",
                        "description": "Ensure that access to sensitive information is restricted."
                    }
                ]
            },
            "core.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json",
                "title": "Common Architecture Language Model (CALM) Vocab",
                "properties": {
                    "nodes": {
                        "type": "array",
                        "items": {
                            "$ref": "#/defs/node"
                        }
                    },
                    "relationships": {
                        "type": "array",
                        "items": {
                            "$ref": "#/defs/relationship"
                        }
                    },
                    "metadata": {
                        "$ref": "#/defs/metadata"
                    },
                    "controls": {
                        "$ref": "control.json#/defs/controls"
                    },
                    "flows": {
                        "type": "array",
                        "items": {
                            "$ref": "flow.json#/defs/flow"
                        }
                    }
                },
                "defs": {
                    "node": {
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "node-type": {
                                "$ref": "#/defs/node-type-definition"
                            },
                            "name": {
                                "type": "string"
                            },
                            "description": {
                                "type": "string"
                            },
                            "details": {
                                "type": "object",
                                "properties": {
                                    "detailed-architecture": {
                                        "type": "string"
                                    },
                                    "required-pattern": {
                                        "type": "string"
                                    }
                                },
                                "additionalProperties": false
                            },
                            "data-classification": {
                                "$ref": "#/defs/data-classification"
                            },
                            "run-as": {
                                "type": "string"
                            },
                            "interfaces": {
                                "type": "array",
                                "items": {
                                    "$ref": "interface.json#/defs/interface-type"
                                }
                            },
                            "controls": {
                                "$ref": "control.json#/defs/controls"
                            },
                            "metadata": {
                                "$ref": "#/defs/metadata"
                            }
                        },
                        "required": [
                            "unique-id",
                            "node-type",
                            "name",
                            "description"
                        ],
                        "additionalProperties": true
                    },
                    "relationship": {
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "description": {
                                "type": "string"
                            },
                            "relationship-type": {
                                "type": "object",
                                "properties": {
                                    "interacts": {
                                        "$ref": "#/defs/interacts-type"
                                    },
                                    "connects": {
                                        "$ref": "#/defs/connects-type"
                                    },
                                    "deployed-in": {
                                        "$ref": "#/defs/deployed-in-type"
                                    },
                                    "composed-of": {
                                        "$ref": "#/defs/composed-of-type"
                                    },
                                    "options": {
                                        "$ref": "#/defs/option-type"
                                    }
                                },
                                "oneOf": [
                                    {
                                        "required": [
                                            "deployed-in"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "composed-of"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "interacts"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "connects"
                                        ]
                                    },
                                    {
                                        "required": [
                                            "options"
                                        ]
                                    }
                                ]
                            },
                            "protocol": {
                                "$ref": "#/defs/protocol"
                            },
                            "authentication": {
                                "$ref": "#/defs/authentication"
                            },
                            "metadata": {
                                "$ref": "#/defs/metadata"
                            },
                            "controls": {
                                "$ref": "control.json#/defs/controls"
                            }
                        },
                        "required": [
                            "unique-id",
                            "relationship-type"
                        ],
                        "additionalProperties": true
                    },
                    "data-classification": {
                        "enum": [
                            "Public",
                            "Confidential",
                            "Highly Restricted",
                            "MNPI",
                            "PII"
                        ]
                    },
                    "protocol": {
                        "enum": [
                            "HTTP",
                            "HTTPS",
                            "FTP",
                            "SFTP",
                            "JDBC",
                            "WebSocket",
                            "SocketIO",
                            "LDAP",
                            "AMQP",
                            "TLS",
                            "mTLS",
                            "TCP"
                        ]
                    },
                    "authentication": {
                        "enum": [
                            "Basic",
                            "OAuth2",
                            "Kerberos",
                            "SPNEGO",
                            "Certificate"
                        ]
                    },
                    "node-type-definition": {
                        "enum": [
                            "actor",
                            "ecosystem",
                            "system",
                            "service",
                            "database",
                            "network",
                            "ldap",
                            "webclient",
                            "data-asset"
                        ]
                    },
                    "interacts-type": {
                        "type": "object",
                        "required": [
                            "actor",
                            "nodes"
                        ],
                        "properties": {
                            "actor": {
                                "type": "string"
                            },
                            "nodes": {
                                "type": "array",
                                "minItems": 1,
                                "items": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "connects-type": {
                        "type": "object",
                        "properties": {
                            "source": {
                                "$ref": "interface.json#/defs/node-interface"
                            },
                            "destination": {
                                "$ref": "interface.json#/defs/node-interface"
                            }
                        },
                        "required": [
                            "source",
                            "destination"
                        ]
                    },
                    "deployed-in-type": {
                        "type": "object",
                        "properties": {
                            "container": {
                                "type": "string"
                            },
                            "nodes": {
                                "type": "array",
                                "minItems": 1,
                                "items": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "composed-of-type": {
                        "required": [
                            "container",
                            "nodes"
                        ],
                        "type": "object",
                        "properties": {
                            "container": {
                                "type": "string"
                            },
                            "nodes": {
                                "type": "array",
                                "minItems": 1,
                                "items": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "option-type": {
                        "type": "array",
                        "items": {
                            "$ref": "#/defs/decision"
                        }
                    },
                    "decision": {
                        "type": "object",
                        "properties": {
                            "description": {
                                "type": "string"
                            },
                            "nodes": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "relationships": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "controls": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "metadata": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": [
                            "description",
                            "nodes",
                            "relationships"
                        ]
                    },
                    "metadata": {
                        "type": "array",
                        "items": {
                            "type": "object"
                        }
                    }
                }
            },
            "evidence.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/drat/2025-03/meta/evidence.json",
                "title": "Common Architecture Language Model Evidence",
                "description": "Schema for defining evidence for control requirements within the Common Architecture Language Model.",
                "type": "object",
                "properties": {
                    "evidence": {
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string",
                                "description": "CALM unique-id for future linking and uniquely defining this evidence"
                            },
                            "evidence-paths": {
                                "type": "array",
                                "description": "Paths to the evidence relating to a specific control",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "control-configuration-url": {
                                "type": "string",
                                "description": "URI for the control configuration this evidence relates to"
                            }
                        },
                        "required": [
                            "unique-id",
                            "evidence-paths",
                            "control-configuration-url"
                        ]
                    }
                },
                "required": [
                    "evidence"
                ]
            },
            "flow.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/flow.json",
                "title": "Business Flow Model",
                "description": "Defines business flows that relate to technical architectures, allowing mapping of flows to technical components and attaching control requirements.",
                "defs": {
                    "transition": {
                        "type": "object",
                        "properties": {
                            "relationship-unique-id": {
                                "type": "string",
                                "description": "Unique identifier for the relationship in the architecture"
                            },
                            "sequence-number": {
                                "type": "integer",
                                "description": "Indicates the sequence of the relationship in the flow"
                            },
                            "summary": {
                                "type": "string",
                                "description": "Functional summary of what is happening in the transition"
                            },
                            "direction": {
                                "enum": [
                                    "source-to-destination",
                                    "destination-to-source"
                                ],
                                "default": "source-to-destination"
                            },
                            "required": [
                                "relationship-unique-id",
                                "sequence-number",
                                "summary"
                            ]
                        }
                    },
                    "metadata": {
                        "type": "array",
                        "items": {
                            "type": "object"
                        }
                    },
                    "flow": {
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string",
                                "description": "Unique identifier for the flow"
                            },
                            "name": {
                                "type": "string",
                                "description": "Descriptive name for the business flow"
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed description of the flow's purpose"
                            },
                            "requirement-url": {
                                "type": "string",
                                "description": "Link to a detailed requirement document"
                            },
                            "transitions": {
                                "type": "array",
                                "items": {
                                    "$ref": "#/defs/transition"
                                },
                                "minItems": 1
                            },
                            "controls": {
                                "$ref": "control.json#/defs/controls"
                            },
                            "metadata": {
                                "$ref": "#/defs/metadata"
                            }
                        },
                        "required": [
                            "unique-id",
                            "name",
                            "description",
                            "transitions"
                        ]
                    }
                }
            },
            "interface.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json",
                "title": "Common Architecture Language Model Interfaces",
                "defs": {
                    "interface-type": {
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "unique-id"
                        ]
                    },
                    "node-interface": {
                        "type": "object",
                        "properties": {
                            "node": {
                                "type": "string"
                            },
                            "interfaces": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": [
                            "node"
                        ]
                    },
                    "host-port-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "host": {
                                "type": "string"
                            },
                            "port": {
                                "type": "integer"
                            }
                        },
                        "required": [
                            "host",
                            "port"
                        ]
                    },
                    "hostname-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "hostname": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "hostname"
                        ]
                    },
                    "path-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "path"
                        ]
                    },
                    "oauth2-audience-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "audiences": {
                                "type": "array",
                                "minItems": 1,
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": [
                            "audiences"
                        ]
                    },
                    "url-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "url": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "url"
                        ]
                    },
                    "rate-limit-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "key": {
                                "$ref": "#/defs/rate-limit-key"
                            },
                            "time": {
                                "type": "integer"
                            },
                            "time-unit": {
                                "$ref": "#/defs/rate-limit-time-unit"
                            },
                            "calls": {
                                "type": "integer"
                            }
                        },
                        "required": [
                            "key",
                            "time",
                            "time-unit",
                            "calls"
                        ]
                    },
                    "rate-limit-key": {
                        "type": "object",
                        "properties": {
                            "key-type": {
                                "$ref": "#/defs/rate-limit-key-type"
                            },
                            "static-value": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "key-type"
                        ]
                    },
                    "rate-limit-key-type": {
                        "enum": [
                            "User",
                            "IP",
                            "Global",
                            "Header",
                            "OAuth2Client"
                        ]
                    },
                    "rate-limit-time-unit": {
                        "enum": [
                            "Seconds",
                            "Minutes",
                            "Hours"
                        ]
                    },
                    "container-image-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "image": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "image"
                        ]
                    },
                    "port-interface": {
                        "$ref": "#/defs/interface-type",
                        "type": "object",
                        "properties": {
                            "port": {
                                "type": "integer"
                            }
                        },
                        "required": [
                            "port"
                        ]
                    }
                }
            },
            "units.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/calm/schemas/2025-03/meta/units.json",
                "title": "Common Architecture Language Model Units",
                "defs": {
                    "time-unit": {
                        "type": "object",
                        "description": "A unit of time with a value and a unit type.",
                        "properties": {
                            "unit": {
                                "enum": [
                                    "nanoseconds",
                                    "milliseconds",
                                    "seconds",
                                    "minutes",
                                    "hours",
                                    "days",
                                    "weeks",
                                    "months",
                                    "years"
                                ],
                                "description": "The unit of time (e.g., seconds, minutes, hours)."
                            },
                            "value": {
                                "type": "number",
                                "minimum": 0,
                                "description": "The numeric value representing the amount of time."
                            }
                        },
                        "required": ["unit", "value"],
                        "additionalProperties": false,
                        "examples": [
                            {
                                "unit": "seconds",
                                "value": 30
                            },
                            {
                                "unit": "minutes",
                                "value": 15
                            },
                            {
                                "unit": "hours",
                                "value": 1
                            },
                            {
                                "unit": "days",
                                "value": 7
                            }
                        ]
                    },
                    "rate-unit": {
                        "type": "object",
                        "description": "A unit representing a rate (e.g., operations per second).",
                        "properties": {
                            "rate": {
                                "type": "number",
                                "minimum": 0,
                                "description": "The numeric value representing the rate."
                            },
                            "per": {
                                "enum": [
                                    "nanosecond",
                                    "microsecond",
                                    "millisecond",
                                    "second",
                                    "minute",
                                    "hour",
                                    "week",
                                    "month",
                                    "quarter",
                                    "year"
                                ],
                                "description": "The time unit defining the rate interval."
                            }
                        },
                        "required": ["rate", "per"],
                        "additionalProperties": false,
                        "examples": [
                            {
                                "rate": 30,
                                "per": "second"
                            },
                            {
                                "rate": 1000,
                                "per": "minute"
                            },
                            {
                                "rate": 5,
                                "per": "millisecond"
                            }
                        ]
                    },
                    "cron-expression": {
                        "type": "string",
                        "title": "Cron Expression",
                        "description": "A valid Unix-style cron expression.",
                        "pattern": "^([0-5]?\\d)\\s([01]?\\d|2[0-3])\\s(3[01]|[12]\\d|0?[1-9])\\s(1[0-2]|0?[1-9])\\s([0-6])$",
                        "examples": [
                            "0 0 * * 0",
                            "30 14 1 * 5",
                            "15 10 * * *"
                        ]
                    }
                },
                "additionalProperties": false
            }
        }
    }
]);

// Insert namespaces if they don't exist
if (db.namespaces.countDocuments() === 0) {
    db.namespaces.insertMany([
        { namespace: "finos" },
        { namespace: "workshop" },
        { namespace: "traderx" }
    ]);
    print("Initialized namespaces: finos, workshop, traderx");
} else {
    print("Namespaces already exist, no initialization needed");
}

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