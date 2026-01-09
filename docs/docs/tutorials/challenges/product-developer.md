---
id: product-developer
title: "Product Developer Challenge"
sidebar_position: 3
---

# Product Developer Challenge

🏆 **Challenge** | 🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 45-60 minutes

## Prerequisites

Before starting this challenge, complete these tutorials:

| Tutorial | Why It's Needed |
|----------|-----------------|
| [Beginner Tutorials 1-7](../beginner) | Core CALM modeling skills |
| [Define Controls](../../how-to/modeling/controls) | Adding security and compliance controls |
| [Model Business Flows](../../how-to/modeling/flows) | Documenting system flows |
| [Generate Documentation](../../how-to/documentation/docify) | Using docify to generate docs |

:::tip Stuck?
Each task below includes progressive hints and a reference solution. Start with the task, try hints if stuck, and check the solution only as a last resort.
:::

## Scenario

You're a **Senior Developer** on the Payments team. You need to create a new service that follows organizational patterns, passes all governance checks, and includes proper documentation.

## Your Deliverables

1. **Create an architecture** for a subscription billing feature
2. **Ensure compliance** with organizational patterns
3. **Generate documentation** for operations team
4. **Submit for review** through proper governance process

## Challenge Requirements

### Part 1: Understand Existing Patterns (15 min)

Imagine your organization has these patterns available:
- `patterns/payment-service-pattern.json` (from Enterprise Architect challenge)
- `patterns/microservice-pattern.json`

Review what components are required, what controls must be implemented, and what relationships are expected.

<details>
<summary>💡 Hint: If you haven't created patterns</summary>

If you skipped the Enterprise Architect challenge, use this sample pattern:

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/payment-service",
  "nodes": [
    { "unique-id": "api", "node-type": "service" },
    { "unique-id": "processor", "node-type": "service" },
    { "unique-id": "database", "node-type": "database" },
    { "unique-id": "audit", "node-type": "service" }
  ]
}
```
</details>

### Part 2: Design Your Feature (30 min)

Build a **Subscription Billing Service** that:
- Accepts subscription requests via API
- Processes recurring payments
- Stores billing history
- Sends notifications

**Task 2.1: Create Architecture**

Create `architectures/subscription-billing.json` with:
- API endpoint
- Billing processor
- Subscription database
- Notification service
- Audit logging
- All required controls

<details>
<summary>💡 Hint 1: Starting Structure</summary>

Start with the basic CALM structure:

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/architectures/subscription-billing",
  "nodes": [],
  "relationships": []
}
```
</details>

<details>
<summary>💡 Hint 2: Required Controls</summary>

Payment services typically need these controls:

```json
"controls": {
  "authentication": { "mechanism": "OAuth2" },
  "encryption": { "at-rest": true, "in-transit": "TLS1.3" },
  "audit-logging": { "enabled": true }
}
```
</details>

<details>
<summary>✅ Reference Solution</summary>

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/architectures/subscription-billing",
  "title": "Subscription Billing Service",
  "description": "Handles recurring subscription payments",
  "nodes": [
    {
      "unique-id": "billing-api",
      "name": "Billing API",
      "description": "REST API for subscription management",
      "node-type": "service",
      "controls": {
        "authentication": { "mechanism": "OAuth2" },
        "encryption": { "in-transit": "TLS1.3" }
      }
    },
    {
      "unique-id": "billing-processor",
      "name": "Billing Processor",
      "description": "Processes recurring payments",
      "node-type": "service"
    },
    {
      "unique-id": "subscription-db",
      "name": "Subscription Database",
      "description": "Stores subscription and billing history",
      "node-type": "database",
      "controls": {
        "encryption": { "at-rest": true }
      }
    },
    {
      "unique-id": "notification-service",
      "name": "Notification Service",
      "description": "Sends billing notifications to customers",
      "node-type": "service"
    },
    {
      "unique-id": "audit-service",
      "name": "Audit Service",
      "description": "Logs all billing operations",
      "node-type": "service"
    }
  ],
  "relationships": [
    {
      "unique-id": "api-to-processor",
      "relationship-type": {
        "connects": {
          "source": { "node": "billing-api" },
          "destination": { "node": "billing-processor" }
        }
      }
    },
    {
      "unique-id": "processor-to-db",
      "relationship-type": {
        "connects": {
          "source": { "node": "billing-processor" },
          "destination": { "node": "subscription-db" }
        }
      }
    },
    {
      "unique-id": "processor-to-notifications",
      "relationship-type": {
        "connects": {
          "source": { "node": "billing-processor" },
          "destination": { "node": "notification-service" }
        }
      }
    },
    {
      "unique-id": "processor-to-audit",
      "relationship-type": {
        "connects": {
          "source": { "node": "billing-processor" },
          "destination": { "node": "audit-service" }
        }
      }
    }
  ]
}
```
</details>

**Task 2.2: Define Business Flows**

Document key flows:
- Subscription creation flow
- Payment processing flow
- Cancellation flow

<details>
<summary>💡 Hint: Flow Structure</summary>

Flows describe the sequence of operations:

```json
"flows": [
  {
    "unique-id": "subscription-creation",
    "name": "Create Subscription",
    "steps": [
      { "step": 1, "description": "Customer submits subscription request" },
      { "step": 2, "description": "API validates payment method" },
      { "step": 3, "description": "Processor creates subscription record" }
    ]
  }
]
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Add to your architecture JSON:

