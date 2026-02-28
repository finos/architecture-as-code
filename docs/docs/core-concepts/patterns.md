---
id: patterns
title: Patterns
sidebar_position: 9
---

# Patterns in CALM

**Patterns** in CALM define **reusable architecture templates** that can be used to **generate** new architecture scaffolds and **validate** that existing architectures conform to a required structure. This “generate + validate” dual use is a key mechanism for reuse and governance across teams.


## What is a Pattern?

Patterns describe architecture blueprints. Instead of listing a fixed set of components, a pattern prescribes:
* Which nodes (e.g., services, systems, databases) must exist.
* Which relationships connect those nodes.
* What constraints or choices are required for those nodes and relationships.
* Which fields are structural (governed by the pattern) versus which are descriptive (left for implementation).

Because they’re expressed in JSON Schema, patterns use familiar constraints such as:
* const to enforce fixed values that identify required elements,
* `prefixItems` and `minItems`/`maxItems` to require specific arrays of elements, and
* `oneOf` / `anyOf` to offer allowable alternatives (e.g., different database options).

This schema-based definition makes patterns self-validating, versionable, and compatible with existing tooling.

## Key Properties of Patterns

Patterns are primarily about **structural intent**—what must exist and how it must connect:

* **Structural identifiers (fixed)**: commonly constrained with `const` (e.g., node `unique-id`, `node-type`, relationship `unique-id`, sometimes `name`).
* **User-authored fields (open but required)**: fields like `description` are typically left as `"type": "string"` (and may be required), so generated architectures include placeholders that users should replace.
* **Required arrays of components**: `prefixItems` + `minItems`/`maxItems` are commonly used to require a specific set/count of nodes and relationships. 
* **Choices**: `anyOf`/`oneOf` can model “pick one of these components/topologies” patterns.

## Example pattern template

Below is a small **3-tier web application** pattern template (frontend → API → database) that enforces **exactly 3 nodes** and **exactly 2 relationships**, while leaving `description` user-fillable.

```json
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "$id": "https://example.com/patterns/web-app-pattern.json",
  "title": "Web Application Pattern",
  "description": "A reusable 3-tier web application pattern (frontend, API service, database).",
  "type": "object",
  "properties": {
    "nodes": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "prefixItems": [
        {
          "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
          "type": "object",
          "properties": {
            "unique-id": { "const": "web-frontend" },
            "node-type": { "const": "webclient" },
            "name": { "const": "Web Frontend" },
            "description": { "type": "string" }
          },
          "required": ["description"]
        },
        {
          "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
          "type": "object",
          "properties": {
            "unique-id": { "const": "api-service" },
            "node-type": { "const": "service" },
            "name": { "const": "API Service" },
            "description": { "type": "string" }
          },
          "required": ["description"]
        },
        {
          "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
          "type": "object",
          "properties": {
            "unique-id": { "const": "app-database" },
            "node-type": { "const": "database" },
            "name": { "const": "Application Database" },
            "description": { "type": "string" }
          },
          "required": ["description"]
        }
      ]
    },
    "relationships": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "prefixItems": [
        {
          "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
          "type": "object",
          "properties": {
            "unique-id": { "const": "frontend-to-api" },
            "description": { "type": "string" },
            "protocol": { "const": "HTTPS" },
            "relationship-type": {
              "const": {
                "connects": {
                  "source": { "node": "web-frontend" },
                  "destination": { "node": "api-service" }
                }
              }
            }
          },
          "required": ["description"]
        },
        {
          "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
          "type": "object",
          "properties": {
            "unique-id": { "const": "api-to-database" },
            "description": { "type": "string" },
            "protocol": { "const": "JDBC" },
            "relationship-type": {
              "const": {
                "connects": {
                  "source": { "node": "api-service" },
                  "destination": { "node": "app-database" }
                }
              }
            }
          },
          "required": ["description"]
        }
      ]
    }
  },
  "required": ["nodes", "relationships"]
}
```

This template follows the same techniques shown in the CALM Patterns guidance: use `const` for structural identity and `prefixItems`/`minItems`/`maxItems` to require exact architecture shape, while keeping human-authored fields open but required.

## Using Patterns effectively

### Generate an architecture scaffold

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json
```

This creates a concrete architecture that conforms to the pattern’s constraints.

### Validate an existing architecture against the pattern

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/existing-webapp.json
```

This checks whether the target architecture has the required nodes/relationships and respects the pattern’s constraints.

### Watch for placeholders

User-fillable properties are emitted into the generated architecture using placeholder values based on their declared data type:

* String properties use a bracketed token format, e.g., [[ DESCRIPTION ]]
* Integer properties use a sentinel numeric value, e.g., -1

These placeholders act as markers and must be replaced with appropriate architecture-specific values before use.