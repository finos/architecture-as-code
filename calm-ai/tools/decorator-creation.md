# CALM Decorator Creation Guide

## Critical Requirements

🚨 **ALWAYS read this guide fully before creating any decorators**
🚨 **Decorators are standalone documents — they do NOT modify the architecture file**

## What Are Decorators?

Decorators attach supplementary information to nodes, relationships, and other architecture elements **without modifying** the core architecture definition. They enable cross-cutting concerns — such as deployment tracking, security context, business metadata, and operational information — to be managed separately from the architecture itself.

**Key Principles:**

- **Separation of Concerns**: The architecture file stays clean and focused; contextual data is layered on top via decorators
- **Targeting**: Each decorator references one or more CALM documents (patterns, architectures, or controls) via `target` and specific elements within those documents via `applies-to`
- **Typed Data**: The `type` field categorizes the decorator, and the `data` object holds the payload whose shape is determined by the decorator type
- **Schema Inheritance**: Decorator types can extend the base schema, creating composable inheritance chains

## Official JSON Schema Definition

The complete base decorator schema from the FINOS CALM v1.2 specification:

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/release/1.2/meta/decorators.json",
    "title": "Common Architecture Language Model Decorators",
    "defs": {
        "decorator": {
            "type": "object",
            "properties": {
                "unique-id": {
                    "type": "string",
                    "description": "Unique identifier for this decorator"
                },
                "type": {
                    "type": "string",
                    "description": "Type of decorator - a free-form string identifying the decorator category"
                },
                "target": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "minItems": 1,
                    "description": "Array of file paths or URLs referencing the CALM documents (patterns, architectures, or controls) this decorator targets"
                },
                "applies-to": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "minItems": 1,
                    "description": "Array of unique-ids referencing nodes, relationships, flows, or other architecture elements"
                },
                "data": {
                    "type": "object",
                    "minProperties": 1,
                    "description": "Free-form JSON object containing the decorator's data"
                }
            },
            "required": [
                "unique-id",
                "type",
                "target",
                "applies-to",
                "data"
            ],
            "additionalProperties": false
        }
    }
}
```

## Required Properties

| Property | Type | Description |
|---|---|---|
| `unique-id` | string | Unique identifier for this decorator instance |
| `type` | string | A free-form string identifying the decorator category (e.g. `guide`, `business`, `threat-model`, `deployment`). Not an enum — any value is valid |
| `target` | array of strings | File paths or URLs referencing the CALM documents this decorator targets (min 1 item) |
| `applies-to` | array of strings | `unique-id` values of the architecture elements within the targeted documents (min 1 item) |
| `data` | object | JSON payload whose shape is determined by the decorator type (min 1 property) |

⚠️ **`additionalProperties: false`** — The top-level decorator object only allows the five properties above. All custom data goes inside the `data` object.

## Decorator Types

The `type` field is a **free-form string** — there is no enum constraint. You can use any value that makes sense for your domain. Common conventions include:

- **`guide`** — Design guidance or architectural decision records
- **`business`** — Business context such as cost centers, ownership, or regulatory classification
- **`threat-model`** — Security threat modeling information
- **`security`** — Security controls and compliance context
- **`deployment`** — Deployment tracking (status, timing, observability)
- **`operational`** — Operational runbook links, SLAs, incident contacts
- **`observability`** — Monitoring dashboards, alerting rules, health check endpoints

These are conventions, not schema-enforced values. Use whatever string best describes your decorator's purpose.

## Extending Decorators with Schemas

Decorator types can define their own schema for the `data` field by inheriting from the base decorator using `allOf`. Each extension schema:

1. Constrains `type` to a specific value (e.g. `"deployment"`)
2. Adds required and optional properties to `data`
3. Can be further extended by more specific schemas

### Schema Inheritance Chain

```
decorators.json (base: unique-id, type, target, applies-to, data)
  └── deployment.decorator.schema.json (type="deployment", deployment attributes in data)
        └── kubernetes.decorator.schema.json (kubernetes sub-object in data)
```

Other deployment targets (e.g. AWS ECS, Azure Container Apps) follow the same pattern — extend the deployment schema and add their own sub-object inside `data`.

## Examples

### Minimal Base Decorator (Business Context)

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator",
    "unique-id": "trading-system-business-context",
    "type": "business",
    "target": ["trading-system.architecture.json"],
    "applies-to": ["trading-api-service"],
    "data": {
        "cost-center": "CC-4521",
        "business-owner": "Jane Smith",
        "regulatory-classification": "MiFID II"
    }
}
```

