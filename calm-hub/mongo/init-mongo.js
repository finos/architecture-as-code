db = db.getSiblingDB('calmSchemas');  // Use the calmSchemas database

// Insert the initial counter document if it doesn't exist
if (db.counters.countDocuments({ _id: "patternStoreCounter" }) === 1) {
    db.counters.insertOne({
        _id: "patternStoreCounter",
        sequence_value: 1
    });
    print("Initialized patternStoreCounter with sequence_value 1");
} else {
    print("patternStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 1) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 1
    });
    print("Initialized architectureStoreCounter with sequence_value 1");
} else {
    print("architectureStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "adrStoreCounter" }) === 1) {
    db.counters.insertOne({
        _id: "adrStoreCounter",
        sequence_value: 1
    });
    print("Initialized adrStoreCounter with sequence_value 1");
} else {
    print("adrStoreCounter already exists, no initialization needed");
}


db.schemas.insertMany([               // Insert initial documents into the schemas collection
    {
        version: "2024-10",
        schemas: {
            "calm.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/draft/2024-10/meta/calm.json",

                "$vocabulary": {
                    "https://json-schema.org/draft/2020-12/vocab/core": true,
                    "https://json-schema.org/draft/2020-12/vocab/applicator": true,
                    "https://json-schema.org/draft/2020-12/vocab/validation": true,
                    "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
                    "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
                    "https://json-schema.org/draft/2020-12/vocab/content": true,
                    "https://calm.finos.org/draft/2024-10/meta/core.json": true
                },
                "$dynamicAnchor": "meta",

                "title": "Common Architecture Language Model (CALM) Schema",
                "allOf": [
                    {"$ref": "https://json-schema.org/draft/2020-12/schema"},
                    {"$ref": "https://calm.finos.org/draft/2024-10/meta/core.json"}
                ]
            },
            "control.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/draft/2024-10/meta/control.json",
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
                "$id": "https://calm.finos.org/draft/2024-10/meta/control-requirement.json",
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
                "$id": "https://calm.finos.org/draft/2024-10/meta/core.json",
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
                            "detailed-architecture": {
                                "type": "string"
                            },
                            "data-classification": {
                                "$ref": "#/defs/data-classification"
                            },
                            "run-as": {
                                "type": "string"
                            },
                            "instance": {
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
                            "system",
                            "service",
                            "database",
                            "network",
                            "ldap",
                            "webclient",
                            "data-assset"
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
                "$id": "https://calm.finos.org/draft/2024-10/meta/evidence.json",
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
                        "required":[
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
                "$id": "https://calm.finos.org/draft/2024-10/meta/flow.json",
                "title": "Business Flow Model",
                "description": "Defines business flows that relate to technical architectures, allowing mapping of flows to technical components and attaching control requirements.",
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
                        }
                    },
                    "controls": {
                        "$ref": "https://calm.finos.org/draft/2024-10/meta/control.json#/defs/controls"
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
                ],
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
                        },
                        "minItems": 1
                    },
                    "metadata": {
                        "type": "array",
                        "items": {
                            "type": "object"
                        }
                    }
                }
            },
            "interface.json": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "https://calm.finos.org/draft/2024-10/meta/interface.json",
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
                "$id": "https://calm.finos.org/draft/2024-10/meta/units.json",
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

db.namespaces.insertMany([
    { namespace: "finos" }
]);
