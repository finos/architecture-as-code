# CALM Relationship Creation Guide

## Critical Requirements

⚠️ **ALWAYS call the relationship creation tool before creating any relationships**

## Overview

Relationships connect nodes in your architecture and define how they interact or are organized.

## Official JSON Schema Definition

The complete relationship schema from the FINOS CALM v1.0 specification:

```json
{
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
                        "required": ["deployed-in"]
                    },
                    {
                        "required": ["composed-of"]
                    },
                    {
                        "required": ["interacts"]
                    },
                    {
                        "required": ["connects"]
                    },
                    {
                        "required": ["options"]
                    }
                ]
            },
            "protocol": {
                "$ref": "#/defs/protocol"
            },
            "metadata": {
                "$ref": "#/defs/metadata"
            },
            "controls": {
                "$ref": "control.json#/defs/controls"
            }
        },
        "required": ["unique-id", "relationship-type"],
        "additionalProperties": true
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
    "interacts-type": {
        "type": "object",
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
        },
        "required": ["actor", "nodes"]
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
        "required": ["source", "destination"]
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
        },
        "required": ["container", "nodes"]
    },
    "composed-of-type": {
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
        },
        "required": ["container", "nodes"]
    }
}
```

## Required Properties

Every relationship MUST have:

- `unique-id` (string)
- `relationship-type` (object with exactly one type using oneOf constraint)



## Relationship Types

The relationship-type must contain exactly ONE of these types (enforced by oneOf constraint):

## Usage Patterns

- **connects**: Use for systematic node-to-node connections (service-to-database, API-to-service, etc.)
- **interacts**: Use for actor-to-system interactions (user interacts with application, external system interacts with API)
- **deployed-in**: Use for deployment containment (service deployed in container, container deployed in cluster)
- **composed-of**: Use for logical composition (system composed of microservices, application composed of modules)

## Descriptions

**Note**: The schema shows `description` is optional, not required as commonly assumed.  However it is highly recommended to include
them as they convey rich information about how the overall architecture actually works.

Descriptions should be concise but clarify the _intent_ of the relationship.  The preferred style is to omit the source and
destination node names, but be very clear as to the directionality.  Examples:
- "Reads customer information from and writes to" (e.g. a service querying a database)
- "Sends traansactions to" (e.g. one service sending to another via a message queue)
- "Reviews trade summaries using" (e.g. a human interacting with a UI)

### Available Protocol Values

When using the optional `protocol` property, it must be from this enum:
`HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

### 1. connects

**Purpose**: Point-to-point connections between systematic nodes (services, systems, databases, etc.)

```json
"relationship-type": {
  "connects": {
    "source": {
      "node": "conference-website",
      "interfaces": ["conference-website-url"]
    },
    "destination": {
      "node": "load-balancer",
      "interfaces": ["load-balancer-host-port"]
    }
  }
}
```

### 2. interacts

**Purpose**: Business-level interactions between actors and systems

```json
"relationship-type": {
  "interacts": {
    "actor": "user",
    "nodes": ["conference-website", "attendees"]
  }
}
```

### 3. deployed-in

Containment relationships:

```json
"relationship-type": {
  "deployed-in": {
    "container": "k8s-cluster",
    "nodes": ["load-balancer", "attendees", "attendees-store"]
  }
}
```

### 4. composed-of

Composition relationships:

```json
"relationship-type": {
  "composed-of": {
    "container": "conference-system",
    "nodes": ["conference-website", "attendees", "attendees-store"]
  }
}
```

## Optional Properties

- `description` - Human-readable description (string)
- `protocol` - Communication protocol from allowed enum values above
- `metadata` - Additional information (see metadata creation tool for details)
- `controls` - Compliance controls (see control creation tool for details)

## Example Relationship

```json
{
    "unique-id": "attendees-attendees-store",
    "description": "Stores and requests attendee details in",
    "relationship-type": {
        "connects": {
            "source": {
                "node": "attendees"
            },
            "destination": {
                "node": "attendees-store"
            }
        }
    },
    "protocol": "JDBC"
}
```

## Schema Validation Rules

1. **Required Properties**: Must include `unique-id` and `relationship-type`
2. **OneOf Constraint**: relationship-type must contain exactly ONE of: `interacts`, `connects`, `deployed-in`, `composed-of`, or `options`
3. **Node References**: Must reference existing node unique-id values
4. **Interface References**: Must exist on the referenced node (for connects type)
5. **Protocol Enum**: Must be from the allowed protocol values if specified
6. **Array Constraints**: `nodes` arrays must have minimum 1 item
7. **Additional Properties**: Schema allows additional properties at relationship level (`"additionalProperties": true`)
8. **Metadata**: Can be array or object (see metadata creation tool)
9. **Controls**: Must follow control schema (see control creation tool)
