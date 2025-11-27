# CALM Flow Creation Guide

## Critical Requirements

🚨 **ALWAYS call the flow creation tool before creating any flows**

## Official JSON Schema Definition

The complete flow schema from the FINOS CALM v1.0 specification:

```json
{
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
                "$ref": "core.json#/defs/metadata"
            }
        },
        "required": ["unique-id", "name", "description", "transitions"],
        "additionalProperties": false
    },
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
            "description": {
                "type": "string",
                "description": "Functional summary of what is happening in the transition"
            },
            "direction": {
                "enum": ["source-to-destination", "destination-to-source"],
                "default": "source-to-destination"
            }
        },
        "required": ["relationship-unique-id", "sequence-number", "description"]
    }
}
```

## Overview

Flows in CALM represent business processes that traverse your architecture, showing how data and operations move through existing relationships between nodes.

## Required Properties

Every flow MUST have:

- `unique-id` (string)
- `name` (string) - Descriptive name for the business flow
- `description` (string) - Detailed description of the flow's purpose
- `transitions` (array of transition objects) - Minimum 1 transition

## Flow Structure

```json
{
    "unique-id": "trade-execution-flow",
    "name": "Trade Execution Process",
    "description": "End-to-end trade execution process from order submission to settlement",
    "requirement-url": "https://docs.company.com/trading/requirements/execution-flow.md",
    "transitions": [
        {
            "relationship-unique-id": "client-to-api-connection",
            "sequence-number": 1,
            "description": "Client submits trade order to API",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "api-to-database-connection",
            "sequence-number": 2,
            "description": "API stores trade order in database",
            "direction": "source-to-destination"
        }
    ],
    "metadata": {
        "business-owner": "Trading Operations",
        "sla": "< 500ms end-to-end",
        "throughput": "10,000 trades/second peak"
    }
}
```

## Transition Properties

Each transition requires:

- `relationship-unique-id` - Must reference an existing relationship in the architecture
- `sequence-number` - Integer indicating the order of this transition in the flow
- `description` - What happens in this transition

Optional transition properties:

- `direction` - Either "source-to-destination" (default) or "destination-to-source"

## Key Concepts

**Flows use existing relationships**: Transitions must reference relationships that already exist in your architecture. Flows don't create new connections - they describe how business processes move through existing architectural relationships.

**Direction matters**: Each transition can flow in either direction of a relationship:

- `source-to-destination` (default): From the relationship's `from` node to its `to` node
- `destination-to-source`: From the relationship's `to` node back to its `from` node

## Complete Flow Example

```json
{
    "unique-id": "customer-onboarding-flow",
    "name": "Customer Onboarding Process",
    "description": "Complete customer onboarding and account creation process with compliance checks",
    "requirement-url": "https://docs.company.com/customer/onboarding-requirements.md",
    "transitions": [
        {
            "relationship-unique-id": "portal-to-identity-service",
            "sequence-number": 1,
            "description": "Customer submits identity documents through portal",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "identity-service-to-kyc-database",
            "sequence-number": 2,
            "description": "Identity service stores documents for KYC verification",
            "direction": "source-to-destination"
        },
        {
            "relationship-unique-id": "kyc-database-to-compliance-service",
            "sequence-number": 3,
            "description": "Compliance service retrieves documents for review",
            "direction": "destination-to-source"
        },
        {
            "relationship-unique-id": "compliance-service-to-account-service",
            "sequence-number": 4,
            "description": "Compliance approval triggers account creation",
            "direction": "source-to-destination"
        }
    ],
    "metadata": {
        "business-owner": "Customer Operations",
        "sla": "24 hours completion",
        "compliance": ["KYC", "AML", "GDPR"],
        "automation-level": "75%",
        "monthly-volume": "5000 new customers"
    }
}
```

## Optional Properties

**requirement-url**: Link to detailed business requirements

```json
"requirement-url": "https://docs.company.com/flows/trade-execution.md"
```

**controls**: Reference to control requirements (see control creation tool)

```json
"controls": {
    "control-requirements": ["data-encryption", "audit-logging"]
}
```

**metadata**: Additional flow information (see metadata creation tool)

```json
"metadata": {
    "business-criticality": "high",
    "peak-throughput": "1000 transactions/minute"
}
```

## Validation Rules

1. `unique-id` must be unique across all flows in the architecture
2. `transitions` array must have at least 1 transition (`minItems: 1`)
3. Each `relationship-unique-id` must reference an existing relationship in the architecture
4. `sequence-number` should start from 1 and increment logically
5. `direction` must be either "source-to-destination" or "destination-to-source"
6. All required properties must be present

## Best Practices

- Use descriptive flow names that reflect the business process
- Include requirement-url for traceability to business documentation
- Order transitions logically with sequential numbering
- Add metadata for operational and compliance information
- Reference existing relationships - don't invent new connections
- Use clear, business-focused descriptions for each transition
