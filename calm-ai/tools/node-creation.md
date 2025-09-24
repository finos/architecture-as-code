# CALM Node Creation Guide

## Critical Requirements

⚠️ **ALWAYS call the node creation tool before creating any nodes**
⚠️ **ALWAYS call the interface creation tool before adding interfaces to nodes**

## What Are Nodes?

Nodes represent the "boxes" in a typical architecture diagram and are the fundamental building blocks of any CALM architecture. They provide several key capabilities:

- **Multi-Level Representation**: Nodes can represent an architecture at different levels of fidelity. For example, one node could represent an entire system, while other nodes may represent the individual services, databases, and components that make up that system.

- **Functional Interfaces**: Interfaces can be added to nodes to expose the functions and capabilities that a given node offers to other parts of the architecture.

- **Non-Functional Requirements**: Controls can be added to nodes to specify non-functional requirements such as security policies, compliance controls, and operational constraints.

- **Flexible Granularity**: The level of detail you choose for nodes depends on your architectural modeling needs - from high-level system boundaries down to individual microservices and infrastructure components.

## Official JSON Schema Definition

The complete node schema from the FINOS CALM v1.0 specification:

```json
{
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

Every node MUST have:

- `unique-id` (string)
- `node-type` (from allowed enum values)
- `name` (string)
- `description` (string)

## Node Types

Available node-type values:

- `actor` - External systems or users
- `ecosystem` - High-level system boundaries
- `system` - Business systems
- `service` - Microservices or APIs
- `database` - Data storage systems
- `network` - Network infrastructure
- `ldap` - Directory services
- `webclient` - Web applications or frontends
- `data-asset` - Data files or datasets

**Note**: The schema also allows custom string values beyond the standard enum.

## Optional Properties

- `interfaces` - Communication endpoints (array) - Use interface creation tool for details
- `details` - Object with `detailed-architecture` or `required-pattern` properties
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

## Example Nodes

### Basic Service Node

```json
{
    "unique-id": "trading-api",
    "node-type": "service",
    "name": "Trading API Service",
    "description": "Core API for processing trading requests",
    "metadata": [
        {
            "version": "2.1.0",
            "owner": "Trading Team",
            "runtime": "Java 17"
        }
    ]
}
```

### Node with Details

```json
{
    "unique-id": "payment-system",
    "node-type": "system",
    "name": "Payment Processing System",
    "description": "Handles all payment transactions and reconciliation",
    "details": {
        "detailed-architecture": "https://calm.company.com/architectures/payment-system-v2.architecture.json",
        "required-pattern": "https://calm.company.com/patterns/pci-security.pattern.json"
    },
    "metadata": {
        "compliance": "PCI-DSS Level 1",
        "criticality": "high"
    }
}
```

### Database Node

```json
{
    "unique-id": "user-database",
    "node-type": "database",
    "name": "User Database",
    "description": "Primary database storing user account information"
}
```

## Schema Validation Rules

1. **Required Properties**: Must include `unique-id`, `node-type`, `name`, `description`
2. **Node Type**: Must be from enum or custom string
3. **Details Object**: Only allows `detailed-architecture` and `required-pattern` properties
4. **Metadata**: Can be array of objects OR single object (see metadata creation tool)
5. **Additional Properties**: Schema allows additional properties at node level (`"additionalProperties": true`)
6. **Interfaces**: Must follow interface schema (use interface creation tool)

## Key Reminders

- Always use the node creation tool before creating nodes
- Reference the interface creation tool for interface details
- Reference the metadata creation tool for metadata structure guidance
- The schema is authoritative - follow it exactly
- Node unique-ids must be unique across the entire architecture
