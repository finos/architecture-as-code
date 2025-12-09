# Day 14: Use CALM as Your Expert Architecture Advisor

## Overview

The documentation you have created is great, but wouldn't it be amazing to not even need to create documentaiton?

Use CALM Chat mode as an expert architect to analyze and improve your e-commerce architecture for better resilience and performance.

## Objective and Rationale

- **Objective:** Use AI-assisted architecture analysis to identify weaknesses and improve your e-commerce platform's resilience and performance
- **Rationale:** CALM Chat mode understands architecture patterns, failure modes, and best practices. By treating it as an expert advisor, you can get recommendations for improving your architecture - like having a senior architect review your design. This demonstrates the power of architecture-as-code combined with AI.

## Requirements

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

- **Single API Gateway:** Critical single point of failure - if it fails, the entire platform is unavailable
- **Single Database Instances:** No replication modeled for order-database or inventory-database
- **Missing Async Decoupling:** Synchronous service calls mean payment failures cascade to order service

### 3. Implement Resilience Improvement #1: Add Load Balancer and Gateway Redundancy

The API Gateway is currently a critical single point of failure. Let's add a load balancer and model redundant gateways.

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

Both databases are single instances with no failover. Let's add read replicas.

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

Your ADR-0001 already documents the decision to use async processing - let's implement it! This decouples Order Service from Payment Service failures.

**Prompt:**

```text
Implement the async processing pattern from ADR-0001 in my architecture:

1. Add a "message-broker" node (type: system) for RabbitMQ with an AMQP interface on port 5672
2. Add an "order-queue" that's composed-of the message-broker
3. Change the order-to-payment flow to go through the message broker:
   - Order Service publishes to the queue
   - Payment Service consumes from the queue
4. Add metadata linking to the ADR: "adr": "docs/adr/0001-use-message-queue-for-async-processing.md"

This provides failure isolation - orders can queue if Payment Service is down.
```

### 6. Validate After Resilience Changes

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 7. Visualize the Improved Architecture

**Steps:**

1. Save `architectures/ecommerce-platform.json`
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. Notice the new components:
   - Load balancer in front of redundant gateways
   - Database cluster with primary/replica
   - Message broker between Order and Payment services
4. **Take a screenshot** showing the more resilient architecture

### 8. Add Resilience Controls

Document your resilience requirements as controls.

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

### 10. Document the Improvements

**File:** `docs/architecture-improvements.md`

**Content:**

```markdown
# Architecture Improvements

## Overview

This document captures architecture improvements made with AI-assisted analysis.

## Resilience Issues Identified

| Concern | Severity | Original State | Risk |
|---------|----------|----------------|------|
| Single API Gateway | Critical | 1 gateway, no LB | Total platform outage |
| Single Database Instances | High | No replicas | Data unavailability |
| No Async Decoupling | High | Sync service calls | Cascade failures |

## Improvements Implemented

### 1. Load Balancer + Redundant API Gateways

**Problem:** Single API Gateway was critical single point of failure
**Solution:** Added load balancer with two gateway instances
**Benefit:** Gateway failure no longer causes total outage; traffic routes to healthy instance

### 2. Database Primary/Replica Cluster

**Problem:** Order database had no failover capability
**Solution:** Added read replica with async replication in a composed cluster
**Benefit:** Read scalability; continued read availability during primary issues; faster failover

### 3. Message Queue (ADR-0001 Implementation)

**Problem:** Synchronous Order→Payment calls meant payment failures blocked orders
**Solution:** Added RabbitMQ message broker for async processing
**Benefit:** Orders queue during Payment Service outages; automatic retry; failure isolation

## Controls Added

| Control | Level | Requirement |
|---------|-------|-------------|
| high-availability | Architecture | 99.9% uptime SLA |
| failover | Database Cluster | RTO: 5min, RPO: 1min |
| circuit-breaker | Order Service | Open after 5 failures in 30s |

## Architecture Evolution

- **Before:** 8 nodes, single points of failure, sync processing
- **After:** 12+ nodes, redundant entry point, replicated data, async decoupling

## Alignment with ADRs

- **ADR-0001:** Message queue implementation ✅
- **ADR-0002:** OAuth2 on load balancer entry point ✅

## Lessons Learned

1. AI-assisted review quickly identifies single points of failure
2. Existing ADRs should drive architecture improvements
3. Controls document the requirements that drove resilience decisions
4. Incremental improvements are easier to validate and visualize
```

### 11. Update Your README

Mark Day 12 as complete in your README checklist and note the AI-assisted architecture improvements. Link to `docs/architecture-improvements.md` so collaborators can see the evolution.

### 12. Commit Your Work

```bash
git add architectures/ecommerce-platform.json docs/architecture-improvements.md README.md
git commit -m "Day 12: AI-assisted resilience improvements - LB, replicas, message queue"
git tag day-14
```

## Deliverables

✅ **Required:**

- `architectures/ecommerce-platform.json` - With resilience improvements:
  - Load balancer + redundant API gateways
  - Database primary/replica cluster
  - Message broker for async processing
- `docs/architecture-improvements.md` - Documentation of changes
- Screenshots showing before/after architecture
- Updated `README.md` - Day 14 marked complete

✅ **Validation:**

```bash
# Verify new components exist
grep -q 'load-balancer' architectures/ecommerce-platform.json
grep -q 'api-gateway-1\|api-gateway-2' architectures/ecommerce-platform.json
grep -q 'message-broker' architectures/ecommerce-platform.json
grep -q 'replica' architectures/ecommerce-platform.json

# Verify resilience controls
grep -q 'high-availability' architectures/ecommerce-platform.json
grep -q 'failover' architectures/ecommerce-platform.json

# Validate
calm validate -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-14"
```

## Resources

- [Resilience Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/category/resiliency)
- [Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Message Queue Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)
- [Database Replication](https://www.postgresql.org/docs/current/high-availability.html)

## Tips

- Ask CALM Chat mode to explain *why* it recommends changes, not just *what* to change
- Reference your ADRs when implementing - they document decisions already made
- Implement changes incrementally and validate after each one
- Use controls to document the SLAs and thresholds that drove improvements
- Compare before/after visualizations to communicate changes to stakeholders
- The AI advisor works best when you provide context about your constraints

## Next Steps

Tomorrow (Day 15) you'll use CALM as an operations advisor, adding support metadata and troubleshooting simulated outages!
