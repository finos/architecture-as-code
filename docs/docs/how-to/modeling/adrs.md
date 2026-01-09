---
id: adrs
title: Document Decisions with ADRs
sidebar_position: 4
---

# How to Document Decisions with ADRs

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 10-15 minutes

Architecture Decision Records (ADRs) capture the context, decision, and consequences of significant architectural choices.

## When to Use This

Use ADRs when you need to:
- Record why a technology was chosen
- Document trade-offs considered
- Provide context for future maintainers
- Track the evolution of architecture decisions

## Quick Start

Add ADRs to your architecture metadata:

```json
{
  "metadata": {
    "adrs": [
      {
        "id": "ADR-001",
        "title": "Use PostgreSQL for order data",
        "status": "accepted",
        "date": "2024-01-15"
      }
    ]
  }
}
```

## Step-by-Step

### 1. Identify Decision Points

Common architectural decisions worth recording:

| Category | Example Decisions |
|----------|-------------------|
| **Technology** | Database choice, framework selection |
| **Integration** | Sync vs async, REST vs GraphQL |
| **Deployment** | Cloud provider, container orchestration |
| **Security** | Authentication mechanism, encryption approach |
| **Data** | Storage format, retention policy |

### 2. Create an ADR Structure

Each ADR follows a standard format:

```json
{
  "metadata": {
    "adrs": [
      {
        "id": "ADR-001",
        "title": "Use PostgreSQL for Order Data",
        "status": "accepted",
        "date": "2024-01-15",
        "context": "We need a reliable database for order management that supports ACID transactions and complex queries.",
        "decision": "Use PostgreSQL as the primary database for the order service.",
        "consequences": {
          "positive": [
            "Strong ACID compliance for financial data",
            "Rich query capabilities with JSON support",
            "Team familiarity with PostgreSQL"
          ],
          "negative": [
            "Requires operational expertise for scaling",
            "May need read replicas for high-traffic scenarios"
          ]
        },
        "alternatives-considered": [
          {
            "option": "MongoDB",
            "reason-rejected": "Weaker transaction support for financial data"
          },
          {
            "option": "MySQL",
            "reason-rejected": "Less mature JSON support"
          }
        ]
      }
    ]
  }
}
```

### 3. Link ADRs to Nodes

Reference ADRs from relevant nodes:

```json
{
  "nodes": [
    {
      "unique-id": "order-database",
      "name": "Order Database",
      "node-type": "database",
      "description": "PostgreSQL database for order data (see ADR-001)",
      "adr-refs": ["ADR-001"]
    }
  ]
}
```

### 4. Track ADR Status

Use standard statuses:

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion |
| `accepted` | Approved and in effect |
| `deprecated` | No longer recommended |
| `superseded` | Replaced by another ADR |

### 5. Create ADR Markdown Files

For detailed ADRs, create separate files:

**File:** `adrs/ADR-001-postgresql-for-orders.md`

```markdown
# ADR-001: Use PostgreSQL for Order Data

## Status
Accepted

## Context
We need a database for the order management system that can:
- Handle high transaction volumes
- Ensure data consistency for financial records
- Support complex reporting queries

## Decision
We will use PostgreSQL 15+ as the primary database for order data.

## Consequences

### Positive
- Strong ACID compliance ensures data integrity
- JSON support allows flexible order metadata
- Mature ecosystem with good tooling

### Negative
- Requires DBA expertise for optimization
- Horizontal scaling requires additional infrastructure

## Alternatives Considered

### MongoDB
Rejected: Weaker transaction guarantees for financial data

### MySQL
Rejected: Less mature JSON support and window functions
```

### 6. Reference in Architecture

```json
{
  "metadata": {
    "adrs": [
      {
        "id": "ADR-001",
        "title": "Use PostgreSQL for Order Data",
        "file": "./adrs/ADR-001-postgresql-for-orders.md",
        "status": "accepted"
      }
    ]
  }
}
```

## ADR Schema Reference

```json
{
  "id": "string (required)",
  "title": "string (required)",
  "status": "proposed | accepted | deprecated | superseded",
  "date": "YYYY-MM-DD",
  "context": "string",
  "decision": "string",
  "consequences": {
    "positive": ["array"],
    "negative": ["array"]
  },
  "superseded-by": "ADR-XXX (if superseded)",
  "file": "path to detailed markdown (optional)"
}
```

## Best Practices

:::tip Record Early
Document decisions when context is fresh, not months later
:::

:::tip Focus on "Why"
The most valuable part of an ADR is the reasoning, not just the decision
:::

:::tip Keep ADRs Immutable
When decisions change, create a new ADR that supersedes the old one
:::

:::tip Review Periodically
Revisit ADRs during architecture reviews to ensure they're still valid
:::

## Related Guides

- [Define Controls](controls) - ADRs often justify control requirements
- [Create Patterns](../governance/patterns) - ADRs can explain pattern design choices
