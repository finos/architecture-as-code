---
id: 20-multi-pattern-validation
title: "Multi-Pattern Validation"
sidebar_position: 14
---

# Multi-Pattern Validation

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Learn how to validate a single architecture against multiple Patterns simultaneously — combining structural patterns with standards-enforcing patterns for complete, layered governance. This is the culmination of the Intermediate tutorials, bringing together all concepts from earlier lessons.

## Learning Objectives

By the end of this tutorial, you will:
- Update your generated web application to comply with organizational Standards
- Validate against structural and standards-enforcing patterns
- Understand why multi-pattern validation scales better than combined patterns
- Integrate multi-pattern validation into a CI/CD pipeline

## Prerequisites

Complete [Enforcing Standards with Patterns](./19-enforcing-standards) first. You will need your `patterns/company-base-pattern.json`, `patterns/web-app-pattern.json`, `architectures/generated-webapp.json`, and `url-mapping.json`.

## Step-by-Step Guide

### 1. Review Your Current State

Your `generated-webapp.json` from the [Introduction to CALM Patterns](./17-patterns) lesson validates against the web app structural pattern:

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass ✅ — structure is correct.

Now try the Standards pattern:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

Should fail ❌ — missing `costCenter`, `owner`, `environment` on nodes and `dataClassification`, `encrypted` on relationships.

### 2. Add Standards Properties to Nodes

Open `architectures/generated-webapp.json` and update each node to include Standard properties:

**Prompt:**
```text
Update architectures/generated-webapp.json to add Standard-compliant properties to ALL nodes.

For each node, add these properties (alongside existing properties like unique-id, name, etc.):
- costCenter: use the values below
- owner: use the team names below  
- environment: "production" for all

Here are the mappings:
- web-frontend: CC-1001, frontend-team
- api-service: CC-2001, backend-team
- app-database: CC-3001, data-team

Keep all existing node properties intact.
```

### 3. Add Standards Properties to Relationships

Update each relationship in `generated-webapp.json`:

**Prompt:**
```text
Update architectures/generated-webapp.json to add Standard-compliant properties to ALL relationships.

For each relationship, add:
- dataClassification: appropriate level based on data sensitivity
- encrypted: true (all communications should be encrypted)

Use these classifications:
- frontend-to-api: "internal" (browser to API)
- api-to-database: "confidential" (API to database contains sensitive data)

Keep all existing relationship properties intact.
```

Apply to all relationships in the architecture.

### 4. Validate Against the Standards Pattern

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

Should now pass! ✅

### 5. Validate Against Both Patterns

```bash
# Structural validation
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Standards validation
calm validate -p patterns/company-base-pattern.json -a architectures/generated-webapp.json -u url-mapping.json
```

Both should pass! ✅ ✅

### 6. Understand the Power of Multi-Pattern Validation

**Why not just combine everything into one pattern?**

| Approach | Patterns | Architectures | Validations needed |
|----------|----------|---------------|-------------------|
| Combined | N combined patterns | M architectures | N × M |
| Multi-pattern (separate) | S structural + 1 standards | M architectures | (S + 1) × M |

With 5 structural patterns and 20 architectures:
- **Combined:** Could require up to 5 customised versions of the standards pattern × 20 = 100 validations
- **Multi-pattern:** 6 validations per architecture × 20 = 120 total, but each validation is simpler and reusable

The real power: your `company-base-pattern.json` works with **every** architecture type, not just 3-tier web apps. You write the Standards once, and they apply everywhere.

```
Multi-Pattern Validation
─────────────────────────────────────────────────────────────────
generated-webapp.json ──► web-app-pattern.json      ✅ (structure)
                     └──► company-base-pattern.json  ✅ (standards)

future-microservice.json ──► microservice-pattern.json  ✅ (structure)
                         └──► company-base-pattern.json  ✅ (standards)

future-data-pipeline.json ──► pipeline-pattern.json     ✅ (structure)
                          └──► company-base-pattern.json ✅ (standards)

                                    ▲
                         One standards pattern
                         for all architectures
```

### 7. Integrate into CI/CD

Add multi-pattern validation to your GitHub Actions workflow:

```yaml
# .github/workflows/calm-validate.yml
name: CALM Multi-Pattern Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install -g @finos/calm-cli

      - name: Validate Structure
        run: |
          calm validate \
            -p patterns/web-app-pattern.json \
            -a architectures/generated-webapp.json

      - name: Validate Standards Compliance
        run: |
          calm validate \
            -p patterns/company-base-pattern.json \
            -a architectures/generated-webapp.json \
            -u url-mapping.json
```

### 8. Update the Patterns README

**Prompt:**
```text
Update patterns/README.md to document the multi-pattern validation approach:

1. Explain how structural patterns and standards patterns work together
2. Explain why this is better than combined patterns
3. Describe how this enables CI/CD governance
4. List the current patterns:
   - web-app-pattern.json (structural)
   - company-base-pattern.json (standards)
```

## Validation Strategy

Architectures should be validated against multiple patterns:

1. **Structural pattern** (e.g., `web-app-pattern.json`) — validates
   the correct node types and relationships for the architecture style.

2. **Standards pattern** (`company-base-pattern.json`) — validates
   organizational standards (costCenter, owner, environment, dataClassification, encrypted).

Run both validations before committing any architecture change.

Use git to version-control your work so far. Small, frequent commits make it easier to track the evolution of your architecture over the course of this series.

## Key Concepts

### Multi-Pattern Validation Benefits

```
    Single Combined Pattern
    ─────────────────────────────
    web-app-with-standards.json
    (1 file, hard to maintain,
    must be duplicated per style)


    Multi-Pattern Validation
    ─────────────────────────────
    web-app-pattern.json       (structure)
      +
    company-base-pattern.json  (standards)
    (2 separate files, each doing one job,
    standards pattern reused by all styles)
```

### Separation of Concerns

| Pattern | Concerns | Changes when |
|---------|----------|-------------|
| `web-app-pattern.json` | 3-tier structure | Architecture style evolves |
| `company-base-pattern.json` | Org standards | Compliance requirements change |

Keeping them separate means a change to Standards doesn't require touching every structural pattern.

### Validation Order Matters

Validate **structure first**, then **standards**. This way:
1. Structure failures catch missing or wrong nodes immediately
2. Standards failures highlight missing metadata on otherwise-correct architectures
3. Errors are easier to diagnose with clear separation

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- [CALM CLI Validate Command](https://github.com/finos/architecture-as-code/tree/main/cli#validate)
- [JSON Schema Composition](https://json-schema.org/understanding-json-schema/reference/combining)

## Next Steps

Congratulations — you've completed the Intermediate Tutorials! You've learned to:

- Model controls, business flows, and ADRs
- Publish your architecture with `docify`
- Build custom visualizations with CALM Widgets and Handlebars Templates
- Leverage AI for architecture and operations advice
- Structure reusable Patterns, define organizational Standards, and enforce them through multi-layer validation

Continue your journey by exploring the **Practitioner** level tutorials, where you'll go deeper into real-world CALM adoption, custom tooling, and advanced governance workflows.
