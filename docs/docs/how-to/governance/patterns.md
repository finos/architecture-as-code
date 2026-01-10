---
id: patterns
title: Create Patterns
sidebar_position: 2
---

# How to Create Architecture Patterns

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Patterns are reusable architecture templates that capture proven solutions and organizational best practices.

## When to Use This

Use patterns when you need to:
- Standardize architecture across teams
- Capture best practices in reusable form
- Speed up new project creation
- Ensure consistency in common architectures

## Quick Start

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "unique-id": "microservice-pattern",
  "name": "Microservice Pattern",
  "nodes": [
    {
      "unique-id": "{{ SERVICE_NAME }}",
      "name": "{{ SERVICE_DISPLAY_NAME }}",
      "node-type": "service"
    }
  ]
}
```

## Step-by-Step

### 1. Identify Common Architectures

Look for repeating patterns in your organization:

| Pattern | Use Case |
|---------|----------|
| Microservice | Standard service with database |
| API Gateway | Frontend routing and auth |
| Event-Driven | Async messaging architecture |
| Data Pipeline | ETL/data processing |

### 2. Create Pattern Structure

**File:** `patterns/microservice-pattern.json`

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "unique-id": "microservice-pattern",
  "name": "Microservice Pattern",
  "description": "Standard microservice with database and API",
  "nodes": [
    {
      "unique-id": "{{ SERVICE_NAME }}",
      "name": "{{ SERVICE_DISPLAY_NAME }}",
      "description": "{{ SERVICE_DESCRIPTION }}",
      "node-type": "service"
    },
    {
      "unique-id": "{{ SERVICE_NAME }}-database",
      "name": "{{ SERVICE_DISPLAY_NAME }} Database",
      "description": "Primary data store",
      "node-type": "database"
    }
  ],
  "relationships": [
    {
      "unique-id": "{{ SERVICE_NAME }}-to-db",
      "relationship-type": {
        "connects": {
          "source": { "node": "{{ SERVICE_NAME }}" },
          "destination": { "node": "{{ SERVICE_NAME }}-database" }
        }
      }
    }
  ]
}
```

### 3. Use Placeholders

Placeholders allow customization when instantiating:

| Placeholder | Convention | Example Value |
|-------------|------------|---------------|
| `{{ SERVICE_NAME }}` | Lowercase with hyphens | `order-service` |
| `{{ SERVICE_DISPLAY_NAME }}` | Title case | `Order Service` |
| `{{ SERVICE_DESCRIPTION }}` | Full sentence | `Handles order processing` |

### 4. Add Required Controls

Include controls that every instance must have. Controls are objects with named keys, each having a `description` and `requirements` array:

```json
{
  "nodes": [
    {
      "unique-id": "{{ SERVICE_NAME }}",
      "name": "{{ SERVICE_DISPLAY_NAME }}",
      "description": "{{ SERVICE_DESCRIPTION }}",
      "node-type": "service",
      "controls": {
        "authentication": {
          "description": "Service must implement OAuth2 authentication",
          "requirements": [
            {
              "requirement-url": "https://example.com/controls/oauth2.json",
              "config": { "mechanism": "OAuth2" }
            }
          ]
        }
      }
    }
  ]
}
```

### 5. Create an Instantiation

**File:** `architectures/order-service.json`

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "unique-id": "order-service-architecture",
  "name": "Order Service Architecture",
  "pattern-ref": "../patterns/microservice-pattern.json",
  "nodes": [
    {
      "unique-id": "order-service",
      "name": "Order Service",
      "description": "Handles order creation and management",
      "node-type": "service"
    },
    {
      "unique-id": "order-service-database",
      "name": "Order Service Database",
      "description": "PostgreSQL database for orders",
      "node-type": "database"
    }
  ],
  "relationships": [
    {
      "unique-id": "order-service-to-db",
      "relationship-type": {
        "connects": {
          "source": { "node": "order-service" },
          "destination": { "node": "order-service-database" }
        }
      }
    }
  ]
}
```

### 6. Validate Against Pattern

```bash
calm validate \
  --architecture architectures/order-service.json \
  --pattern patterns/microservice-pattern.json
```

## Pattern Types

### Structural Patterns

Define required components and relationships:

```json
{
  "nodes": [
    { "unique-id": "{{ API }}", "node-type": "service" },
    { "unique-id": "{{ DB }}", "node-type": "database" }
  ],
  "relationships": [
    { "unique-id": "api-to-db", "required": true }
  ]
}
```

### Control Patterns

Enforce required controls:

```json
{
  "required-controls": [
    { "type": "authentication", "on": "external-services" },
    { "type": "encryption", "on": "database-connections" }
  ]
}
```

### Metadata Patterns

Require specific metadata:

```json
{
  "required-metadata": {
    "owner": { "type": "email", "required": true },
    "criticality": { "enum": ["high", "medium", "low"] }
  }
}
```

## Best Practices

:::tip Start Generic
Create patterns that capture essential structure, not every detail
:::

:::tip Document Patterns
Include clear descriptions of when and how to use each pattern
:::

:::tip Version Patterns
Use versioning to evolve patterns without breaking existing architectures
:::

:::tip Validate Examples
Keep example instantiations that pass validation
:::

## Related Resources

- [Define Standards](standards) - Create organizational validation rules
- [Multi-Pattern Validation](multi-pattern-validation) - Validate against multiple patterns
