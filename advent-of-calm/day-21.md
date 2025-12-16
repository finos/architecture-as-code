# Day 21: The Platform Team Challenge — Enterprise Architect

## Overview

Welcome to the final week of Advent of CALM! Over the past twenty days, you've built a comprehensive toolkit of architecture-as-code skills:

| Week | What You Learned |
|------|------------------|
| **Week 1** | Core building blocks — nodes, relationships, interfaces, metadata |
| **Week 2** | Advanced features — controls, flows, ADRs, documentation, AI assistance |
| **Week 3** | Governance — patterns, standards, multi-pattern validation |

Now it's time to put it all together.

Days 21-23 form a **three-day mini-project** that simulates real enterprise workflows. Instead of step-by-step instructions, you'll receive high-level requirements and apply everything you've learned. This is your chance to prove — to yourself — that you can use CALM independently.

## The Scenario: Acme Corp's Notification Service

**Background:** Acme Corp is building an internal Notification Service to handle alerts across the organization. Over the next three days, you'll experience how different personas collaborate using CALM:

| Day | Persona | Responsibility |
|-----|---------|----------------|
| **21** | Enterprise Architect | Define standards and patterns |
| **22** | Product Developer | Build within guardrails |
| **23** | Security SME | Review and approve |

This scenario is intentionally different from the e-commerce system you built earlier — proving you can apply CALM to any domain.

## Objective and Rationale
- **Objective:** Create enterprise governance artifacts (standards and patterns) that the Notification Service team will use tomorrow
- **Rationale:** In real enterprises, architects don't build individual systems — they define the guardrails that enable teams to build consistent, compliant systems. Your patterns and standards become the "paved road" that makes doing the right thing easy.

## Your Brief

**From the CTO:**
> "We're launching a new Notification Service initiative. Before the product team starts, I need you to define how notification services should be built at Acme Corp. Create the governance framework they'll work within. Consider our enterprise needs: cost tracking, ownership clarity, and security classification on all data flows."

## Requirements

This day is intentionally **less prescriptive** than earlier days. You have the skills — now apply them.

### Your Secret Weapon: CALM Copilot

You're not alone in this challenge. CALM Copilot is your expert Architecture SME — use it throughout this mini-project to:

**Design your standards:**
```text
I'm creating node standards for Acme Corp. We need to track:
- Cost allocation for FinOps
- Ownership for incident response
- Environment classification
- Data sensitivity

Suggest what properties I should require and their appropriate types/enums.
```

**Get your patterns critiqued:**
```text
Review standards/acme-node-standard.json.

As an experienced Enterprise Architect, critique this standard:
- Are the required properties appropriate for enterprise governance?
- What's missing that most organizations would need?
- Is it too strict or too lenient?
- How would this scale to 50+ teams?
```

**Ask architecture questions:**
```text
I'm designing a notification service pattern. Help me think through:
- What components are essential for any notification service?
- Should I require specific delivery channels or leave that flexible?
- How do I balance prescriptiveness with team autonomy?
```

**Validate your thinking:**
```text
I've designed my standards with 5 required properties per node.
Play devil's advocate — is this too many? Too few?
What problems might teams encounter with these requirements?
```

Think of CALM Copilot as a senior architect you can bounce ideas off at any time. It understands CALM deeply and can help you design better governance frameworks. **Use it liberally throughout Days 21-23.**

### 1. Design Acme Corp Node Standards

Create a standard that defines required properties for ALL nodes at Acme Corp.

**Consider:**
- How will Finance track costs? (cost center allocation)
- Who's responsible when something breaks? (ownership)
- What environment is this? (dev/staging/prod)
- Is there sensitive data? (data classification)
- How do we contact the team? (Slack channel, PagerDuty, etc.)

**Deliverable:** `standards/acme-node-standard.json`

**Hints:**
- Review your work from Day 18 for the structure
- Use `allOf` to extend the base CALM node
- Make sure required properties are actually required
- Give it a proper `$id` URL (e.g., `https://acme.com/standards/...`)

### 2. Design Acme Corp Relationship Standards

Create a standard that defines required properties for ALL relationships at Acme Corp.

**Consider:**
- Is data encrypted in transit?
- What's the data classification of this connection?
- What's the expected SLA?
- Is this synchronous or asynchronous?

**Deliverable:** `standards/acme-relationship-standard.json`

