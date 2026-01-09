---
id: flows
title: Model Business Flows
sidebar_position: 3
---

# How to Model Business Flows

🟡 **Difficulty:** Intermediate

Flows document how business processes traverse your architecture, showing the sequence of interactions between components.

## When to Use This

Use flows when you need to:
- Document how a user request flows through services
- Show the sequence of API calls for a feature
- Visualize transaction paths
- Communicate system behavior to stakeholders

## Quick Start

Add a `flows` array to your architecture:

```json
{
  "flows": [
    {
      "unique-id": "order-flow",
      "name": "Order Processing",
      "description": "How an order is placed and fulfilled",
      "transitions": [
        {
          "relationship-unique-id": "web-to-api",
          "sequence-number": 1
        },
        {
          "relationship-unique-id": "api-to-orders",
          "sequence-number": 2
        }
      ]
    }
  ]
}
```

## Step-by-Step

### 1. Identify Business Processes

Map out the key processes in your system:

| Process | Description |
|---------|-------------|
| User Login | Authentication flow |
| Place Order | Order creation and payment |
| Search Products | Product catalog query |
| Process Refund | Refund handling |

### 2. Define the Flow

```json
{
  "flows": [
    {
      "unique-id": "login-flow",
      "name": "User Authentication",
      "description": "User login through web application",
      "transitions": [
        {
          "relationship-unique-id": "browser-to-web",
          "sequence-number": 1,
          "description": "User submits credentials"
        },
        {
          "relationship-unique-id": "web-to-auth",
          "sequence-number": 2,
          "description": "Validate credentials"
        },
        {
          "relationship-unique-id": "auth-to-userdb",
          "sequence-number": 3,
          "description": "Lookup user record"
        },
        {
          "relationship-unique-id": "auth-to-web",
          "sequence-number": 4,
          "description": "Return JWT token"
        },
        {
          "relationship-unique-id": "web-to-browser",
          "sequence-number": 5,
          "description": "Set session cookie"
        }
      ]
    }
  ]
}
```

### 3. Ensure Relationships Exist

Each `relationship-unique-id` must reference an existing relationship:

```json
{
  "relationships": [
    {
      "unique-id": "browser-to-web",
      "relationship-type": {
        "connects": {
          "source": { "node": "browser" },
          "destination": { "node": "web-app" }
        }
      }
    },
    {
      "unique-id": "web-to-auth",
      "relationship-type": {
        "connects": {
          "source": { "node": "web-app" },
          "destination": { "node": "auth-service" }
        }
      }
    }
  ]
}
```

### 4. Add Multiple Flows

Document all key business processes:

```json
{
  "flows": [
    {
      "unique-id": "login-flow",
      "name": "User Login",
      "transitions": [/* ... */]
    },
    {
      "unique-id": "order-flow",
      "name": "Place Order",
      "transitions": [/* ... */]
    },
    {
      "unique-id": "refund-flow",
      "name": "Process Refund",
      "transitions": [/* ... */]
    }
  ]
}
```

### 5. Visualize Flows

Use the VSCode extension or docify to generate sequence diagrams:

```markdown
{{flow-sequence this flow-id="login-flow"}}
```

Or view in VSCode:
1. Open your architecture file
2. Open CALM Preview
3. Flows appear as sequence diagrams

## Flow Schema Reference

```json
{
  "unique-id": "string (required)",
  "name": "string (required)",
  "description": "string (optional)",
  "transitions": [
    {
      "relationship-unique-id": "string (required)",
      "sequence-number": "number (required)",
      "description": "string (optional)"
    }
  ]
}
```

## Best Practices

:::tip Focus on Business Value
Name flows by their business purpose, not technical implementation
:::

:::tip Include Error Paths
Consider documenting error/exception flows separately
:::

:::tip Keep Flows Focused
One flow should represent one coherent business process
:::

## Related Guides

- [Define Controls](controls) - Add requirements to flow participants
- [Create Operations Docs](../operations/ops-docs) - Generate runbooks from flows