### Security Decorator (Multiple Elements)

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator",
    "unique-id": "api-security-context",
    "type": "security",
    "target": ["api-gateway.architecture.json"],
    "applies-to": ["api-gateway", "auth-service", "api-to-auth-connection"],
    "data": {
        "classification": "confidential",
        "authentication-method": "OAuth 2.0 + mTLS",
        "last-pen-test": "2025-11-15",
        "compliance-frameworks": ["SOC 2", "ISO 27001"]
    }
}
```

### Deployment Decorator

```json
{
    "$schema": "https://calm.finos.org/standards/deployment/deployment.decorator.schema.json",
    "unique-id": "aks-cluster-deployment-001",
    "type": "deployment",
    "target": ["aks-architecture.json"],
    "applies-to": ["aks-cluster"],
    "data": {
        "deployment-start-time": "2026-02-12T09:30:00Z",
        "deployment-end-time": "2026-02-12T09:38:00Z",
        "deployment-status": "completed",
        "deployment-environment": "production",
        "deployment-observability": "https://grafana.example.com/d/aks-prod/aks-cluster-overview",
        "deployment-notes": "Routine upgrade to latest platform version"
    }
}
```

### Guide Decorator (Architectural Decision Record)

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator",
    "unique-id": "adr-event-sourcing",
    "type": "guide",
    "target": ["order-management.architecture.json"],
    "applies-to": ["event-store", "order-service"],
    "data": {
        "title": "ADR-007: Use Event Sourcing for Order Management",
        "status": "accepted",
        "decision": "Event sourcing with CQRS for order state management",
        "rationale": "Provides full audit trail required by regulatory compliance",
        "consequences": [
            "Increased storage requirements",
            "Eventual consistency between read and write models"
        ]
    }
}
```

### Observability Decorator

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator",
    "unique-id": "trading-api-observability",
    "type": "observability",
    "target": ["trading-system.architecture.json"],
    "applies-to": ["trading-api-service"],
    "data": {
        "dashboard": "https://grafana.example.com/d/trading-api",
        "alerting-channel": "#trading-api-alerts",
        "health-check": "https://api.example.com/health",
        "sla-target": "99.95%",
        "log-aggregation": "https://kibana.example.com/app/discover#/trading-api"
    }
}
```

### Operational Decorator (Multiple Targets)

Decorators can target multiple architecture files:

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator",
    "unique-id": "platform-on-call-rotation",
    "type": "operational",
    "target": [
        "trading-system.architecture.json",
        "settlement-system.architecture.json"
    ],
    "applies-to": ["api-gateway", "message-broker", "settlement-engine"],
    "data": {
        "on-call-team": "Platform Engineering",
        "escalation-policy": "https://pagerduty.example.com/policies/platform",
        "runbook": "https://wiki.example.com/runbooks/platform-services",
        "support-hours": "24/7"
    }
}
```

## Creating Custom Decorator Type Schemas

To create a reusable decorator type with a defined schema for the `data` field:

1. **Extend the base decorator** using `allOf` with a `$ref` to `decorators.json#/defs/decorator`
2. **Constrain the `type`** using `const` to lock it to your decorator type name
3. **Define `data` properties** with required and optional fields
4. **Set `additionalProperties`** on `data` to `true` if further extension is expected, or `false` to lock it down

### Template for Custom Decorator Schema

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://your-org.example.com/schemas/my-decorator.schema.json",
    "title": "My Custom Decorator Schema",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator"
        },
        {
            "type": "object",
            "properties": {
                "type": { "const": "my-custom-type" },
                "data": {
                    "type": "object",
                    "properties": {
                        "my-required-field": {
                            "type": "string",
                            "description": "Description of this field"
                        },
                        "my-optional-field": {
                            "type": "number",
                            "description": "Description of this field"
                        }
                    },
                    "required": ["my-required-field"],
                    "additionalProperties": false
                }
            },
            "required": ["type", "data"]
        }
    ]
}
```

## File Naming Conventions

- Decorator instances: `<name>.decorator.json` (e.g. `trading-security.decorator.json`)
- Custom type schemas: `<type>.decorator.schema.json`

## Decorator Selection Guide

Use **base decorators** (`decorators.json#/defs/decorator`) when:
- Attaching ad-hoc contextual information (business, security, guides)
- No predefined schema exists for your data shape
- Quick annotations that don't need strict validation

Use **custom decorator schemas** when:
- You need consistent data shapes across multiple decorators
- Validation of decorator data is important for your team
- Sharing decorator standards across an organization

## Validation Rules

1. Every decorator MUST have all five required properties: `unique-id`, `type`, `target`, `applies-to`, `data`
2. `target` must contain at least one file path or URL
3. `applies-to` must contain at least one `unique-id` reference
4. `data` must contain at least one property (`minProperties: 1`)
5. No additional top-level properties are allowed (`additionalProperties: false`)
6. The `unique-id` values in `applies-to` must correspond to elements that exist in the targeted documents
7. For typed decorators using custom schemas, `type` must match the schema constraint

## Decorator vs Other CALM Concepts

| Concept | Purpose | Where It Lives |
|---|---|---|
| **Decorator** | Cross-cutting supplementary data (deployment, security, business context) | Standalone `.decorator.json` file |
| **Metadata** | Lightweight annotations on architecture elements | Inline within architecture file |
| **Controls** | Compliance policies and enforcement mechanisms | Inline or referenced from architecture file |
| **Interfaces** | How components communicate | Defined on nodes within architecture file |

**Use decorators when:**
- The information is managed by a different team than the architecture owners
- The data changes independently of the architecture (e.g. deployment status)
- You need to annotate elements across multiple architecture files
- The supplementary data should not clutter the core architecture definition
