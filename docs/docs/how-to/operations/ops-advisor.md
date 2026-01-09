---
id: ops-advisor
title: Operations Advisor
sidebar_position: 2
---

# How to Use AI for Operations Documentation

Use AI to analyze your architecture and generate operations documentation, including service inventories, dependency maps, and operational concerns.

## When to Use This

Use AI-assisted operations analysis when you need to:
- Generate an operations overview quickly
- Identify operational concerns in new architectures
- Create initial runbook outlines
- Document service dependencies

## Quick Start

Open your architecture in VSCode with GitHub Copilot and ask:

```
Generate an operations summary including:
- Service inventory with dependencies
- Deployment order
- Key operational concerns
```

## Step-by-Step

### 1. Generate Service Inventory

**Prompt:**
```
Analyze this architecture and create a service inventory table with:
- Service name
- Dependencies
- Resource requirements (if available)
- Criticality level
```

**Example Output:**

| Service | Dependencies | Resources | Criticality |
|---------|--------------|-----------|-------------|
| API Gateway | Auth Service, Order Service | 2 CPU, 4GB | High |
| Order Service | Database, Payment Gateway | 2 CPU, 4GB | High |
| Notification Service | Message Queue | 1 CPU, 2GB | Medium |

### 2. Determine Deployment Order

**Prompt:**
```
Based on the dependencies in this architecture,
what is the correct deployment order?
List services from first to last.
```

**Example Output:**
1. PostgreSQL Database
2. Redis Cache
3. Auth Service
4. Order Service
5. Notification Service
6. API Gateway

### 3. Identify Failure Scenarios

**Prompt:**
```
What are the potential failure scenarios for this architecture?
For each, describe impact, detection, and recovery steps.
```

### 4. Generate Monitoring Recommendations

**Prompt:**
```
What metrics should we monitor for this architecture?
Categorize by: availability, performance, and business metrics.
```

### 5. Create Initial Runbook Outline

**Prompt:**
```
Generate a runbook outline for the order-service including:
- Service overview
- Common operations
- Troubleshooting steps
- Escalation procedures
```

## Enriching Architecture for Better Results

Add operational metadata to get better AI suggestions:

```json
{
  "nodes": [
    {
      "unique-id": "order-service",
      "name": "Order Service",
      "node-type": "service",
      "metadata": {
        "owner": "orders-team@company.com",
        "criticality": "high",
        "sla": "99.9%",
        "oncall": "orders-oncall"
      }
    }
  ]
}
```

## Best Practices

:::tip Review AI Output
AI provides a starting point—always review with your operations team
:::

:::tip Add Context
Include SLAs, team structure, and compliance requirements in prompts
:::

:::tip Iterate
Start broad, then ask follow-up questions for specific areas
:::

## Related Guides

- [Create Operations Docs](ops-docs) - Build complete runbooks
- [AI Architecture Advisor](../documentation/ai-advisor) - General AI assistance
