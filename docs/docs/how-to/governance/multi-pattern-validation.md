---
id: multi-pattern-validation
title: Multi-Pattern Validation
sidebar_position: 5
---

# How to Validate Against Multiple Patterns

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Validate architectures against multiple patterns for comprehensive governance - separating structural requirements from organizational standards.

## When to Use This

Use multi-pattern validation when you need to:
- Separate structural validation (what components must exist) from standards validation (what properties must be present)
- Apply organizational standards across all architecture types
- Create maintainable governance without duplicating pattern logic
- Integrate comprehensive checks into CI/CD pipelines

## Core Concept

The key insight is that you don't need complex combined patterns. Instead:
- **Structural patterns** define what components must exist (specific nodes and relationships)
- **Standards patterns** define what properties must be present (costCenter, owner, etc.)

Run `calm validate` multiple times with different patterns against the same architecture.

## Quick Start

```bash
# Validate structure - does it have the required components?
calm validate --pattern patterns/web-app-pattern.json --architecture my-app.json

# Validate standards - does it have required organizational properties?
calm validate --pattern patterns/company-base-pattern.json --architecture my-app.json \
  --url-to-local-file-mapping url-mapping.json
```

## Step-by-Step

### 1. Understand the Two Types of Patterns

| Pattern Type | Enforces | Example |
|-------------|----------|---------|
| **Structural** | Specific nodes and relationships | "Must have api-gateway, api-service, database" |
| **Standards** | Required properties on any component | "All nodes must have costCenter and owner" |

**Why separate them?**
- Structural patterns are architecture-specific (web apps differ from data pipelines)
- Standards patterns apply universally (all architectures need ownership info)
- When standards change, update one pattern instead of N structural patterns

### 2. Create Standards (JSON Schema Extensions)

Standards extend CALM's core schemas with organizational requirements using `allOf`:

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
          "enum": ["development", "staging", "production"]
        }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

**File:** `standards/company-relationship-standard.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/standards/company-relationship-standard.json",
  "title": "Company Relationship Standard",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/relationship" },
    {
      "type": "object",
      "properties": {
        "dataClassification": {
          "type": "string",
          "enum": ["public", "internal", "confidential", "restricted"]
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

### 3. Create a Standards Pattern

Create a pattern that enforces your standards on any architecture:

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

Note: This pattern doesn't use `prefixItems`, `minItems`, or `maxItems` - it enforces properties on whatever nodes exist, not which nodes must exist.

### 4. Create URL Mapping for Local Development

Standards use canonical URLs (like `https://example.com/standards/...`) for global uniqueness. During development, map these to local files:

**File:** `url-mapping.json`

```json
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/standards/company-relationship-standard.json": "standards/company-relationship-standard.json",
  "https://example.com/patterns/company-base-pattern.json": "patterns/company-base-pattern.json"
}
```

### 5. Run Multi-Pattern Validation

Run separate validate commands for each concern:

```bash
# Structural validation - does the architecture have required components?
calm validate \
  --pattern patterns/web-app-pattern.json \
  --architecture architectures/my-webapp.json

# Standards validation - do components have required properties?
calm validate \
  --pattern patterns/company-base-pattern.json \
  --architecture architectures/my-webapp.json \
  --url-to-local-file-mapping url-mapping.json
```

Both must pass for complete compliance.

### 6. Integrate with CI/CD

Run multiple validation checks in your pipeline:

**GitHub Actions:**

```yaml
name: Architecture Validation

on:
  push:
    paths: ['architectures/**']
  pull_request:
    paths: ['architectures/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install CALM CLI
        run: npm install -g @finos/calm-cli
      
      - name: Validate Structure
        run: |
          calm validate \
            --pattern patterns/web-app-pattern.json \
            --architecture architectures/my-webapp.json
      
      - name: Validate Standards
        run: |
          calm validate \
            --pattern patterns/company-base-pattern.json \
            --architecture architectures/my-webapp.json \
            --url-to-local-file-mapping url-mapping.json
```

**Validate All Architectures Against Standards:**

```yaml
- name: Validate All Architectures
  run: |
    for arch in architectures/*.json; do
      echo "=== Validating $arch ==="
      
      # Standards check applies to all architectures
      calm validate \
        --pattern patterns/company-base-pattern.json \
        --architecture "$arch" \
        --url-to-local-file-mapping url-mapping.json
    done
```

## Why This Approach Works

| Approach | Patterns Needed | When Standards Change |
|----------|-----------------|----------------------|
| Combined patterns | 1 per architecture type × standards | Update N patterns |
| Multi-pattern validation | 1 structural + 1 standards | Update 1 pattern |

**Example:** 10 architecture types, company adds a new required property:
- **Combined patterns**: Update 10 patterns
- **Multi-pattern validation**: Update 1 standards pattern, applies everywhere

## Best Practices

:::tip Start with Standards
Begin by enforcing organizational standards across all architectures - this provides immediate value without needing architecture-specific patterns.
:::

:::tip Separate Concerns
Keep structural patterns focused on "what must exist" and standards patterns on "what properties must be present."
:::

:::tip CI/CD Integration
Run both structural and standards validation in your pipeline to catch issues before merge.
:::

:::tip Use URL Mapping
During development, use `--url-to-local-file-mapping` to test standards before publishing them to canonical URLs.
:::

## Tips and Troubleshooting

### URL Resolution
If validation fails with "cannot resolve" errors, check your `url-mapping.json` paths are correct relative to where you run the command.

### Incremental Adoption
Start with standards validation only - it applies to any architecture without structural constraints:

```bash
# Works on ANY architecture
calm validate \
  --pattern patterns/company-base-pattern.json \
  --architecture any-architecture.json \
  --url-to-local-file-mapping url-mapping.json
```

### Debugging Validation Failures
Use `--format pretty` for readable output:

```bash
calm validate \
  --pattern patterns/company-base-pattern.json \
  --architecture my-arch.json \
  --url-to-local-file-mapping url-mapping.json \
  --format pretty
```

## Related Resources

- [Create Patterns](patterns) - Define architecture patterns
- [Define Standards](standards) - Create validation rules
- [CLI Reference: validate command](../../working-with-calm/validate)
