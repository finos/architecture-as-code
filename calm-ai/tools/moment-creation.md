# CALM Moment Creation Guide

## Critical Requirements

⚠️ **ALWAYS call the moment creation tool before creating any moment**
⚠️ **ALWAYS call the control creation tool before adding controls to a moment**

## What Are Moments?

Moments represent the "major stages" an architecture progresses through over time. A moment represents a single point in time, and the architecture at that moment. They provide several key capabilities:

- **Time-Based Modeling**: Capture how an architecture evolves over time, including changes to nodes, interfaces, and controls.
- 
- **Non-Functional Requirements**: Controls can be added to moments to specify non-functional requirements such as security policies, compliance controls, and operational constraints governing the change to an architecture.

- **Architecture Decision Records**: Moments can have one or more architecture decision records (ADRs) associated with them, documenting key decisions made to reach that moment.

## Official JSON Schema Definition

The complete moment schema from the FINOS CALM v1.1 specification:

```json
{
    "node-moment": {
      "required": [
        "details"
      ],
      "properties": {
        "node-type": {
          "const": "moment"
        },
        "valid-from": {
          "type": "string",
          "format": "date",
          "description": "The date when this architecture moment came into effect."
        },
        "adrs": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "External links to ADRs (Architecture Decision Records) or similar documents that provide context or decisions related to why the architecture changed."
        },
        "interfaces": false
      }
    },
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
            "interfaces": {
                "type": "array",
                "items": {
                    "anyOf": [
                        { "$ref": "interface.json#/defs/interface-definition" },
                        { "$ref": "interface.json#/defs/interface-type" }
                    ]
                }
            },
            "controls": {
                "$ref": "control.json#/defs/controls"
            },
            "metadata": {
                "$ref": "#/defs/metadata"
            }
        },
        "required": ["unique-id", "node-type", "name", "description"],
        "additionalProperties": true
    },
    "node-type-definition": {
        "anyOf": [
            {
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
            {
                "type": "string"
            }
        ]
    },
    "metadata": {
        "oneOf": [
            {
                "type": "array",
                "items": {
                    "type": "object"
                }
            },
            {
                "type": "object",
                "additionalProperties": true
            }
        ]
    }
}
```

## Required Properties

Every moment MUST conform to both the `node` and `node-moment` schemas.

Every moment MUST have:

- `unique-id` (string)
- `node-type` (the constant value `moment`)
- `name` (string)
- `description` (string)
- `details` - MUST be present. Object with `detailed-architecture` or `required-pattern` properties

## Optional Properties

- `valid-from` - Date string (YYYY-MM-DD) indicating when this moment came into effect. It is ONLY permitted on past or current moments.
- `interfaces` - is NOT permitted on a moment
- `controls` - Compliance controls (see control creation tool)
- `metadata` - Additional information (see metadata creation tool for details)

## Details Property Structure

The `details` property follows this exact schema:

```json
{
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
    }
}
```

**Important**:

- The details object allows NO additional properties beyond `detailed-architecture` and `required-pattern`
- `detailed-architecture`: Fully qualified address/URL to a detailed architecture document (use `.architecture.json` suffix)
- `required-pattern`: Fully qualified address/URL to a required pattern document (use `.pattern.json` suffix)

## Metadata Schema Rules

Critical: Metadata can be either an array OR an object (see metadata creation tool for complete guidance):

```json
{
    "metadata": {
        "oneOf": [
            {
                "type": "array",
                "items": {
                    "type": "object"
                }
            },
            {
                "type": "object",
                "additionalProperties": true
            }
        ]
    }
}
```

## Example Moment

```json
{
    "unique-id": "trading-api-stage-1",
    "node-type": "moment",
    "name": "Trading API Service Initial Release",
    "description": "First design of trading API",
    "details": {
        "detailed-architecture": "https://calm.company.com/architectures/trading-api-v1.architecture.json"
    },
    "metadata": [
        {
            "version": "2.1.0",
            "owner": "Trading Team",
            "runtime": "Java 17"
        }
    ]
}
```

## Schema Validation Rules

1. **Required Properties**: Must include `unique-id`, `node-type`, `name`, `description1`, `details`.
2. **Node Type**: Must be `moment`
3. **Details Object**: Only allows `detailed-architecture` and `required-pattern` properties
4. **Metadata**: Can be array of objects OR single object (see metadata creation tool)
5. **Additional Properties**: Schema allows additional properties at node level (`"additionalProperties": true`)

## Key Reminders

- Always use the moment creation tool before creating moments
- Reference the metadata creation tool for metadata structure guidance
- The schema is authoritative - follow it exactly
- Node unique-ids must be unique across the entire timeline
