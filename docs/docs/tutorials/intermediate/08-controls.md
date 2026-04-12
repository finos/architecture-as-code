---
id: 08-controls
title: "Controls for Non-Functional Requirements"
sidebar_position: 2
---

# Controls for Non-Functional Requirements

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Document security, performance, and compliance requirements using CALM's controls feature to capture non-functional requirements (NFRs).

## Learning Objectives

By the end of this tutorial, you will:
- Understand the structure of CALM controls
- Add architecture-level and node-level controls
- Distinguish between inline `config` and external `config-url` implementations
- Know which control domains are available (security, compliance, performance, operational)

## Prerequisites

Complete the [Beginner Tutorials](../beginner/07-complete-architecture) section first. You will need your `architectures/ecommerce-platform.json` from Day 7.

## Step-by-Step Guide

### 1. Understand Controls

Controls in CALM consist of:
- **Domain key:** Category (e.g., `security`, `compliance`, `performance`, `operational`)
- **Description:** What the control addresses
- **Requirements:** Array of requirement specifications with:
  - `requirement-url`: Link to the requirement definition
  - Plus ONE of:
    - `config-url`: Link to external configuration, OR
    - `config`: Inline configuration object

> **Important:** Each requirement MUST specify how it's implemented — either via `config-url` or inline `config`. This enforces that controls are not just declared but actually configured.

Controls can be applied at multiple levels:
- **Architecture level:** Apply to the entire system
- **Node level:** Apply to specific components
- **Relationship level:** Apply to specific connections between components
- **Flow level:** Apply to business processes and data flows

### 2. Add an Architecture-Level Security Control

Open your `architectures/ecommerce-platform.json` from Day 7.

**Prompt:**
```text
Add a controls section at the top level of architectures/ecommerce-platform.json

Add a "security" control with:
- description: "Data encryption and secure communication requirements"
- requirements array with two items:
  1. requirement-url: "https://internal-policy.example.com/security/encryption-at-rest"
     config (inline): { "algorithm": "AES-256", "scope": "all-data-stores" }
  2. requirement-url: "https://internal-policy.example.com/security/tls-1-3-minimum"
     config-url: "https://configs.example.com/security/tls-config.yaml"

Place it after the metadata section and before nodes.
```

### 3. Add an Architecture-Level Performance Control

**Prompt:**
```text
Add a "performance" control at the architecture level of architectures/ecommerce-platform.json

Add with:
- description: "System-wide performance and scalability requirements"
- requirements array with two items:
  1. requirement-url: "https://internal-policy.example.com/performance/response-time-sla"
     config (inline): { "p99-latency-ms": 200, "p95-latency-ms": 100 }
  2. requirement-url: "https://internal-policy.example.com/performance/availability-target"
     config-url: "https://configs.example.com/infra/ha-config.yaml"

Place it alongside the security control in the controls section.
```

### 4. Add a Node-Level Compliance Control

Add a control to the `payment-service` node.

**Prompt:**
```text
Add a controls section to the payment-service node in architectures/ecommerce-platform.json

Add a "compliance" control with:
- description: "PCI-DSS compliance for payment processing"
- requirements array with one item:
  - requirement-url: "https://www.pcisecuritystandards.org/documents/PCI-DSS-v4.0"
    config-url: "https://configs.example.com/compliance/pci-dss-config.json"
```

### 5. Add a Node-Level Performance Control

Add a performance control to the `api-gateway` node.

**Prompt:**
```text
Add a controls section to the api-gateway node in architectures/ecommerce-platform.json

Add a "performance" control with:
- description: "API Gateway rate limiting and caching requirements"
- requirements array with two items:
  1. requirement-url: "https://internal-policy.example.com/performance/rate-limiting"
     config-url: "https://configs.example.com/gateway/rate-limits.yaml"
  2. requirement-url: "https://internal-policy.example.com/performance/caching-policy"
     config (inline): { "default-ttl-seconds": 300, "cache-control": "private" }
```

### 6. Validate

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 7. Commit Your Work

```bash
git add architectures/ecommerce-platform.json
git commit -m "Day 8: Add security and performance controls for NFRs"
git tag day-8
```

## Key Concepts

### Control Domains

| Domain | Purpose | Example Requirements |
|--------|---------|---------------------|
| `security` | Data protection, access control | Encryption, TLS, authentication |
| `compliance` | Regulatory adherence | PCI-DSS, GDPR, SOC2 |
| `performance` | Non-functional requirements | SLAs, rate limits, availability |
| `operational` | Runtime concerns | Logging, monitoring, backup |

### Inline Config vs Config URL

```json
{
  "requirements": [
    {
      "requirement-url": "https://policy.example.com/encryption",
      "config": { "algorithm": "AES-256", "scope": "all-data-stores" }
    },
    {
      "requirement-url": "https://policy.example.com/tls",
      "config-url": "https://configs.example.com/tls-config.yaml"
    }
  ]
}
```

Use **inline `config`** for simple, self-contained settings. Use **`config-url`** when configuration is managed externally or is too complex to inline.

### Multi-Level Controls

Controls can be placed at four levels:
- **Architecture level** — system-wide requirements
- **Node level** — component-specific requirements
- **Relationship level** — connection-specific requirements
- **Flow level** — business-process-specific requirements

## Resources

- [CALM Controls Schema](https://github.com/finos/architecture-as-code/blob/main/calm/draft/2025-03/meta/control.json)
- [PCI-DSS Standards](https://www.pcisecuritystandards.org/)

## Next Steps

In the [next tutorial](./09-business-flows), you'll model business flows that trace how business processes traverse your architecture!
