---
id: decorators
title: Decorators
sidebar_position: 7
---

# Decorators

:::info Schema Version
Decorators were introduced in **CALM schema version 1.2**. To use decorators, reference the following schema in your decorator document:

```json
"$schema": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator"
```
:::

Decorators attach supplementary information to nodes, relationships, and other architecture elements without modifying the core architecture definition. They enable cross-cutting concerns — such as deployment tracking, security context, business metadata, and operational information — to be managed separately from the architecture itself.

## What is a Decorator?

A decorator is a standalone object that references one or more architecture elements via their `unique-id` and attaches typed data to them. This keeps the architecture file clean and focused while allowing rich contextual information to be layered on top.

### Key Properties

- **unique-id**: A unique identifier for this decorator instance
- **type**: A string identifying the category of decorator (e.g. `guide`, `business`, `threat-model`, `deployment`). This is a free-form string, not an enum — any value is valid
- **target**: An array of file paths or URLs referencing the CALM documents (patterns, architectures, or controls) this decorator targets
- **applies-to**: An array of `unique-id` values referencing the architecture elements within the targeted documents this decorator relates to
- **data**: A JSON object containing the decorator's payload, whose shape is determined by the decorator type

### Base Decorator Schema

The base decorator schema defines the top-level structure that all decorators must follow:

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
                    "type": "string"
                },
                "type": {
                    "type": "string"
                },
                "target": {
                    "type": "array",
                    "items": { "type": "string" },
                    "minItems": 1
                },
                "applies-to": {
                    "type": "array",
                    "items": { "type": "string" },
                    "minItems": 1
                },
                "data": {
                    "type": "object",
                    "minProperties": 1
                }
            },
            "required": ["unique-id", "type", "target", "applies-to", "data"],
            "additionalProperties": false
        }
    }
}
```

The top-level properties are locked down via `additionalProperties: false`, while the `data` object is intentionally open — its shape is defined by decorator-type-specific schemas.

## Extending Decorators with Schemas

Decorator types can define their own schema for the `data` field by inheriting from the base decorator using `allOf`. Each extension schema:

- Constrains `type` to a specific value (e.g. `"deployment"`)
- Adds required and optional properties to `data`
- Can be further extended by more specific schemas

This creates a composable schema inheritance chain where each layer owns its own namespace within `data`.

## Example: Deployment Decorators

To illustrate how the base decorator schema can be extended, consider deployment decorators that track when and how architecture components are deployed, including status, timing, and observability links.

### Example: Deployment Decorator Schema

A deployment decorator schema could constrain `type` to `"deployment"` and define deployment-specific attributes in `data`:

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/release/1.2/meta/deployment.decorator.schema.json",
    "title": "CALM Deployment Decorator Schema",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator"
        },
        {
            "type": "object",
            "properties": {
                "type": { "const": "deployment" },
                "data": {
                    "type": "object",
                    "properties": {
                        "deployment-start-time": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "deployment-status": {
                            "type": "string",
                            "enum": [
                                "in-progress", "failed", "completed",
                                "rolled-back", "pending"
                            ]
                        },
                        "deployment-observability": {
                            "type": "string",
                            "format": "uri"
                        }
                    },
                    "required": ["deployment-start-time", "deployment-status"],
                    "additionalProperties": true
                }
            },
            "required": ["type", "data"]
        }
    ]
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| `deployment-start-time` | string (date-time) | Yes | ISO 8601 timestamp of when the deployment started |
| `deployment-status` | string (enum) | Yes | Current status: `in-progress`, `failed`, `completed`, `rolled-back`, `pending` |
| `deployment-observability` | string (uri) | No | Link to logs, metrics, or observability dashboards |

The `data` object uses `additionalProperties: true` so that extension schemas can add domain-specific sub-objects.

## Example: Kubernetes Deployment Decorators

Taking the extension pattern further, a Kubernetes-specific decorator could add a `kubernetes` sub-object inside `data` with cluster-specific attributes. The Kubernetes properties are nested to avoid conflicts with the base deployment properties and to allow each schema layer to lock down its own scope.

### Kubernetes Decorator Schema

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/release/1.2/meta/kubernetes.decorator.schema.json",
    "title": "CALM Kubernetes Deployment Decorator Schema",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/release/1.2/meta/deployment.decorator.schema.json"
        },
        {
            "type": "object",
            "properties": {
                "data": {
                    "type": "object",
                    "properties": {
                        "kubernetes": {
                            "type": "object",
                            "properties": {
                                "helm-chart": {
                                    "type": "string",
                                    "pattern": "^[a-z0-9-]+:[0-9]+\\.[0-9]+\\.[0-9]+$"
                                },
                                "cluster": { "type": "string" },
                                "namespace": { "type": "string" }
                            },
                            "required": ["helm-chart", "cluster"],
                            "additionalProperties": false
                        }
                    },
                    "required": ["kubernetes"]
                }
            }
        }
    ]
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| `kubernetes.helm-chart` | string (pattern) | Yes | Helm chart name and semver version (e.g. `my-app:1.2.3`) |
| `kubernetes.cluster` | string | Yes | Kubernetes cluster identifier |
| `kubernetes.namespace` | string | No | Kubernetes namespace for the deployment |

## Schema Inheritance

The examples above demonstrate how the schema inheritance chain allows each layer to define its own properties while composing cleanly:

```
decorators.json (base: unique-id, type, applies-to, data)
  └── deployment decorator (type="deployment", deployment attributes in data)
        └── kubernetes decorator (kubernetes sub-object in data)
```

Other deployment targets (e.g. AWS ECS, Azure Container Apps) could follow the same pattern — extend a deployment decorator schema and add their own sub-object inside `data`.

## Worked Example

Given a simple architecture with a single AKS cluster node:

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        {
            "unique-id": "aks-cluster",
            "node-type": "system",
            "name": "Azure Kubernetes Service Cluster",
            "description": "A Kubernetes cluster running on Azure AKS"
        }
    ],
    "relationships": []
}
```

A Kubernetes deployment decorator for this node could look like:

```json
{
    "$schema": "https://calm.finos.org/release/1.2/meta/kubernetes.decorator.schema.json",
    "unique-id": "aks-cluster-deployment-001",
    "type": "deployment",
    "target": ["aks-architecture.json"],
    "applies-to": ["aks-cluster"],
    "data": {
        "deployment-start-time": "2026-02-12T09:30:00Z",
        "deployment-status": "completed",
        "deployment-observability": "https://grafana.example.com/d/aks-prod/aks-cluster-overview",
        "kubernetes": {
            "helm-chart": "aks-platform:3.2.1",
            "cluster": "prod-uksouth-aks-01",
            "namespace": "trading-system"
        }
    }
}
```

This decorator:
- Targets the architecture document `aks-architecture.json` via `target`
- References the `aks-cluster` node within that architecture via `applies-to`
- Satisfies the base decorator schema (has `unique-id`, `type`, `target`, `applies-to`, `data`)
- Satisfies the deployment schema (`deployment-start-time`, `deployment-status` are present)
- Satisfies the Kubernetes schema (`helm-chart`, `cluster` are present inside the `kubernetes` sub-object)
