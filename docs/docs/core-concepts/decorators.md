---
id: decorators
title: Decorators
sidebar_position: 8
---

# Decorators

:::info Schema Version
Decorators were introduced in **CALM schema version 1.2**. Version 1.3 adds the optional `$schema` and `target-type` properties. To use decorators, reference the following schema in your decorator document:

```json
"$schema": "https://calm.finos.org/release/1.3/meta/decorators.json#/defs/decorator"
```

In 1.2, a decorator that has `$schema` fails validation.
:::

Decorators attach supplementary information to nodes, relationships, and other architecture elements without modifying the core architecture definition. They enable cross-cutting concerns — such as deployment tracking, security context, business metadata, and operational information — to be managed separately from the architecture itself.

## What is a Decorator?

A decorator is a standalone object that references one or more architecture elements via their `unique-id` and attaches typed data to them. This keeps the architecture file clean and focused while allowing rich contextual information to be layered on top.

### Key Properties

- **$schema** (optional): The URI of the schema this decorator conforms to, for example a decorator standard
- **unique-id**: A unique identifier for this decorator instance
- **type**: A string identifying the category of decorator (e.g. `guide`, `business`, `threat-model`, `deployment`). This is a free-form string, not an enum — any value is valid
- **target-type** (optional): An array of the types of CALM document this decorator can target. The only type is `architecture`, because `applies-to` holds the unique-ids of architecture elements
- **target**: An array of file paths or URLs referencing the CALM architectures this decorator targets
- **applies-to**: An array of `unique-id` values referencing the architecture elements within the targeted documents this decorator relates to
- **data**: A JSON object containing the decorator's payload, whose shape is determined by the decorator type

### Base Decorator Schema