```json
"flows": [
  {
    "unique-id": "subscription-creation",
    "name": "Create Subscription",
    "description": "Flow for creating a new subscription",
    "steps": [
      { "step": 1, "node": "billing-api", "description": "Receive subscription request" },
      { "step": 2, "node": "billing-processor", "description": "Validate payment method" },
      { "step": 3, "node": "subscription-db", "description": "Store subscription record" },
      { "step": 4, "node": "notification-service", "description": "Send confirmation email" },
      { "step": 5, "node": "audit-service", "description": "Log subscription creation" }
    ]
  },
  {
    "unique-id": "payment-processing",
    "name": "Process Recurring Payment",
    "description": "Flow for processing scheduled payments",
    "steps": [
      { "step": 1, "node": "billing-processor", "description": "Trigger scheduled payment" },
      { "step": 2, "node": "subscription-db", "description": "Retrieve payment details" },
      { "step": 3, "node": "billing-processor", "description": "Process payment" },
      { "step": 4, "node": "notification-service", "description": "Send receipt" },
      { "step": 5, "node": "audit-service", "description": "Log payment" }
    ]
  }
]
```
</details>

### Part 3: Validate Compliance (20 min)

**Task 3.1: Run Validation**

```bash
calm validate \
  --architecture architectures/subscription-billing.json \
  --pattern patterns/payment-service-pattern.json
```

<details>
<summary>💡 Hint: Understanding Validation Output</summary>

The CLI will show:
- ✅ Passed checks (nodes and relationships that match the pattern)
- ❌ Failed checks (missing required elements)
- ⚠️ Warnings (potential issues)

If validation fails, read the error messages carefully—they tell you exactly what's missing.
</details>

**Task 3.2: Fix Issues**

Address any validation failures:
- Missing required controls
- Missing nodes or relationships
- Documentation gaps

<details>
<summary>💡 Hint: Common Fixes</summary>

**Missing controls?** Add the `controls` object to your nodes.

**Missing audit?** Make sure you have an audit service and relationship.

**Missing encryption?** Add encryption controls to database nodes:

```json
"controls": {
  "encryption": { "at-rest": true }
}
```
</details>

<details>
<summary>✅ Reference: Passing Validation</summary>

If your architecture includes:
- All nodes from the pattern (api, processor, database, audit)
- All required relationships
- Required controls (authentication, encryption)

...it should pass validation. If not, compare your architecture to the reference solution in Task 2.1.
</details>

### Part 4: Generate Documentation (15 min)

**Task 4.1: Create Ops Documentation**

Use docify to generate:
- Service runbook
- Deployment checklist
- Architecture overview

<details>
<summary>💡 Hint 1: Basic Docify Command</summary>

```bash
calm docify --architecture architectures/subscription-billing.json --output docs/
```

This generates a documentation website from your architecture.
</details>

<details>
<summary>💡 Hint 2: Custom Template</summary>

For a runbook, create a template like `templates/runbook.md`:

