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

Complete the [Beginner Tutorials](../beginner/07-complete-architecture) section first. You will need your `architectures/ecommerce-platform.json` from the [Build a Complete Architecture](../beginner/07-complete-architecture) lesson.

## Step-by-Step Guide

### 1. Understand Controls

Controls in CALM consist of:
- **Domain key:** Category (e.g., `security`, `compliance`, `performance`, `operational`)
- **Description:** What the control addresses
- **Requirements:** Array of requirement specifications with:
  - `requirement-url`: Reference to a JSON Schema that validates the configuration
  - Plus ONE of:
    - `config-url`: Link to external configuration, OR
    - `config`: Inline configuration object

> **Important:** Each requirement MUST specify how it's implemented — either via `config-url` or inline `config`. This enforces that controls are not just declared but actually configured.

Controls can be applied at multiple levels:
- **Architecture level:** Apply to the entire system
- **Node level:** Apply to specific components
- **Relationship level:** Apply to specific connections between components
- **Flow level:** Apply to business processes and data flows

The examples below use CALM's published [control requirement schema](https://calm.finos.org/release/1.2/meta/control-requirement.json). It requires `control-id`, `name`, and `description`. Validation checks the documented configuration, not whether the running system meets the requirement. Use a more specific schema when you need to constrain settings such as encryption algorithms or latency limits.

### 2. Add an Architecture-Level Security Control

Open your `architectures/ecommerce-platform.json` from the [Build a Complete Architecture](../beginner/07-complete-architecture) lesson.

Create `controls/tls-config.json` in your tutorial project with this content:

```json title="controls/tls-config.json"
{
  "$id": "controls/tls-config.json",
  "$schema": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
  "control-id": "SEC-002",
  "name": "TLS minimum version",
  "description": "All external connections use TLS 1.3 or later"
}
```

The `$id` lets the CLI load this local configuration. Run the validation command from your tutorial project root so that `controls/tls-config.json` resolves correctly.

**Prompt:**
```text
Add a controls section at the top level of architectures/ecommerce-platform.json

Add a "security" control with:
- description: "Data encryption and secure communication requirements"
- requirements array with two items:
  1. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config (inline): { "control-id": "SEC-001", "name": "Encryption at rest", "description": "All data stores use AES-256 encryption at rest" }
  2. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config-url: "controls/tls-config.json"

Place it after the metadata section and before nodes.
```

### 3. Add an Architecture-Level Performance Control

**Prompt:**
```text
Add a "performance" control at the architecture level of architectures/ecommerce-platform.json

Add with:
- description: "System-wide performance and scalability requirements"
- requirements array with two items:
  1. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config (inline): { "control-id": "PERF-001", "name": "Response time", "description": "Response latency is at most 200 ms at p99 and 100 ms at p95" }
  2. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config (inline): { "control-id": "PERF-002", "name": "Availability", "description": "The platform targets 99.9% availability" }

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
  - requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
    config (inline): { "control-id": "COMP-001", "name": "Payment compliance", "description": "Payment processing must meet PCI-DSS v4.0 requirements" }
```

### 5. Add a Node-Level Performance Control

Add a performance control to the `api-gateway` node.

**Prompt:**
```text
Add a controls section to the api-gateway node in architectures/ecommerce-platform.json

Add a "performance" control with:
- description: "API Gateway rate limiting and caching requirements"
- requirements array with two items:
  1. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config (inline): { "control-id": "PERF-003", "name": "Rate limiting", "description": "Limit each client to 100 requests per second" }
  2. requirement-url: "https://calm.finos.org/release/1.2/meta/control-requirement.json"
     config (inline): { "control-id": "PERF-004", "name": "Caching", "description": "Use a default TTL of 300 seconds and private cache control" }
```

### 6. Validate

```bash
calm validate -a architectures/ecommerce-platform.json
```

The architecture and all seven control requirements should pass validation. If a control fails, check that its configuration has all three required fields and that `controls/tls-config.json` exists.

Now is a good time to use git to snapshot your progress. Stage your changes and commit them with a meaningful message before moving on.

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
      "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
      "config": { "control-id": "SEC-001", "name": "Encryption at rest", "description": "All data stores use AES-256 encryption at rest" }
    },
    {
      "requirement-url": "https://calm.finos.org/release/1.2/meta/control-requirement.json",
      "config-url": "controls/tls-config.json"
    }
  ]
}
```

This example reuses the TLS configuration file from step 2.

Use **inline `config`** for simple, self-contained settings. Use **`config-url`** when configuration is managed externally or is too complex to inline.

### Multi-Level Controls

Controls can be placed at four levels:
- **Architecture level** — system-wide requirements
- **Node level** — component-specific requirements
- **Relationship level** — connection-specific requirements
- **Flow level** — business-process-specific requirements

## Resources

- [CALM Controls Schema](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.2/meta/control.json)
- [PCI-DSS Standards](https://www.pcisecuritystandards.org/)

## Next Steps

In the [next tutorial](./09-business-flows), you'll model business flows that trace how business processes traverse your architecture!
