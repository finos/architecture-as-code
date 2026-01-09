---
id: product-developer
title: "Product Developer Challenge"
sidebar_position: 3
---

# Product Developer Challenge

🏆 **Challenge** | ⏱️ **Time:** 90 minutes | 🟡 **Difficulty:** Intermediate

## Scenario

You're a **Senior Developer** on the Payments team. You need to create a new service that follows organizational patterns, passes all governance checks, and includes proper documentation.

## Your Deliverables

1. **Create an architecture** for a subscription billing feature
2. **Ensure compliance** with organizational standards
3. **Generate documentation** for operations team
4. **Submit for review** through proper governance process

## Challenge Requirements

### Part 1: Understand Existing Patterns (15 min)

Review available patterns:
- `patterns/payment-service-pattern.json`
- `patterns/microservice-pattern.json`

Understand:
- What components are required?
- What controls must be implemented?
- What relationships are expected?

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

**Task 2.2: Define Business Flows**

Document key flows:
- Subscription creation flow
- Payment processing flow
- Cancellation flow

### Part 3: Validate Compliance (20 min)

**Task 3.1: Run Validation**

```bash
calm validate \
  --architecture architectures/subscription-billing.json \
  --profile validation/production-profile.json
```

**Task 3.2: Fix Issues**

Address any validation failures:
- Missing required controls
- Naming convention violations
- Documentation gaps

### Part 4: Generate Documentation (15 min)

**Task 4.1: Create Ops Documentation**

Use docify to generate:
- Service runbook
- Deployment checklist
- Architecture diagram

**Task 4.2: Visualize Architecture**

Use VSCode extension to export architecture diagram.

### Part 5: Submit for Review (10 min)

**Task 5.1: Create ADR**

Document your key decisions:
- Why you chose this structure
- Trade-offs considered
- Pattern deviations (if any)

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
<summary>Hint 1: Starting from Pattern</summary>

Use the pattern as a starting point, then add feature-specific nodes:

```json
{
  "pattern-ref": "../patterns/payment-service-pattern.json",
  "nodes": [
    // Pattern nodes
    { "unique-id": "billing-api", ... },
    // Feature-specific
    { "unique-id": "notification-service", ... }
  ]
}
```
</details>

<details>
<summary>Hint 2: Required Controls</summary>

Payment services typically need:
```json
"controls": [
  { "type": "authentication", "mechanism": "OAuth2" },
  { "type": "encryption", "scope": "at-rest" },
  { "type": "encryption", "scope": "in-transit" },
  { "type": "audit-logging" }
]
```
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
