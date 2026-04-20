---
id: 19-enforcing-standards
title: "Enforcing Standards with Patterns"
sidebar_position: 13
---

# Enforcing Standards with Patterns

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Learn how Patterns can reference your organizational Standards, ensuring generated and validated architectures comply with company requirements. You'll also learn how to use URL mapping for local development.

## Learning Objectives

By the end of this tutorial, you will:
- Understand the local development challenge with canonical Standard URLs
- Create a `url-mapping.json` file to resolve canonical URLs to local files
- Create a Company Base Pattern that references both Standards
- Validate compliant and non-compliant architectures
- Understand the difference between structural Patterns and standards-enforcing Patterns

## Prerequisites

Complete [Organizational Standards](./18-standards) first. You will need your `standards/company-node-standard.json` and `standards/company-relationship-standard.json` from the [Organizational Standards](./18-standards) lesson.

## Step-by-Step Guide

### 1. Understand the Gap

Your `web-app-pattern` from the [Introduction to CALM Patterns](./17-patterns) lesson enforces structure:
- ✅ Must have `"api-gateway"`, `"api-service"`, `"app-database"` nodes
- ✅ Must have specific relationships

But it doesn't enforce your Standards:
- ❌ Doesn't require `costCenter` on nodes
- ❌ Doesn't require `owner` on nodes
- ❌ Doesn't require `dataClassification` on relationships

**The Goal:** Create a pattern that enforces Standards without constraining specific structure.

### 2. Understand the Local Development Challenge

Your Standards have canonical `$id` URLs like:

```json
{
  "$id": "https://example.com/standards/company-node-standard.json"
}
```

This is best practice — gives each Standard a globally unique identifier that works when published. However, during development these URLs don't resolve to anything yet!

**The Solution:** URL-to-local-file mapping. The CALM CLI can map these URLs to your local files during development, so you can validate before publishing.

### 3. Create the URL Mapping File

**File:** `url-mapping.json`

```json
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/standards/company-relationship-standard.json": "standards/company-relationship-standard.json",
  "https://example.com/patterns/company-base-pattern.json": "patterns/company-base-pattern.json"
}
```

This tells the CLI: *"When you see `https://example.com/standards/company-node-standard.json`, load it from `standards/company-node-standard.json` instead."*

### 4. Understand How Patterns Reference Standards

Patterns use `$ref` to reference your Standards by their canonical URL:

```json
{
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "https://example.com/standards/company-node-standard.json"
      }
    }
  }
}
```

This says: *"Every node must comply with company-node-standard.json."*

Note the use of `items` (applies to every item in the array) rather than `prefixItems` (applies to specific positional items). This makes the pattern enforce properties on all nodes without constraining which nodes must exist.

### 5. Create the Company Base Pattern

**Prompt:**
```text
Create a CALM pattern at patterns/company-base-pattern.json that enforces our company Standards on all architectures.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.2/meta/calm.json)
2. Have a unique $id (https://example.com/patterns/company-base-pattern.json)
3. Have title "Company Base Pattern" and description explaining it enforces organizational standards
4. Reference the node standard using its $id URL: https://example.com/standards/company-node-standard.json
5. Reference the relationship standard using its $id URL: https://example.com/standards/company-relationship-standard.json

Do NOT use prefixItems, minItems, or maxItems - this pattern should not constrain what nodes exist, only that whatever nodes exist must follow our Standards.
```

### 6. Test with a Non-Compliant Architecture

Your existing e-commerce architecture probably doesn't have Standard properties yet. Use the `-u` flag to provide the URL mapping:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json -u url-mapping.json
```

Should fail ❌ — nodes are missing `costCenter`, `owner`, etc.

> **Note:** The `-u url-mapping.json` flag tells the CLI to use your local files when resolving the `https://example.com/...` URLs.

### 7. Test with a Compliant Architecture

Create a minimal architecture that complies with Standards:

**Prompt:**
```text
Create a minimal test architecture at architectures/compliant-test.json with:

1. One service node "test-service" with all Standard properties:
   - unique-id, node-type, name, description (base CALM)
   - costCenter: "CC-1234"
   - owner: "test-team"
   - environment: "development"

2. One database node "test-database" with all Standard properties:
   - costCenter: "CC-1235"
   - owner: "test-team"
   - environment: "development"

3. One relationship connecting them with Standard properties:
   - dataClassification: "internal"
   - encrypted: true
```

### 8. Validate the Compliant Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json -u url-mapping.json
```

Should pass! ✅

### 9. Clean Up Test File

```bash
rm architectures/compliant-test.json
```

Now that you've completed this lesson, use git to baseline the changes you've made. A committed snapshot ensures you can always return to this point.

## Key Concepts

### `items` vs `prefixItems`

| Keyword | Applies to | Use for |
|---------|-----------|---------|
| `items` | Every item in the array | Standards (apply to all nodes/relationships) |
| `prefixItems` | Specific positional items | Structure (require specific nodes by position) |

The Company Base Pattern uses `items` so it enforces Standards on every node regardless of type or position — without constraining what nodes must exist.

### URL Mapping

```
Local Development
──────────────────────────────────────────────────────────
Pattern references:
"$ref": "https://example.com/standards/company-node-standard.json"
                          │
                          ▼ (url-mapping.json)
standards/company-node-standard.json  ←  Local file

After Publishing
──────────────────────────────────────────────────────────
Pattern references the same URL, which now resolves directly.
No URL mapping needed.
```

### The Pattern Hierarchy

```
Standards (define required properties)
├── company-node-standard.json
└── company-relationship-standard.json
        │
        ▼
Patterns (enforce requirements)
├── company-base-pattern.json  (enforces Standards on any architecture)
└── web-app-pattern.json       (enforces specific 3-tier structure)
        │
        ▼
Architectures (actual systems)
├── ecommerce-platform.json
└── generated-webapp.json
```

### Two Pattern Types

| Pattern | Enforces | Use When |
|---------|----------|----------|
| `web-app-pattern` | Specific structure (3 nodes, 2 relationships) | Building a 3-tier web app |
| `company-base-pattern` | Standard properties only | Any architecture type |

## Resources

- [JSON Schema $ref](https://json-schema.org/understanding-json-schema/structuring#dollarref)
- [CALM Pattern Documentation](../../core-concepts/patterns.md)

## Next Steps

In the [next tutorial](./20-multi-pattern-validation), you'll apply your Standards to the generated web application and learn how multi-pattern validation provides complete, layered governance!
