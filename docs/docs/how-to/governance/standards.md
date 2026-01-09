---
id: standards
title: Define Standards
sidebar_position: 3
---

# How to Define Architecture Standards

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Standards are JSON Schema extensions that add organizational requirements to CALM components. They extend the core CALM schema to enforce properties like cost centers, ownership, and compliance tags.

## When to Use This

Use standards when you need to:
- Add required organizational properties (cost center, owner, team)
- Enforce compliance metadata across all architectures
- Define environment classifications
- Require data classification on relationships

## How Standards Work

Standards are **JSON Schema 2020-12** documents that use `allOf` to compose with CALM's core schema:

```
Your Standard = Core CALM Definition + Your Requirements
```

This composition approach means:
- Base CALM requirements are always enforced
- Your additional properties are layered on top
- Validation happens through patterns that reference your standards

## Quick Start

**File:** `standards/company-node-standard.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/company-node-standard.json",
  "title": "Company Node Standard",
  "description": "Requires cost center and owner on all nodes",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": {
          "type": "string",
          "pattern": "^CC-[0-9]{4}$",
          "description": "Cost center code (e.g., CC-1234)"
        },
        "owner": {
          "type": "string",
          "description": "Team or individual responsible"
        }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

## Step-by-Step

### 1. Identify Your Requirements

Common organizational properties:

| Category | Properties |
|----------|-----------|
| **Ownership** | owner, team, costCenter |
| **Environment** | environment (dev/staging/prod) |
| **Compliance** | dataClassification, encrypted |
| **Operations** | tier, oncallChannel |

### 2. Create a Node Standard

Extend the core CALM node with your properties:

**File:** `standards/company-node-standard.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/company-node-standard.json",
  "title": "Company Node Standard",
  "description": "Organizational requirements for all nodes",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": {
          "type": "string",
          "pattern": "^CC-[0-9]{4}$",
          "description": "Cost center code (e.g., CC-1234)"
        },
        "owner": {
          "type": "string",
          "description": "Team or individual responsible"
        },
        "environment": {
          "type": "string",
          "enum": ["development", "staging", "production"],
          "description": "Deployment environment"
        }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

### 3. Create a Relationship Standard

Extend relationships with data classification:

**File:** `standards/company-relationship-standard.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/company-relationship-standard.json",
  "title": "Company Relationship Standard",
  "description": "Security requirements for all relationships",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/relationship" },
    {
      "type": "object",
      "properties": {
        "dataClassification": {
          "type": "string",
          "enum": ["public", "internal", "confidential", "restricted"],
          "description": "Data sensitivity classification"
        },
        "encrypted": {
          "type": "boolean",
          "description": "Whether the connection is encrypted"
        }
      },
      "required": ["dataClassification", "encrypted"]
    }
  ]
}
```

### 4. Create a Pattern That References Standards

Patterns enforce standards by referencing them via `$ref`:

**File:** `patterns/company-base-pattern.json`

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/company-base-pattern.json",
  "title": "Company Base Pattern",
  "description": "Enforces organizational standards on all architectures",
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "https://example.com/standards/company-node-standard.json"
      }
    },
    "relationships": {
      "type": "array",
      "items": {
        "$ref": "https://example.com/standards/company-relationship-standard.json"
      }
    }
  }
}
```

### 5. Create URL Mapping for Local Development

Standards use canonical URLs for global uniqueness. During development, map them to local files:

**File:** `url-mapping.json`

```json
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/standards/company-relationship-standard.json": "standards/company-relationship-standard.json",
  "https://example.com/patterns/company-base-pattern.json": "patterns/company-base-pattern.json"
}
```

### 6. Validate Against Your Standards

Validate architectures through the pattern:

```bash
calm validate \
  --pattern patterns/company-base-pattern.json \
  --architecture my-architecture.json \
  --url-to-local-file-mapping url-mapping.json
```

## JSON Schema Patterns

### Required Properties

```json
{
  "required": ["costCenter", "owner"]
}
```

### String Patterns

```json
{
  "costCenter": {
    "type": "string",
    "pattern": "^CC-[0-9]{4}$"
  }
}
```

### Enumerated Values

```json
{
  "environment": {
    "type": "string",
    "enum": ["development", "staging", "production"]
  }
}
```

### Boolean Fields

```json
{
  "encrypted": {
    "type": "boolean"
  }
}
```

## Best Practices

:::tip Use Canonical URLs
Give standards unique `$id` URLs (like `https://yourcompany.com/standards/...`) for global uniqueness and future publishing.
:::

:::tip Start Simple
Begin with a few essential properties (owner, cost center) and add more as needed.
:::

:::tip Document Properties
Include helpful `description` fields explaining the purpose and expected values.
:::

:::tip Separate Concerns
Create focused standards (node standard, relationship standard) rather than one massive schema.
:::

## Complete Example

Here's a complete working example:

```bash
mkdir -p standards patterns

# Create node standard
cat > standards/company-node-standard.json << 'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/company-node-standard.json",
  "title": "Company Node Standard",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": { "type": "string", "pattern": "^CC-[0-9]{4}$" },
        "owner": { "type": "string" }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
EOF

# Create pattern
cat > patterns/company-base-pattern.json << 'EOF'
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/company-base-pattern.json",
  "title": "Company Base Pattern",
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "https://example.com/standards/company-node-standard.json"
      }
    }
  }
}
EOF

# Create URL mapping
cat > url-mapping.json << 'EOF'
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/patterns/company-base-pattern.json": "patterns/company-base-pattern.json"
}
EOF

# Validate
calm validate \
  --pattern patterns/company-base-pattern.json \
  --architecture my-architecture.json \
  --url-to-local-file-mapping url-mapping.json
```

## Related Resources

- [Core Concepts: Standards](../../core-concepts/standards) - Detailed explanation of standards
- [Multi-Pattern Validation](multi-pattern-validation) - Validate against multiple patterns
- [Create Patterns](patterns) - Define architecture patterns
