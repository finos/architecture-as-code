---
id: 14-ai-advisor
title: "Use CALM as Your Architecture Advisor"
sidebar_position: 8
---

# Use CALM as Your Architecture Advisor

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 45-60 minutes

## Overview

Use CALM Chat mode as an expert architect to analyze and improve your e-commerce architecture for better resilience and performance.

## Learning Objectives

By the end of this tutorial, you will:
- Use CALM Chat mode to assess your architecture for resilience issues
- Implement three concrete resilience improvements: load balancing, database replication, and async decoupling
- Add resilience controls to document new SLA and failover requirements
- Understand how CALM Chat mode accelerates architecture evolution

## Prerequisites

Complete [Custom Documentation with Handlebars Templates](./13-handlebars-templates) first. You will need your `architectures/ecommerce-platform.json` with controls and flows from previous tutorials.

## Step-by-Step Guide

### 1. Understand AI-Assisted Architecture Review

CALM Chat mode can:
- Analyze your architecture for potential issues
- Suggest improvements based on best practices
- Help you implement changes with proper CALM syntax
- Explain the rationale behind recommendations

Think of it as pair-programming with an expert architect who knows your entire system.

### 2. Get a Resilience Assessment

Open your `architectures/ecommerce-platform.json` and ask CALM Chat mode to analyze it.

**Prompt:**
```text
Analyze my e-commerce architecture in architectures/ecommerce-platform.json for resilience issues.

Consider:
- Single points of failure
- Missing redundancy
- Failure isolation
- Recovery patterns

What are the top 3 resilience concerns and how would you address them?
```

Review the recommendations carefully. The AI should identify issues like:
- **Single API Gateway:** Critical single point of failure
- **Single Database Instances:** No replication modeled
- **Missing Async Decoupling:** Synchronous calls mean payment failures cascade to order service

### 3. Implement Resilience Improvement #1: Load Balancer and Gateway Redundancy

**Prompt:**
```text
My API Gateway is a single point of failure. Update my e-commerce architecture to add:

1. A new "load-balancer" node (type: service) as the entry point
2. Two API Gateway instances: "api-gateway-1" and "api-gateway-2"
3. Update the customer and admin interacts relationships to go through the load balancer
4. Add connects relationships from load balancer to both gateway instances
5. Add metadata indicating this is for high availability

The existing api-gateway node can become api-gateway-1.
```

### 4. Implement Resilience Improvement #2: Add Database Replication

**Prompt:**
```text
My order-database is a single point of failure. Update the architecture to show:

1. Rename current order-database to "order-database-primary"
2. Add a new "order-database-replica" node
3. Add a relationship from Order Service to the replica for read operations
4. Add metadata indicating primary/replica roles and replication mode (async)
5. Use a composed-of relationship to group them into an "order-database-cluster"

Keep the primary for writes, replica for reads.
```

### 5. Implement Resilience Improvement #3: Add Message Queue (Per ADR-0001)

Your ADR-0001 already documents the decision to use async processing — let's implement it!

**Prompt:**
```text
Implement the async processing pattern from ADR-0001 in my architecture:

1. Add a "message-broker" node (type: system) for RabbitMQ with an AMQP interface on port 5672
2. Add an "order-queue" that's composed-of the message-broker
3. Change the order-to-payment flow to go through the message broker:
   - Order Service publishes to the queue
   - Payment Service consumes from the queue
4. Add metadata linking to the ADR: "adr": "docs/adr/0001-use-message-queue-for-async-processing.md"

This provides failure isolation — orders can queue if Payment Service is down.
```

### 6. Validate After Resilience Changes

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 7. Visualize the Improved Architecture

**Steps:**
1. Save `architectures/ecommerce-platform.json`
2. Open preview (`Ctrl+Shift+C` / `Cmd+Shift+C`)
3. Notice the new components: load balancer, redundant gateways, database cluster, message broker

### 8. Add Resilience Controls

**Prompt:**
```text
Add resilience controls to my e-commerce architecture:

1. Add an architecture-level "high-availability" control requiring 99.9% uptime
2. Add a node-level "failover" control on the order-database-cluster documenting RTO/RPO targets
3. Add a "circuit-breaker" control on the order-service documenting failure thresholds

Use requirement-url pointing to internal-policy.example.com and include inline config with specific values.
```

### 9. Final Validation

```bash
calm validate -a architectures/ecommerce-platform.json
```

Take a moment to commit what you've built so far using git. Tracking your changes incrementally makes it easier to review how your architecture has grown.

## Key Concepts

### Three Resilience Improvements

| Improvement | Problem Solved | CALM Change |
|-------------|---------------|-------------|
| Load Balancer + Redundant Gateways | Single API Gateway SPOF | New `load-balancer` node + 2 gateway nodes |
| Database Primary/Replica | No DB failover | `composed-of` cluster + replica node |
| Message Queue (ADR-0001) | Sync cascade failures | `message-broker` + async relationships |

### AI-Assisted Review Workflow

1. Ask CALM Chat to **assess** your architecture for a specific concern (resilience, security, cost)
2. Review the **recommendations** — ask "why" for each to understand the rationale
3. Use prompts to **implement** changes incrementally
4. **Validate** after each change with `calm validate`
5. **Reference ADRs** when implementing — they document decisions already made

### Resilience Controls

After implementing improvements, formalize the requirements as controls:

```json
{
  "controls": {
    "high-availability": {
      "description": "System-wide uptime requirement",
      "requirements": [
        {
          "requirement-url": "https://internal-policy.example.com/sla/99-9-uptime",
          "config": { "availability-percent": 99.9 }
        }
      ]
    }
  }
}
```

## Resources

- [Resilience Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/category/resiliency)
- [Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Message Queue Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)

## Next Steps

In the [next tutorial](./15-ops-advisor), you'll use CALM as an operations advisor, enriching your architecture with operational metadata and troubleshooting simulated outages!
