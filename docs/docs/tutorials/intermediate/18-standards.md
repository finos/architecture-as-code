---
id: 18-standards
title: "Organizational Standards"
sidebar_position: 12
---

# Organizational Standards

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Learn how CALM Standards extend the flexible core schema with your organization's specific requirements, enabling consistent governance across all architectures.

## Learning Objectives

By the end of this tutorial, you will:
- Understand how Standards compose with CALM schemas using `allOf`
- Create a Node Standard requiring cost center, owner, and environment
- Create a Relationship Standard requiring data classification and encryption status
- Understand what Standards give you versus what Patterns give you

## Prerequisites

Complete [Introduction to CALM Patterns](./17-patterns) first.

## Step-by-Step Guide

### 1. Understand What Standards Are

**The Problem Standards Solve:**
- CALM's core schema is flexible — it doesn't mandate cost centers, owners, or compliance tags
- Your organization likely has requirements: "Every service must have an owner" or "All nodes need a cost center code"
- You don't want to modify CALM's core schema — you want to extend it

**The Solution:**
Standards are JSON Schema 2020-12 documents that compose with core CALM schemas using `allOf`. They add your organization's requirements on top of CALM's foundation.

### 2. Understand the Standards Structure

Standards extend core CALM definitions using `allOf` composition:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": { "type": "string" },
        "owner": { "type": "string" }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

This says: *"A node using this Standard must satisfy BOTH the core CALM node requirements AND our additional properties."*

> **Important:** Ensure the URL in the `$ref` property references the correct CALM release version. If validation fails unexpectedly, check that your CLI and CALM Agent instructions are up to date.

### 3. Explore Common Use Cases

**Organization-Level Extensions:**
- Company Node Requirements: Cost centers, ownership, compliance tags
- Relationship Policies: Approval workflows, security zones
- Control Requirements: Organizational compliance frameworks

**Industry Use Cases:**
- **Financial Services:** Regulatory compliance, risk classifications
- **Healthcare:** HIPAA compliance, patient data handling
- **Government:** Security clearances, classification levels

### 4. Create a Standards Directory

```bash
mkdir -p standards
```

### 5. Create Your First Node Standard

**Prompt:**
```text
Create a CALM Standard at standards/company-node-standard.json that extends the core CALM node definition.

Additional properties to require:
1. costCenter - a string that must match the pattern CC- followed by exactly 4 digits (e.g., CC-1234)
2. owner - a string for the team or individual responsible
3. environment - must be one of: development, staging, or production

Make costCenter and owner required. Include helpful descriptions for each property.
```

Review the generated file — it should use `allOf` to reference the base CALM node schema and add your organization's properties on top.

### 6. Create a Relationship Standard

**Prompt:**
```text
Create a CALM Standard at standards/company-relationship-standard.json that extends the core CALM relationship definition.

Additional properties to require:
1. dataClassification - must be one of: public, internal, confidential, restricted
2. encrypted - a boolean indicating if the connection is encrypted

Make both properties required. Include helpful descriptions.
```

### 7. Understand What the Standards Do

The generated Standards compose two schemas together:

**For Nodes:**
1. **Base CALM node** — provides `unique-id`, `node-type`, `name`, `description`
2. **Your extensions** — adds `costCenter`, `owner`, `environment`

**For Relationships:**
1. **Base CALM relationship** — provides `unique-id`, `relationship-type`, `description`
2. **Your extensions** — adds `dataClassification`, `encrypted`

When you use these Standards, components must satisfy BOTH sets of requirements.

### 8. Understand the Value of Standards

**What Standards Give You:**
- **Consistency:** Every architecture follows the same organizational rules
- **Discoverability:** Easy to find who owns what, what cost center it belongs to
- **Compliance:** Automated validation of organizational requirements
- **Onboarding:** New team members understand expectations from day one

**Example Scenarios:**
- "Who owns this service?" → Check the `owner` property
- "What's the cost allocation?" → Check the `costCenter` property
- "Is this connection secure?" → Check `encrypted` and `dataClassification`

### 9. Document Your Standards

**Prompt:**
```text
Create standards/README.md that documents:

1. What Standards are and how they extend CALM using allOf composition
2. Our company's node standard requirements (cost center, owner, environment)
3. Our company's relationship standard requirements (data classification, encrypted)
```

Record your progress by committing your changes to git. Keeping a tidy history now pays dividends when you need to revisit decisions later.

## Key Concepts

### `allOf` Composition

Standards use `allOf` to extend CALM schemas rather than replace them:

```json
{
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.2/meta/core.json#/defs/node" },
    { "required": ["costCenter", "owner"] }
  ]
}
```

This pattern preserves all base CALM requirements while adding new ones. An architecture using this Standard must satisfy all constraints from both schemas.

### Standards vs Patterns

| Concern | Use | Why |
|---------|-----|-----|
| "What nodes must exist?" | Pattern (`prefixItems`, `const`) | Structure enforcement |
| "What properties must all nodes have?" | Standard (`allOf`, `required`) | Property enforcement |
| "Both?" | Pattern that references a Standard | Layered governance |

### Standards Don't Enforce Themselves

Standards are JSON Schema documents — they define constraints but don't enforce them alone. You need a Pattern that references the Standard (using `$ref`) to actually validate an architecture against it. That's what the next tutorial covers.

## Resources

- [CALM Standards Documentation](https://calm.finos.org/docs/core-concepts/standards)
- [JSON Schema 2020-12 Specification](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema allOf](https://json-schema.org/understanding-json-schema/reference/combining#allOf)

## Next Steps

In the [next tutorial](./19-enforcing-standards), you'll create a Company Base Pattern that references these Standards — enabling automated compliance validation for any architecture!
