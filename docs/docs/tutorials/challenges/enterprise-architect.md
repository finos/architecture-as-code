---
id: enterprise-architect
title: "Enterprise Architect Challenge"
sidebar_position: 2
---

# Enterprise Architect Challenge

🏆 **Challenge** | ⏱️ **Time:** 90 minutes | 🔴 **Difficulty:** Advanced

## Scenario

You are the **Chief Architect** at a growing fintech company. Your mission is to establish architecture governance that enables teams to move fast while maintaining quality and compliance.

## Your Deliverables

1. **Define core architecture patterns** for your organization
2. **Create compliance standards** that enforce security and documentation requirements
3. **Set up validation workflow** for CI/CD integration
4. **Document key decisions** in ADRs

## Challenge Requirements

### Part 1: Define Core Patterns (30 min)

Create patterns for standard architectures in your organization.

**Task 1.1: Payment Service Pattern**

Create `patterns/payment-service-pattern.json` with:
- Payment API service
- Payment processor
- Audit logging
- Database
- Required security controls

**Task 1.2: Data Pipeline Pattern**

Create `patterns/data-pipeline-pattern.json` with:
- Data ingestion service
- Processing service
- Data warehouse
- Audit logging

### Part 2: Establish Governance (30 min)

**Task 2.1: Create Compliance Standard**

Create `standards/fintech-compliance.json` with requirements:
- All services handling financial data must have encryption
- All external APIs must have authentication
- All database access must be audited
- Data retention policies must be documented

**Task 2.2: Create Operational Standard**

Create `standards/operational-requirements.json` with:
- High availability (minimum replicas)
- Disaster recovery (backup requirements)
- Monitoring (required metrics)

### Part 3: Validation Workflow (20 min)

**Task 3.1: Create Production Profile**

Create `validation/production-profile.json` that includes all your standards.

**Task 3.2: Create CI/CD Workflow**

Create `.github/workflows/validate.yml` that:
- Validates all architectures on PR
- Generates compliance reports
- Blocks merge if validation fails

### Part 4: Document Decisions (10 min)

Create ADRs documenting:
- Why you chose these patterns
- Why you chose these standards
- What trade-offs were considered

## Validation Checklist

- [ ] Created at least 2 organizational patterns
- [ ] Defined compliance standards with 5+ requirements
- [ ] Created operational standards
- [ ] Set up validation profile
- [ ] CI/CD workflow validates architectures
- [ ] ADRs document key decisions

## Success Criteria

Your solution should:

1. **Enable Consistency** - Teams can create compliant architectures easily
2. **Enforce Governance** - Non-compliant architectures are caught early
3. **Support Audits** - Documentation supports regulatory requirements
4. **Scale** - New teams can onboard quickly

## Hints

<details>
<summary>Hint 1: Pattern Structure</summary>

Start with the most common architecture. What components does every service need?

```json
{
  "nodes": [
    { "unique-id": "{{ SERVICE }}", "node-type": "service" },
    { "unique-id": "{{ SERVICE }}-db", "node-type": "database" },
    { "unique-id": "{{ SERVICE }}-audit", "node-type": "service" }
  ]
}
```
</details>

<details>
<summary>Hint 2: Compliance Requirements</summary>

For fintech, focus on:
- Data encryption at rest and in transit
- Authentication on all external endpoints
- Audit logging for all data access
- Data residency requirements
</details>

## Reflection Questions

1. How would you handle exceptions to standards?
2. How would you version patterns as they evolve?
3. How would you measure adoption across teams?

## Related Guides

- [Create Patterns](../../how-to/governance/patterns)
- [Define Standards](../../how-to/governance/standards)
- [Multi-Pattern Validation](../../how-to/governance/multi-pattern-validation)

## Next Challenge

Continue to [Product Developer Challenge](product-developer) →
