# Day 8: Add Controls for Non-Functional Requirements

## Overview
Document security, performance, and compliance requirements using CALM's controls feature to capture non-functional requirements (NFRs).

## Objective and Rationale
- **Objective:** Add security and performance controls to your e-commerce architecture to document non-functional requirements
- **Rationale:** Controls enable you to capture non-functional requirements (NFRs) by documenting security, compliance, performance, and operational needs. They connect technical architectures to regulatory and policy frameworks, making compliance auditable and NFRs explicit and traceable.

## Requirements

### 1. Understand Controls

Controls in CALM consist of:
- **Domain key:** Category (e.g., `security`, `compliance`, `performance`, `operational`)
- **Description:** What the control addresses
- **Requirements:** Array of requirement specifications with:
  - `requirement-url`: Link to the requirement definition
  - Plus ONE of:
    - `config-url`: Link to external configuration, OR
    - `config`: Inline configuration object

> **Important:** Each requirement MUST specify how it's implemented - either via `config-url` or inline `config`. This enforces that controls are not just declared but actually configured.

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

### 7. Create Documentation

For the purposes of your learning record, create a document detailing the purpose of controls.

Later on in your Advent of CALM journey we will explore getting CALM to create documentation detailing your architecture and its controls.

**File:** `docs/controls-guide.md`

**Content:**
```markdown
# CALM Controls Guide

## Purpose
Controls document non-functional requirements (NFRs) including security, compliance, performance, and operational needs in architecture.

## Control Domains

| Domain | Purpose | Example Requirements |
|--------|---------|---------------------|
| security | Data protection, access control | Encryption, TLS, authentication |
| compliance | Regulatory adherence | PCI-DSS, GDPR, SOC2 |
| performance | Non-functional requirements | SLAs, rate limits, availability |
| operational | Runtime concerns | Logging, monitoring, backup |

## Controls in This Architecture

### Architecture-Level Controls

**Security**
- Encryption at rest: https://internal-policy.example.com/security/encryption-at-rest (inline config)
- TLS 1.3 minimum: https://configs.example.com/security/tls-config.yaml

**Performance**
- Response time SLA: https://internal-policy.example.com/performance/response-time-sla (inline config)
- Availability target: https://configs.example.com/infra/ha-config.yaml

### Node-Level Controls

**Payment Service - Compliance**
- PCI-DSS: https://www.pcisecuritystandards.org/documents/PCI-DSS-v4.0
- Configuration: https://configs.example.com/compliance/pci-dss-config.json

**API Gateway - Performance**
- Rate limiting: https://configs.example.com/gateway/rate-limits.yaml
- Caching policy: https://internal-policy.example.com/performance/caching-policy (inline config)

## Benefits

1. **Audit Trail:** Links architecture to compliance requirements
2. **NFR Tracking:** Makes non-functional requirements explicit and measurable
3. **Traceability:** Connects technical implementation to policy
4. **SLA Documentation:** Makes performance requirements explicit and trackable
```

### 8. Update Your README

Mark Day 8 as complete in your progress checklist and add a short note about the new controls plus a link to `docs/controls-guide.md` so collaborators know where to find the governance details.

### 9. Commit Your Work

```bash
git add architectures/ecommerce-platform.json docs/controls-guide.md README.md
git commit -m "Day 8: Add security and performance controls for NFRs"
git tag day-8
```

## Deliverables

✅ **Required:**
- `architectures/ecommerce-platform.json` - With architecture and node-level controls (security + performance)
- `docs/controls-guide.md` - Control documentation
- Updated `README.md` - Day 8 marked complete

✅ **Validation:**
```bash
# Verify controls exist in architecture
grep -q '"controls"' architectures/ecommerce-platform.json

# Verify security control
grep -A 5 '"security"' architectures/ecommerce-platform.json | grep -q 'encryption'

# Verify performance control
grep -A 5 '"performance"' architectures/ecommerce-platform.json | grep -q 'response-time\|rate-limiting'

# Verify compliance control
grep -A 5 '"compliance"' architectures/ecommerce-platform.json | grep -q 'PCI-DSS'

# Validate
calm validate -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-8"
```

## Resources
- [CALM Controls Schema](https://github.com/finos/architecture-as-code/blob/main/calm/draft/2025-03/meta/control.json)
- [PCI-DSS Standards](https://www.pcisecuritystandards.org/)

## Tips
- Use meaningful URLs that point to actual policy documents
- Controls make architecture auditable and traceable to non-functional requirements
- Consider controls for: authentication, authorization, data retention, logging, latency, throughput
- NFRs captured in controls help teams understand and validate system quality attributes

## Next Steps
Tomorrow (Day 9) you'll model business flows through your architecture, connecting business processes to technical components!
