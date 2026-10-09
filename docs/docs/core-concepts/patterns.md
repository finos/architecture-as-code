---
id: patterns
title: Patterns
sidebar_position: 10
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
* `prefixItems` and `minItems`/`maxItems` to require specific arrays of elements,
* `oneOf` / `anyOf` to offer allowable alternatives (e.g., different database options), and
* `items` to list candidates an architecture may add, none of them required.

This schema-based definition makes patterns self-validating, versionable, and compatible with existing tooling.

## Key Properties of Patterns

Patterns are primarily about **structural intent**—what must exist and how it must connect:

* **Structural identifiers (fixed)**: commonly constrained with `const` (e.g., node `unique-id`, `node-type`, relationship `unique-id`, sometimes `name`).
* **User-authored fields (open but required)**: fields like `description` are typically left as `"type": "string"` (and may be required), so generated architectures include placeholders that users should replace.
* **Required arrays of components**: `prefixItems` + `minItems`/`maxItems` are commonly used to require a specific set/count of nodes and relationships. 
* **Choices**: `anyOf`/`oneOf` can model “pick one of these components/topologies” patterns.
* **Optional candidates**: `items` holding `anyOf`/`oneOf` lists elements an architecture *may* add. See [Choices and optional elements](#choices-and-optional-elements).

## Example pattern template

Below is a small **3-tier web application** pattern template (frontend → API → database). It requires **3 nodes** and **2 relationships**, lets an architecture add an optional **cache** or **message queue**, and leaves `description` user-fillable.

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
      "maxItems": 5,
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
      ],
      "items": {
        "anyOf": [
          {
            "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
            "type": "object",
            "properties": {
              "unique-id": { "const": "app-cache" },
              "node-type": { "const": "database" },
              "name": { "const": "Application Cache" },
              "description": { "type": "string" }
            },
            "required": ["description"]
          },
          {
            "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node",
            "type": "object",
            "properties": {
              "unique-id": { "const": "message-queue" },
              "node-type": { "const": "service" },
              "name": { "const": "Message Queue" },
              "description": { "type": "string" }
            },
            "required": ["description"]
          }
        ]
      }
    },
    "relationships": {
      "type": "array",
      "minItems": 2,
      "maxItems": 4,
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
      ],
      "items": {
        "anyOf": [
          {
            "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
            "type": "object",
            "properties": {
              "unique-id": { "const": "api-to-cache" },
              "description": { "type": "string" },
              "protocol": { "const": "TCP" },
              "relationship-type": {
                "const": {
                  "connects": {
                    "source": { "node": "api-service" },
                    "destination": { "node": "app-cache" }
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
              "unique-id": { "const": "api-to-queue" },
              "description": { "type": "string" },
              "protocol": { "const": "AMQP" },
              "relationship-type": {
                "const": {
                  "connects": {
                    "source": { "node": "api-service" },
                    "destination": { "node": "message-queue" }
                  }
                }
              }
            },
            "required": ["description"]
          }
        ]
      }
    }
  },
  "required": ["nodes", "relationships"]
}
```

This template uses `const` for structural identity and keeps human-authored fields open but required. Four keywords shape each array:

* **`prefixItems`**: one entry for each position, in order. The first node must match the first entry, the second node the second entry, and so on. An architecture that lists `api-service` before `web-frontend` fails.
* **`minItems`**: makes the entries required. `prefixItems` checks only the positions that are present, so without `minItems` an architecture could omit `app-database`, the last entry. With `minItems` set to 3, all three nodes must be present.
* **`items`**: the candidates. Each element after the last `prefixItems` entry must match one of them. An architecture passes with any number of them, or none. An added node or relationship that matches no candidate fails. Offer the relationship of each candidate node too. Without one, validation warns that the candidate is not referenced by any relationship.
* **`maxItems`**: the limit, which counts the candidates. Here it allows both.

## Choices and optional elements

A pattern can express "optional" in three ways:

| To express | Use | Example |
|---|---|---|
| A required position with alternatives | `oneOf` or `anyOf` in a `prefixItems` entry | The database is PostgreSQL or MySQL |
| Optional extras, zero or more | `items` holding `anyOf` or `oneOf` | The cache and the message queue above |
| A decision that `calm generate` asks about | An `options` relationship | See below |

A `prefixItems` entry is one position. It holds exactly one element, which must match one of its alternatives. An architecture can omit an entry only when it is the last one and `minItems` does not count it. If it omits an earlier entry, each element after it takes the position before, and no longer matches. For elements that are truly optional, use `items`.

### The `options` relationship

`calm generate` asks about a decision only where the pattern declares one, as an `options` relationship. Each choice names nodes and relationships that the pattern declares. They can be the alternatives of a `prefixItems` entry, or the candidates in `items`. Without a choice that names them, `calm generate` builds none of the `items` candidates.

**A decision is written as a relationship.** CALM has five relationship types: `connects`, `interacts`, `deployed-in`, `composed-of` and `options`. A relationship of type `options` connects nothing. It holds a decision. It sits in the `relationships` array like any other relationship.

Each choice has a `description`, and lists the `nodes` and `relationships` that it adds. With `anyOf`, the user can select any number of the choices. With `oneOf`, the user selects exactly one.

For example, to offer the cache and the message queue, add this relationship to the template's `relationships.prefixItems`, and raise its `minItems` to 3 and its `maxItems` to 5. Keep `"type": "object"` on `relationship-type`. Without it, `calm generate` omits the decision from the architecture:

```json
{
  "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship",
  "type": "object",
  "properties": {
    "unique-id": { "const": "optional-components" },
    "description": { "const": "Optional components" },
    "relationship-type": {
      "type": "object",
      "properties": {
        "options": {
          "type": "array",
          "maxItems": 2,
          "prefixItems": [
            {
              "anyOf": [
                {
                  "properties": {
                    "description": { "const": "Add a cache" },
                    "nodes": { "const": ["app-cache"] },
                    "relationships": { "const": ["api-to-cache"] }
                  }
                },
                {
                  "properties": {
                    "description": { "const": "Add a message queue" },
                    "nodes": { "const": ["message-queue"] },
                    "relationships": { "const": ["api-to-queue"] }
                  }
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

`calm generate` then asks which components to add. "Add a cache" builds `app-cache` and `api-to-cache`. A choice of none builds neither. Because the choice uses `anyOf`, it can select both. See [Pattern Options](../working-with-calm/cli.md#pattern-options) to give the choices on the command line.

**The architecture keeps the decision.** The generated architecture contains the `optional-components` relationship too, with the selected choices in its `options` list. After "Add a cache":

```json
{
  "unique-id": "optional-components",
  "description": "Optional components",
  "relationship-type": {
    "options": [
      {
        "description": "Add a cache",
        "nodes": ["app-cache"],
        "relationships": ["api-to-cache"]
      }
    ]
  }
}
```

`calm validate` uses this record when it checks the architecture against the pattern. A choice of none leaves the list empty.

A choice names the alternatives of a `prefixItems` entry in the same way. Take an entry with a `oneOf` of `postgres` and `mysql`, and a `oneOf` decision with a choice for each. "Use MySQL" builds `mysql`, and does not build `postgres`.

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