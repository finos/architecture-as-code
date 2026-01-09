---
id: standards
title: Define Standards
sidebar_position: 3
---

# How to Define Architecture Standards

🟡 **Difficulty:** Intermediate

Standards are validation rules that check architectures against organizational policies, security requirements, and best practices.

## When to Use This

Use standards when you need to:
- Enforce naming conventions
- Require security controls
- Validate compliance requirements
- Check documentation completeness

## Quick Start

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/standard.json",
  "unique-id": "naming-standard",
  "name": "Naming Conventions",
  "requirements": [
    {
      "id": "NC-001",
      "description": "Node IDs must use kebab-case",
      "severity": "error",
      "validation": {
        "type": "object",
        "properties": {
          "nodes": {
            "items": {
              "properties": {
                "unique-id": { "pattern": "^[a-z][a-z0-9-]*$" }
              }
            }
          }
        }
      }
    }
  ]
}
```

## Step-by-Step

### 1. Identify Requirements

Common standard categories:

| Category | Examples |
|----------|----------|
| **Naming** | Kebab-case IDs, descriptive names |
| **Security** | Auth on external services, encryption |
| **Documentation** | Required descriptions, owner metadata |
| **Compliance** | Specific controls for PCI, SOC2 |

### 2. Create Standard Structure

**File:** `standards/naming-standard.json`

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/standard.json",
  "unique-id": "naming-standard",
  "name": "Naming Conventions Standard",
  "description": "Enforces consistent naming across architectures",
  "requirements": []
}
```

### 3. Add Naming Requirements

```json
{
  "requirements": [
    {
      "id": "NC-001",
      "description": "Node IDs must use kebab-case",
      "severity": "error",
      "validation": {
        "type": "object",
        "properties": {
          "nodes": {
            "type": "array",
            "items": {
              "properties": {
                "unique-id": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$"
                }
              }
            }
          }
        }
      }
    },
    {
      "id": "NC-002",
      "description": "All nodes must have non-empty names",
      "severity": "error",
      "validation": {
        "type": "object",
        "properties": {
          "nodes": {
            "type": "array",
            "items": {
              "required": ["name"],
              "properties": {
                "name": { "minLength": 1 }
              }
            }
          }
        }
      }
    }
  ]
}
```

### 4. Add Security Requirements

**File:** `standards/security-standard.json`

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/standard.json",
  "unique-id": "security-standard",
  "name": "Security Requirements",
  "requirements": [
    {
      "id": "SEC-001",
      "description": "External services must have authentication",
      "severity": "error",
      "validation": {
        "type": "object",
        "properties": {
          "nodes": {
            "items": {
              "if": {
                "properties": {
                  "external": { "const": true }
                }
              },
              "then": {
                "properties": {
                  "controls": {
                    "contains": {
                      "properties": {
                        "type": { "const": "authentication" }
                      }
                    }
                  }
                },
                "required": ["controls"]
              }
            }
          }
        }
      }
    }
  ]
}
```

### 5. Add Documentation Requirements

**File:** `standards/documentation-standard.json`

```json
{
  "$schema": "https://calm.finos.org/draft/2025-03/meta/standard.json",
  "unique-id": "documentation-standard",
  "name": "Documentation Requirements",
  "requirements": [
    {
      "id": "DOC-001",
      "description": "Architecture must have description (20+ chars)",
      "severity": "error",
      "validation": {
        "required": ["description"],
        "properties": {
          "description": { "minLength": 20 }
        }
      }
    },
    {
      "id": "DOC-002",
      "description": "All nodes should have descriptions",
      "severity": "warning",
      "validation": {
        "properties": {
          "nodes": {
            "items": {
              "required": ["description"],
              "properties": {
                "description": { "minLength": 10 }
              }
            }
          }
        }
      }
    },
    {
      "id": "DOC-003",
      "description": "Architecture must have owner metadata",
      "severity": "error",
      "validation": {
        "properties": {
          "metadata": {
            "required": ["owner"],
            "properties": {
              "owner": { "format": "email" }
            }
          }
        },
        "required": ["metadata"]
      }
    }
  ]
}
```

### 6. Validate Architecture

```bash
calm validate \
  --architecture my-architecture.json \
  --standard standards/naming-standard.json \
  --standard standards/security-standard.json
```

## Severity Levels

| Severity | Meaning | CI Behavior |
|----------|---------|-------------|
| `error` | Must fix | Fails pipeline |
| `warning` | Should fix | Warns only |
| `info` | Suggestion | Information |

## JSON Schema Patterns

### Required Field

```json
{ "required": ["fieldName"] }
```

### String Pattern

```json
{ "pattern": "^[a-z-]+$" }
```

### Minimum Length

```json
{ "minLength": 10 }
```

### Enum Values

```json
{ "enum": ["value1", "value2"] }
```

### Conditional (if/then)

```json
{
  "if": { "properties": { "type": { "const": "service" } } },
  "then": { "required": ["controls"] }
}
```

### Array Contains

```json
{
  "contains": {
    "properties": { "type": { "const": "authentication" } }
  }
}
```

## Best Practices

:::tip Start with Warnings
Use `warning` severity when introducing new standards
:::

:::tip Document Why
Include clear descriptions explaining the purpose of each requirement
:::

:::tip Test Standards
Validate against known-good and known-bad architectures
:::

## Related Guides

- [Create Patterns](patterns) - Define architecture templates
- [Standards from Patterns](standards-from-patterns) - Auto-generate standards
- [Multi-Pattern Validation](multi-pattern-validation) - Combine multiple standards
