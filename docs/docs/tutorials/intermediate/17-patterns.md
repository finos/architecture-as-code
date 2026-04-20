---
id: 17-patterns
title: "Introduction to CALM Patterns"
sidebar_position: 11
---

# Introduction to CALM Patterns

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Learn how CALM Patterns enable you to define reusable architecture templates that can both generate new architectures and validate existing ones.

## Learning Objectives

By the end of this tutorial, you will:
- Understand the dual superpower of Patterns: generation and validation
- Know how Patterns use JSON Schema keywords (`const`, `prefixItems`, `minItems`/`maxItems`, `$ref`)
- Create a Pattern for a 3-tier web application
- Generate a new architecture from your Pattern
- Validate both a passing and a failing architecture against the Pattern
- Understand placeholder warnings in generated architectures

## Prerequisites

Complete [Generate Operations Documentation](./16-ops-docs) first.

## Step-by-Step Guide

### 1. Understand What Patterns Are

**The Problem Patterns Solve:**
- Teams keep building similar architectures from scratch
- No easy way to enforce "all web apps must have these components"
- Inconsistent structures across projects

**The Solution:**
CALM Patterns pre-define the required structure of an architecture. They specify which nodes must exist, what relationships must connect them, and what properties they must have.

### 2. Understand the Dual Superpower

**One Pattern = Two Powers:**

**Power 1 — Generation:**
```bash
calm generate -p my-pattern.json -o new-architecture.json
```

**Power 2 — Validation:**
```bash
calm validate -p my-pattern.json -a existing-architecture.json
```

### 3. Understand How Patterns Work

Patterns use JSON Schema keywords to define requirements:

| Keyword | Purpose | Example |
|---------|---------|---------|
| `const` | Requires an exact value | `"unique-id": { "const": "api-gateway" }` |
| `prefixItems` | Defines exact ordered items in an array | First node must be X, second must be Y |
| `minItems` / `maxItems` | Enforces array length | Exactly 3 nodes |
| `$ref` | References other schemas | Point to a node or Standards definition |

**Example: requiring a specific node**

```json
{
  "nodes": {
    "type": "array",
    "prefixItems": [
      {
        "properties": {
          "unique-id": { "const": "api-gateway" },
          "node-type": { "const": "service" },
          "name": { "const": "API Gateway" }
        }
      }
    ],
    "minItems": 1
  }
}
```

### 4. Create Your First Pattern

**Prompt:**
```text
Create a CALM pattern at patterns/web-app-pattern.json for a 3-tier web application.

The pattern should:
1. Have a unique $id (https://example.com/patterns/web-app-pattern.json)
2. Have title "Web Application Pattern" and a description
3. Require exactly 3 nodes using prefixItems:
   - "web-frontend" (node-type: webclient, name: "Web Frontend")
   - "api-service" (node-type: service, name: "API Service")
   - "app-database" (node-type: database, name: "Application Database")
4. Require exactly 2 relationships:
   - "frontend-to-api": connects web-frontend to api-service
   - "api-to-database": connects api-service to app-database

Use const for unique-id, node-type, and name properties.
Set minItems and maxItems to enforce exact counts.
```

### 5. Test Generation

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json
```

Open `architectures/generated-webapp.json` and verify:
- ✅ Has exactly 3 nodes with the correct IDs, types, and names
- ✅ Has exactly 2 relationships connecting them

### 6. Visualize the Generated Architecture

1. Open `architectures/generated-webapp.json` in VSCode
2. Open preview (`Ctrl+Shift+C` / `Cmd+Shift+C`)
3. See the 3-tier architecture visualized

### 7. Test Validation — Passing Case with Warnings

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass ✅ but show warnings about placeholder strings:

```json
{
  "spectralSchemaValidationOutputs": [
    {
      "code": "architecture-has-no-placeholder-properties-string",
      "severity": "warning",
      "message": "String placeholder detected in architecture.",
      "path": "/nodes/0/description"
    }
  ],
  "hasErrors": false,
  "hasWarnings": true
}
```

String placeholders look like `"[[ DESCRIPTION ]]"`. Numeric placeholders use `-1`. These warn you that the generated architecture needs to be filled in — they are not errors.

### 8. Test Validation — Failing Case

Create a broken architecture to see validation fail:

1. Copy `architectures/generated-webapp.json` to `architectures/broken-webapp.json`
2. Change the `unique-id` of `"api-service"` to `"backend-api"`

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json
```

Should fail ❌ — the pattern catches that `"api-service"` is missing. You'll also see errors for relationships referencing the now-missing node ID.

### 9. Enhance the Generated Architecture

**Prompt:**
```text
Update architectures/generated-webapp.json to add:
1. Descriptions for each node explaining their purpose
2. A description for each relationship
3. Interfaces on api-service (host, port for HTTPS)
4. Interfaces on app-database (host, port for PostgreSQL)

Keep the unique-ids, node-types, and names exactly as they are.
```

### 10. Validate the Enhanced Architecture

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

```json
{
  "jsonSchemaValidationOutputs": [],
  "spectralSchemaValidationOutputs": [],
  "hasErrors": false,
  "hasWarnings": false
}
```

No warnings ✅ — adding extra properties doesn't break pattern compliance.

Before moving on, use git to capture the state of your work. A descriptive commit message will help future-you understand what changed and why.

## Key Concepts

### Pattern Anatomy

| Keyword | Enforces | Allows |
|---------|----------|--------|
| `const` | Exact value | Nothing else |
| `prefixItems` | Specific ordered items | Additional items after them |
| `minItems` + `maxItems` (equal) | Exact array length | — |
| `$ref` | Schema from another file | Properties defined there |

### Placeholders

Generated architectures use placeholders as signals:
- **String:** `"[[ DESCRIPTION ]]"` — must be replaced before production
- **Numeric:** `-1` for numeric fields like port numbers

### Pattern vs Architecture

A Pattern defines the **shape** any matching architecture must have. An architecture that satisfies the Pattern is free to add extra nodes, relationships, interfaces, and metadata — Patterns only constrain what they explicitly specify.

## Resources

- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- [JSON Schema const](https://json-schema.org/understanding-json-schema/reference/const)

## Troubleshooting

If your pattern won't generate a valid architecture, use this prompt with the CALM Agent:

```text
My pattern doesn't generate a valid architecture when I run the generate command.
Look at this valid pattern for reference:
https://raw.githubusercontent.com/finos/architecture-as-code/refs/heads/main/conferences/osff-ln-2025/workshop/conference-signup.pattern.json
Identify the problem in my pattern.
```

## Next Steps

In the [next tutorial](./18-standards), you'll learn how to create organizational Standards — JSON Schema extensions that define required properties like cost centers, owner fields, and compliance tags!
