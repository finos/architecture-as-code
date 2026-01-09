---
id: standards-from-patterns
title: Generate Standards from Patterns
sidebar_position: 4
---

# How to Generate Standards from Patterns

🔴 **Difficulty:** Advanced | ⏱️ **Time:** 30-45 minutes

Automatically generate validation standards from your patterns, ensuring architectures conform to established templates.

## When to Use This

Use this approach when you need to:
- Validate that instantiations match patterns
- Auto-generate baseline validation rules
- Keep standards synchronized with patterns
- Reduce manual standard maintenance

## Quick Start

```bash
calm generate standard \
  --pattern patterns/microservice-pattern.json \
  --output standards/microservice-standard.json
```

## Step-by-Step

### 1. Prepare Pattern with Validation Hints

Enhance your pattern with metadata about required elements:

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/pattern.json",
  "unique-id": "api-gateway-pattern",
  "name": "API Gateway Pattern",
  "metadata": {
    "validation": {
      "strict": true,
      "requiredControls": ["authentication", "rate-limiting"]
    }
  },
  "nodes": [
    {
      "unique-id": "{{ GATEWAY }}",
      "node-type": "service",
      "required": true,
      "controls": [
        { "type": "authentication", "required": true },
        { "type": "rate-limiting", "required": true }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "gateway-to-backend",
      "required": true
    }
  ]
}
```

### 2. Generate Standard

```bash
calm generate standard \
  --pattern patterns/api-gateway-pattern.json \
  --output standards/api-gateway-standard.json
```

### 3. Review Generated Standard

The CLI creates validation rules for:
- Required nodes exist
- Required relationships exist
- Required controls are present
- Naming conventions followed

**Generated output:**

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/standard.json",
  "unique-id": "api-gateway-standard",
  "name": "API Gateway Standard",
  "description": "Auto-generated from api-gateway-pattern",
  "source-pattern": "api-gateway-pattern",
  "requirements": [
    {
      "id": "AGW-001",
      "description": "Gateway service node must exist",
      "severity": "error",
      "validation": { /* ... */ }
    },
    {
      "id": "AGW-002",
      "description": "Gateway must have authentication control",
      "severity": "error",
      "validation": { /* ... */ }
    }
  ]
}
```

### 4. Customize Generated Standard

Add organization-specific rules:

```json
{
  "requirements": [
    // ... generated requirements ...
    {
      "id": "AGW-CUSTOM-001",
      "description": "Gateway must have monitoring enabled",
      "severity": "warning",
      "validation": {
        "properties": {
          "nodes": {
            "items": {
              "if": {
                "properties": { "node-type": { "const": "service" } }
              },
              "then": {
                "properties": {
                  "metadata": {
                    "properties": { "monitoring": { "const": true } }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

### 5. Validate Architectures

```bash
calm validate \
  --architecture architectures/my-gateway.json \
  --standard standards/api-gateway-standard.json
```

## Keeping Standards in Sync

When patterns change:

1. **Regenerate** the standard
2. **Compare** with existing standard
3. **Merge** custom rules
4. **Test** against existing architectures

### Automation Script

```bash
#!/bin/bash
# regenerate-standards.sh

for pattern in patterns/*.json; do
  name=$(basename "$pattern" -pattern.json)
  
  # Generate to temp file
  calm generate standard \
    --pattern "$pattern" \
    --output "standards/.generated/${name}-standard.json"
  
  # Compare with existing
  if [ -f "standards/${name}-standard.json" ]; then
    diff "standards/${name}-standard.json" \
         "standards/.generated/${name}-standard.json"
  fi
done
```

## Best Practices

:::tip Version Control Both
Track patterns and generated standards together in git
:::

:::tip Separate Files
Keep generated and custom rules in separate files for easier maintenance
:::

:::tip Review Changes
Manually review generated standards before applying to CI/CD
:::

## Related Guides

- [Create Patterns](patterns) - Define architecture patterns
- [Define Standards](standards) - Manual standard creation
- [Multi-Pattern Validation](multi-pattern-validation) - Combine standards