The base decorator schema defines the top-level structure that all decorators must follow:

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/release/1.3/meta/decorators.json",
    "title": "Common Architecture Language Model Decorators",
    "defs": {
        "decorator": {
            "type": "object",
            "properties": {
                "$schema": {
                    "type": "string"
                },
                "unique-id": {
                    "type": "string"
                },
                "type": {
                    "type": "string"
                },
                "target-type": {
                    "type": "array",
                    "items": { "type": "string", "enum": ["architecture"] },
                    "minItems": 1,
                    "uniqueItems": true
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

## Example: Deployment Decorator Standards

The deployment decorator standards show how the base decorator schema is extended. FINOS releases them from [finos/calm-schema](https://github.com/finos/calm-schema/tree/standard-deployment-v1.0/standards/deployment). They record when and how architecture components are deployed: status, timing, and a link to logs or dashboards.

### Deployment Decorator Standard

The deployment standard constrains `type` to `"deployment"`, requires `target-type`, and defines deployment attributes in `data`:

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json",
    "title": "CALM Deployment Decorator Standard",
    "description": "Deployment decorator standard for tracking deployment information across various platforms and environments. Extends the base CALM decorator standard to add deployment-specific attributes.",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/release/1.3/meta/decorators.json#/defs/decorator"
        },
        {
            "type": "object",
            "properties": {
                "type": {
                    "const": "deployment",
                    "description": "Must be 'deployment' for deployment decorators"
                },
                "target-type": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "architecture"
                        ]
                    },
                    "description": "Type of resources this decorator can target. Deployment decorators can only target architecture files."
                },
                "data": {
                    "type": "object",
                    "properties": {
                        "start-time": {
                            "type": "string",
                            "format": "date-time",
                            "description": "ISO 8601 timestamp indicating when the deployment started"
                        },
                        "end-time": {
                            "type": "string",
                            "format": "date-time",
                            "description": "ISO 8601 timestamp indicating when the deployment completed or failed"
                        },
                        "status": {
                            "type": "string",
                            "enum": [
                                "pending",
                                "in-progress",
                                "completed",
                                "failed",
                                "rolled-back"
                            ],
                            "description": "Current status of the deployment"
                        },
                        "deployment-details": {
                            "type": "string",
                            "format": "uri",
                            "description": "URI linking to deployment logs, metrics, dashboards, or observability platform"
                        },
                        "notes": {
                            "type": "string",
                            "description": "Free-form notes or comments about the deployment"
                        }
                    },
                    "required": [
                        "start-time",
                        "status"
                    ],
                    "additionalProperties": true
                }
            },
            "required": [
                "type",
                "target-type",
                "data"
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| `start-time` | string (date-time) | Yes | ISO 8601 timestamp of when the deployment started |
| `end-time` | string (date-time) | No | ISO 8601 timestamp of when the deployment completed or failed |
| `status` | string (enum) | Yes | Current status: `pending`, `in-progress`, `completed`, `failed`, `rolled-back` |
| `deployment-details` | string (uri) | No | Link to logs, metrics, or observability dashboards |
| `notes` | string | No | Free-form notes about the deployment |

The `data` object uses `additionalProperties: true` so that extension schemas can add domain-specific sub-objects.

### Kubernetes Decorator Standard

The Kubernetes standard extends the deployment standard with a `kubernetes` sub-object inside `data`. The Kubernetes properties are nested to avoid conflicts with the deployment properties and to allow each schema layer to lock down its own scope.

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/standards/deployment/1.0/kubernetes.decorator.standard.json",
    "title": "CALM Kubernetes Deployment Decorator Standard",
    "description": "Kubernetes-specific deployment decorator standard. Extends the base deployment decorator with Kubernetes cluster, namespace, and Helm chart information.",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json"
        },
        {
            "type": "object",
            "properties": {
                "data": {
                    "type": "object",
                    "properties": {
                        "kubernetes": {
                            "type": "object",
                            "description": "Kubernetes-specific deployment information",
                            "properties": {
                                "helm-chart-version": {
                                    "type": "string",
                                    "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
                                    "description": "Helm chart semantic version in format 'major.minor.patch'"
                                },
                                "cluster": {
                                    "type": "string",
                                    "description": "Kubernetes cluster identifier or name"
                                },
                                "namespace": {
                                    "type": "string",
                                    "description": "Kubernetes namespace where the resource is deployed",
                                    "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                                }
                            },
                            "required": [
                                "cluster",
                                "namespace"
                            ],
                            "additionalProperties": false
                        }
                    },
                    "required": [
                        "kubernetes"
                    ]
                }
            }
        }
    ]
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| `kubernetes.cluster` | string | Yes | Kubernetes cluster identifier or name |
| `kubernetes.namespace` | string (pattern) | Yes | Kubernetes namespace of the deployment |
| `kubernetes.helm-chart-version` | string (pattern) | No | Helm chart semantic version (e.g. `2.4.1`) |

## Schema Inheritance

The standards above show how the schema inheritance chain allows each layer to define its own properties while composing cleanly:

```
decorators.json (base: unique-id, type, target, applies-to, data; optional $schema, target-type)
  └── deployment.decorator.standard.json (type="deployment", target-type required, deployment attributes in data)
        └── kubernetes.decorator.standard.json (kubernetes sub-object in data)
```

Other deployment targets (e.g. AWS ECS, Azure Container Apps) could follow the same pattern — extend the deployment decorator standard and add their own sub-object inside `data`.

## Worked Example

Given a simple architecture with a single AKS cluster node:

```json
{
    "$schema": "https://calm.finos.org/release/1.3/meta/calm.json",
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
    "$schema": "https://calm.finos.org/standards/deployment/1.0/kubernetes.decorator.standard.json",
    "unique-id": "aks-cluster-deployment-001",
    "type": "deployment",
    "target-type": ["architecture"],
    "target": ["aks-architecture.json"],
    "applies-to": ["aks-cluster"],
    "data": {
        "start-time": "2026-02-12T09:30:00Z",
        "end-time": "2026-02-12T09:42:00Z",
        "status": "completed",
        "deployment-details": "https://grafana.example.com/d/aks-prod/aks-cluster-overview",
        "kubernetes": {
            "cluster": "prod-uksouth-aks-01",
            "namespace": "trading-system",
            "helm-chart-version": "3.2.1"
        }
    }
}
```

This decorator:
- Targets the architecture document `aks-architecture.json` via `target`
- References the `aks-cluster` node within that architecture via `applies-to`
- Satisfies the base decorator schema (has `unique-id`, `type`, `target`, `applies-to`, `data`)
- Satisfies the deployment standard (`target-type`, `start-time` and `status` are present)
- Satisfies the Kubernetes standard (`cluster` and `namespace` are present inside the `kubernetes` sub-object)

## Control Evaluation Decorators

The [control evaluation decorator Standard](https://github.com/finos/calm-schema/tree/standard-control-evaluation-v1.0/standards/control-evaluation) extends the base decorator to record the result of evaluating one control from an architecture, for example by a policy engine that checks a change before it merges. It constrains `type` to `"control-evaluation"`. Its `data` names the control, gives a `status` of `met`, `not-met` or `not-applicable`, and, for `not-met`, lists the `findings` that say why. CALM Hub draws these results on the architecture diagram: see [Control Evaluations](../working-with-calm/calm-hub.md#control-evaluations).
