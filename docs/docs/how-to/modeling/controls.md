---
id: controls
title: Define Controls
sidebar_position: 2
---

# How to Define Controls

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 20-30 minutes

Controls capture non-functional requirements (NFRs) in your CALM architecture, such as security, performance, compliance, and reliability requirements.

## When to Use This

Use controls when you need to:
- Document security requirements (authentication, encryption)
- Specify performance targets (latency, throughput)
- Track compliance requirements (PCI-DSS, SOC2, GDPR)
- Define reliability expectations (availability, disaster recovery)

## Quick Start

Add a `controls` array to any node:

```json
{
  "unique-id": "api-gateway",
  "name": "API Gateway",
  "node-type": "service",
  "controls": [
    {
      "unique-id": "auth-control",
      "name": "Authentication Required",
      "description": "All requests must be authenticated via OAuth2"
    }
  ]
}
```

## Step-by-Step

### 1. Identify Control Categories

Common control categories:

| Category | Examples |
|----------|----------|
| **Security** | Authentication, authorization, encryption |
| **Performance** | Latency SLA, throughput, resource limits |
| **Compliance** | PCI-DSS, GDPR, SOC2, HIPAA |
| **Reliability** | Availability SLA, backup, DR |
| **Operational** | Monitoring, logging, alerting |

### 2. Add Security Controls

```json
{
  "unique-id": "payment-service",
  "name": "Payment Service",
  "node-type": "service",
  "controls": [
    {
      "unique-id": "ctrl-authn",
      "name": "Authentication",
      "description": "OAuth2 with JWT tokens required for all endpoints",
      "requirements": ["SEC-001"]
    },
    {
      "unique-id": "ctrl-authz",
      "name": "Authorization",
      "description": "Role-based access control for payment operations",
      "requirements": ["SEC-002"]
    },
    {
      "unique-id": "ctrl-encryption",
      "name": "Encryption",
      "description": "TLS 1.3 for all connections, AES-256 for data at rest",
      "requirements": ["SEC-003", "SEC-004"]
    }
  ]
}
```

### 3. Add Performance Controls

```json
{
  "controls": [
    {
      "unique-id": "ctrl-latency",
      "name": "Latency SLA",
      "description": "P99 latency must be under 200ms"
    },
    {
      "unique-id": "ctrl-throughput",
      "name": "Throughput",
      "description": "Must handle 10,000 requests per second"
    }
  ]
}
```

### 4. Add Compliance Controls

```json
{
  "controls": [
    {
      "unique-id": "ctrl-pci",
      "name": "PCI-DSS Compliance",
      "description": "Service handles cardholder data per PCI-DSS requirements",
      "requirements": ["PCI-REQ-3.4", "PCI-REQ-6.5"]
    },
    {
      "unique-id": "ctrl-gdpr",
      "name": "GDPR Data Handling",
      "description": "Personal data handling complies with GDPR Articles 5 and 6"
    }
  ]
}
```

### 5. Validate Controls

Run the CLI to validate your controls:

```bash
calm validate --architecture your-architecture.json
```

## Control Schema Reference

```json
{
  "unique-id": "string (required)",
  "name": "string (required)",
  "description": "string (optional)",
  "requirements": ["array", "of", "requirement-ids"],
  "implementation-status": "implemented | planned | not-applicable"
}
```

## Best Practices

:::tip Be Specific
Instead of "must be secure", specify "OAuth2 authentication with JWT tokens"
:::

:::tip Link to Requirements
Use the `requirements` field to trace controls back to compliance frameworks or internal policies
:::

:::tip Review Regularly
Controls should be reviewed as requirements evolve
:::

## Related Guides

- [Model Business Flows](flows) - Document how data flows through controlled services
- [Define Standards](../governance/standards) - Create validation rules for controls
