# Day 15: Use CALM as Your Expert Operations Advisor

## Overview

Use CALM Chat mode as an expert operations advisor to troubleshoot issues in your e-commerce platform. With rich metadata, your architecture becomes living support documentation.

## Objective and Rationale

- **Objective:** Enrich your architecture with operational metadata and use CALM Chat mode to troubleshoot simulated outages
- **Rationale:** Traditional support documentation (Confluence, Twikis, runbooks) quickly becomes stale and disconnected from reality. By embedding operational knowledge directly in your architecture model, CALM becomes a queryable operations expert. When an incident occurs, engineers can ask CALM about affected components, dependencies, escalation paths, and troubleshooting steps - all derived from the actual architecture.

## Requirements

### 1. Understand Architecture as Operations Documentation

Your CALM architecture already contains:

- **Nodes:** What services exist, their types, and criticality
- **Relationships:** How services connect and depend on each other
- **Flows:** Business processes that traverse your system
- **Controls:** SLAs and compliance requirements

By adding operational metadata, you transform this into queryable support documentation:

- Ownership and escalation contacts
- Health check endpoints
- Common failure modes and remediation steps
- Runbook links and troubleshooting guides

Unlike static wikis, this documentation lives with the architecture and stays in sync.

### 2. Add Operational Metadata to Nodes

Enrich your key services with support information.

**Prompt:**

```text
Add operational metadata to my e-commerce architecture nodes. For each service (load-balancer, api-gateway-1, api-gateway-2, order-service, inventory-service, payment-service), add metadata including:

1. "owner": team name responsible (e.g., "platform-team", "payments-team")
2. "oncall-slack": Slack channel for incidents (e.g., "#oncall-platform")
3. "health-endpoint": Health check URL (e.g., "/health" or "/actuator/health")
4. "runbook": Link to runbook (e.g., "https://runbooks.example.com/order-service")
5. "tier": Service tier for prioritization ("tier-1", "tier-2", "tier-3")
6. "dependencies": Array of critical upstream/downstream services

Also add to the databases:
1. "backup-schedule": When backups run
2. "restore-time": Expected restore duration
3. "dba-contact": DBA team contact
```

### 3. Add Failure Mode Metadata

Document known failure modes and remediation steps.

**Prompt:**

```text
Add failure mode documentation to the order-service node metadata:

"failure-modes": [
  {
    "symptom": "HTTP 503 errors",
    "likely-cause": "Database connection pool exhausted",
    "check": "Check connection pool metrics in Grafana dashboard",
    "remediation": "Scale up service replicas or increase pool size",
    "escalation": "If persists > 5min, page DBA team"
  },
  {
    "symptom": "High latency (>2s p99)",
    "likely-cause": "Payment service degradation",
    "check": "Check payment-service health and circuit breaker status",
    "remediation": "Circuit breaker should open automatically; check fallback queue",
    "escalation": "Contact payments-team if circuit breaker not triggering"
  },
  {
    "symptom": "Order validation failures",
    "likely-cause": "Inventory service returning stale data",
    "check": "Verify inventory-service cache TTL and database replication lag",
    "remediation": "Clear inventory cache; check replica sync status",
    "escalation": "Contact platform-team for cache issues"
  }
]

Add similar failure modes for payment-service and inventory-service.
```

### 4. Add Flow-Level Incident Metadata

Document what business impact each flow has when degraded.

**Prompt:**

```text
Add incident metadata to my business flows:

For order-processing-flow:
- "business-impact": "Customers cannot complete purchases - direct revenue loss"
- "degraded-behavior": "Orders queue in message broker; processed when service recovers"
- "customer-communication": "Display 'Order processing delayed' message"
- "sla": "99.9% availability, 30s p99 latency"

For inventory-check-flow:
- "business-impact": "Stock levels may be inaccurate - risk of overselling"
- "degraded-behavior": "Fall back to cached inventory; flag orders for manual review"
- "customer-communication": "Display 'Stock availability being confirmed'"
- "sla": "99.5% availability, 500ms p99 latency"
```

### 5. Add Monitoring and Alerting Metadata

Document where to find observability data.

**Prompt:**

```text
Add monitoring metadata to the architecture level:

"monitoring": {
  "grafana-dashboard": "https://grafana.example.com/d/ecommerce-overview",
  "kibana-logs": "https://kibana.example.com/app/discover#/ecommerce-*",
  "pagerduty-service": "https://pagerduty.example.com/services/ECOMMERCE",
  "statuspage": "https://status.example.com",
  "metrics-retention": "30 days",
  "log-retention": "90 days"
}

Add service-specific dashboards in each node's metadata:
- "dashboard": Link to service-specific Grafana dashboard
- "log-query": Pre-built Kibana query for this service
- "alerts": Array of PagerDuty alert names that fire for this service
```

### 6. Validate the Enriched Architecture

```bash
calm validate -a architectures/ecommerce-platform.json
```

Metadata doesn't affect validation - it passes through as documentation.

### 7. Simulate an Outage: Payment Service Down

Now use CALM as your operations advisor to troubleshoot!