### 3. Create the Notification Service Pattern

Design a pattern that defines the **required structure** for any notification service at Acme Corp.

**Think about what a notification service needs:**
- How do external systems send notifications? (API layer)
- How are messages processed? (processing layer)
- Where are messages stored? (persistence)
- How do notifications reach users? (delivery channels)

**Minimum required components:**
- API Gateway or notification API endpoint
- Message processor/queue handler
- At least 2 delivery channels (email, SMS, push, webhook — pick two)
- Message store for history/retry

**Deliverable:** `patterns/notification-service-pattern.json`

**Hints:**
- Review Day 17 for pattern structure
- Use `prefixItems` to require specific nodes
- Use `const` for fixed values like `unique-id`
- Don't include standard properties here — that's what multi-pattern validation is for!

### 4. Create the Base Standards Pattern

Create a pattern that enforces your Acme standards on any architecture (like `company-base-pattern.json` from earlier days).

**Deliverable:** `patterns/acme-base-pattern.json`

### 5. Update URL Mappings

Add all your new schemas to the URL mapping file so they can be resolved locally.

**Deliverable:** Updated `url-mapping.json`

### 6. Document the Governance Model

Create documentation explaining how product teams should use these artifacts.

**Include:**
- What standards exist and what they require
- What the notification service pattern enforces
- How to validate compliance (both structural and standards)
- The multi-pattern validation approach

**Deliverable:** `docs/acme-governance.md`

### 7. Test Your Governance Framework

Verify your patterns work correctly:

```bash
# Generate a scaffold from your pattern
calm generate -p patterns/notification-service-pattern.json -o /tmp/test-notification.json

# Structural validation should PASS
calm validate -p patterns/notification-service-pattern.json -a /tmp/test-notification.json

# Standards validation should FAIL (scaffold has no standard properties yet)
calm validate -p patterns/acme-base-pattern.json -a /tmp/test-notification.json -u url-mapping.json
```

The last command **should fail** — this is correct! The generated scaffold won't have your standard properties until a team adds them.

### 8. Commit Your Work

```bash
git add standards/ patterns/ url-mapping.json docs/acme-governance.md README.md
git commit -m "Day 21: Enterprise Architect - Acme Corp governance framework"
git tag day-21
```

## Deliverables / Validation Criteria

Your Day 21 submission should include a commit tagged `day-21` containing:

✅ **Required Files:**
- `standards/acme-node-standard.json` — Node property requirements
- `standards/acme-relationship-standard.json` — Relationship property requirements
- `patterns/notification-service-pattern.json` — Structural pattern for notification services
- `patterns/acme-base-pattern.json` — Standards enforcement pattern
- Updated `url-mapping.json` — All new schemas mapped
- `docs/acme-governance.md` — Governance documentation

✅ **Validation:**
```bash
# Pattern generates successfully
calm generate -p patterns/notification-service-pattern.json -o /tmp/test.json

# Generated scaffold passes structural validation
calm validate -p patterns/notification-service-pattern.json -a /tmp/test.json

# Standards pattern exists and is valid JSON
cat patterns/acme-base-pattern.json | jq .

# Check tag
git tag | grep -q "day-21"
```

## Tips

- **Think like an architect** — You're not building a system, you're enabling others to build consistent systems
- **Balance flexibility and control** — Too many requirements slow teams down, too few lead to chaos
- **Consider the audit question** — "Can we trace who owns this and what data it handles?"
- **Reuse your learning** — Days 17-20 taught you everything you need
- **Use CALM Chat** — Ask it to help design your standards and patterns

## Thinking Like an Enterprise Architect

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Enterprise Architect Mindset                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ❌ DON'T think: "How do I build the notification service?"               │
│                                                                             │
│   ✅ DO think: "What must ALL notification services have?"                 │
│                "What properties enable cost tracking?"                      │
│                "What properties enable incident response?"                  │
│                "How do I make compliance easy, not painful?"               │
│                                                                             │
│   Your artifacts become the "paved road" that teams follow.                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Reflection

- What's the right balance between governance and team autonomy?
- How would you handle teams that need exceptions to your standards?
- What happens when standards need to change?

## Next Steps

Tomorrow (Day 22) you'll switch personas to become a **Product Developer** on the Notification Service team. You'll use today's governance framework to build the actual service architecture!