```markdown
# {{ title }} Runbook

## Overview
{{ description }}

## Components
{{#each nodes}}
- **{{ name }}**: {{ description }}
{{/each}}

## Operational Procedures
...
```

Then run:
```bash
calm docify --input templates/runbook.md --output docs/runbook.md --architecture architectures/subscription-billing.json
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `templates/runbook.md`:

```markdown
# {{ title }} Runbook

## Service Overview
{{ description }}

## Architecture Components

| Component | Type | Description |
|-----------|------|-------------|
{{#each nodes}}
| {{ name }} | {{ node-type }} | {{ description }} |
{{/each}}

## Key Flows

{{#each flows}}
### {{ name }}
{{ description }}

{{#each steps}}
{{ step }}. {{ description }}
{{/each}}

{{/each}}

## Monitoring & Alerts

TODO: Define monitoring dashboards and alert thresholds

## Incident Response

TODO: Define escalation procedures
```

Then generate:
```bash
calm docify --input templates/runbook.md --output docs/billing-runbook.md --architecture architectures/subscription-billing.json
```

See [Generate Documentation](../../how-to/documentation/docify) for more details.
</details>

**Task 4.2: Visualize Architecture**

Use the VSCode extension to view and export your architecture diagram.

<details>
<summary>💡 Hint: VSCode Preview</summary>

1. Open your architecture JSON in VSCode
2. Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
3. Type "CALM: Open Preview"
4. Your architecture will render as a diagram
</details>

### Part 5: Submit for Review (10 min)

**Task 5.1: Create ADR**

Document your key decisions:
- Why you chose this structure
- Trade-offs considered
- Any pattern deviations

<details>
<summary>💡 Hint: ADR Structure</summary>

```markdown
# ADR-001: Subscription Billing Architecture

## Status
Proposed

## Context
We need to implement subscription billing for our platform...

## Decision
We will follow the Payment Service Pattern with these additions...

## Consequences
...
```
</details>

<details>
<summary>✅ Reference Solution</summary>

Create `adrs/subscription-billing.md`:

```markdown
# ADR: Subscription Billing Architecture

## Status
Proposed

## Context
The platform needs to support recurring subscription billing. We need to:
- Process scheduled payments automatically
- Maintain billing history for compliance
- Send timely notifications to customers

## Decision
We will implement the Subscription Billing Service following the Payment Service Pattern, with the addition of:
- **Notification Service** - for customer communications
- **Business Flows** - documenting key operational sequences

## Alternatives Considered

### Option A: Extend existing payment service
Rejected: Would add complexity to critical payment path

### Option B: Third-party billing service
Rejected: Compliance requirements mandate data residency

## Consequences

### Positive
- Consistent with organizational patterns
- Passes all governance validations
- Clear audit trail for compliance

### Negative
- Additional service to maintain
- Requires coordination with notification team
```
</details>

**Task 5.2: Prepare PR**

Your submission should include:
- Architecture JSON file
- ADR for key decisions
- Generated documentation
- Passing validation

## Validation Checklist

- [ ] Architecture follows organizational pattern
- [ ] All validation rules pass
- [ ] Business flows documented
- [ ] Operations documentation generated
- [ ] ADR created for key decisions
- [ ] Architecture visualized

## Success Criteria

Your solution should:

1. **Be Compliant** - Pass all organizational standards
2. **Be Complete** - Include all required components
3. **Be Documented** - Ops team can understand it
4. **Be Reviewable** - Architecture team can approve

## Hints

<details>
<summary>🆘 Need more help?</summary>

If you're stuck after trying the task-specific hints:

1. **Review the prerequisites** - Make sure you've completed the linked tutorials
2. **Check the Advent of CALM** - Days 1-10 cover core modeling concepts
3. **Ask the community** - [GitHub Discussions](https://github.com/finos/architecture-as-code/discussions)

</details>

## Reflection Questions

1. How did using patterns speed up your design?
2. What was caught by validation that you might have missed?
3. How would you improve the patterns for your use case?

## Related Guides

- [Define Controls](../../how-to/modeling/controls)
- [Model Business Flows](../../how-to/modeling/flows)
- [Generate Documentation](../../how-to/documentation/docify)

## Next Challenge

Continue to [Security SME Challenge](security-sme) →