**Scenario:** You receive an alert that order completion rate has dropped 80%. Customers are complaining they can't checkout.

**Prompt:**

```text
I'm receiving alerts that order completion rate has dropped 80%. Customers report checkout failures.

Based on my e-commerce architecture:
1. What services are involved in the checkout/order flow?
2. What are the most likely failure points?
3. What health endpoints should I check first?
4. Who should I contact if this is a payment issue?
5. What's the business impact and customer communication plan?
```

CALM should respond using your architecture's metadata, identifying the order-processing-flow, the services involved, health endpoints to check, and escalation contacts.

**Capture the output** - Take a screenshot or copy CALM's response as evidence of the troubleshooting conversation.

### 8. Simulate an Outage: Database Latency Spike

**Scenario:** You see order-service latency has spiked to 5 seconds. No errors, just slow.

**Prompt:**

```text
Order-service latency has spiked to 5 seconds (normally <200ms). No errors in logs.

Using my architecture:
1. What databases does order-service connect to?
2. Could this be a database replication issue?
3. What are the known failure modes for high latency?
4. What's the remediation steps?
5. What's the DBA contact for the order database?
```

**Capture the output** - Take a screenshot or copy CALM's response as evidence of the troubleshooting conversation.

### 9. Simulate an Outage: Cascade Failure Investigation

**Scenario:** Multiple services are showing errors. You need to find the root cause.

**Prompt:**

```text
I'm seeing errors across order-service, inventory-service, and the web-frontend. It started 10 minutes ago.

Analyze my architecture to help identify the root cause:
1. What's the dependency graph between these services?
2. What shared infrastructure could cause all three to fail?
3. Is there a single point of failure that could explain this?
4. In what order should I investigate?
5. Based on the flow definitions, which business processes are affected?
```

CALM should identify the API Gateway or load balancer as potential shared failure points, and walk through the dependency chain.

**Capture the output** - Take a screenshot or copy CALM's response as evidence of the troubleshooting conversation.

### 10. Generate an Incident Summary

After troubleshooting, ask CALM to help document the incident.

**Prompt:**

```text
We identified the root cause as the load-balancer health check misconfiguration causing api-gateway-2 to be marked unhealthy, putting all traffic on api-gateway-1 which became overloaded.

Generate an incident summary based on my architecture:
1. Affected services and their tiers
2. Business flows impacted
3. Customer impact based on flow metadata
4. Timeline of dependency failures
5. Remediation steps taken
6. Follow-up actions to prevent recurrence
```

### 11. Compare: Wiki vs Architecture-as-Documentation

| Aspect            | Traditional Wiki      | CALM Architecture                     |
|-------------------|-----------------------|---------------------------------------|
| Accuracy          | Often stale           | Always current (lives with code)      |
| Discoverability   | Search/hope           | Query the model directly              |
| Dependencies      | Manually maintained   | Derived from relationships            |
| Impact analysis   | Tribal knowledge      | Computed from flows                   |
| Escalation paths  | Buried in pages       | Embedded in node metadata             |
| Troubleshooting   | Static runbooks       | Context-aware AI assistance           |

### 12. Commit Your Work

```bash
git add architectures/ecommerce-platform.json
git commit -m "Day 15: Add operational metadata for support documentation"
git tag day-15
```

## Deliverables

✅ **Required:**

- `architectures/ecommerce-platform.json` - With operational metadata:
  - Owner and on-call contacts per service
  - Health endpoints and runbook links
  - Failure modes with symptoms and remediation
  - Flow-level business impact documentation
  - Monitoring dashboard links
- Screenshots of CALM troubleshooting conversations
- Updated `README.md` - Day 15 marked complete

✅ **Validation:**

```bash
# Verify operational metadata exists
grep -q 'oncall-slack' architectures/ecommerce-platform.json
grep -q 'health-endpoint' architectures/ecommerce-platform.json
grep -q 'failure-modes' architectures/ecommerce-platform.json
grep -q 'runbook' architectures/ecommerce-platform.json
grep -q 'business-impact' architectures/ecommerce-platform.json

# Validate architecture
calm validate -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-15"
```

## Resources

- [Site Reliability Engineering (Google)](https://sre.google/sre-book/table-of-contents/)
- [Incident Management Best Practices](https://www.atlassian.com/incident-management)
- [Runbook Documentation](https://www.pagerduty.com/resources/learn/what-is-a-runbook/)
- [Architecture Decision Records](https://adr.github.io/)

## Tips

- Keep failure modes updated when you discover new issues in production
- Link runbooks to specific failure modes, not just services
- Include both automated remediation steps and manual escalation paths
- Use CALM during actual incidents - it learns from your architecture
- The more metadata you add, the better CALM can assist with troubleshooting
- Consider adding post-incident learnings back into the failure-modes metadata

## Next Steps

Tomorrow (Day 16) you'll use docify to generate operations documentation - runbooks, on-call guides, and incident report templates from your architecture metadata! This shows how the CALM Chatmode and documentation capabilities of CALM all work from the same source of truth, your CALM architecture! 
