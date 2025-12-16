# Day 22: The Platform Team Challenge — Product Developer

## Overview
Continue the three-day mini-project by switching to the Product Developer persona. Using the governance framework created yesterday, build the actual Notification Service architecture.

## The Scenario Continues

| Day | Persona | Status |
|-----|---------|--------|
| 21 | Enterprise Architect | ✅ Complete — Governance framework ready |
| **22** | **Product Developer** | **Today — Build the service** |
| 23 | Security SME | Tomorrow — Review and approve |

## Objective and Rationale
- **Objective:** Build a complete Notification Service architecture that meets both business requirements AND enterprise governance standards
- **Rationale:** Real developers work within guardrails, not from scratch. You'll experience how good governance frameworks (patterns + standards) accelerate development while ensuring compliance.

## Your Brief

**From your Product Manager:**
> "We need a notification service that can send alerts via email and SMS. It needs to handle high volume (async processing), store message history for 30 days, and integrate with our existing Identity Provider for authentication. The mobile team also wants push notifications in Phase 2, so design with that in mind."

**From the Enterprise Architect (you, yesterday):**
> "Use the notification service pattern I created. Your architecture must pass both structural validation and standards validation. See docs/acme-governance.md for details."

## Requirements

### Your Assistant: CALM Copilot

Remember, CALM Copilot is here to help. As a Product Developer, use it to:

**Get guidance on fulfilling requirements:**
```text
I need to add Standard-compliant properties to all nodes in my architecture.
The Acme standards require costCenter, owner, and environment.

Show me how to add these properties to my notification-service.json nodes.
```

**Ask implementation questions:**
```text
How do I add an external system (IdP) to my architecture?
What node type should I use? How do I model the authentication relationship?
```

**Get help with flows:**
```text
I need to model a "User Registration Welcome Email" flow through my notification service.
The flow goes: External system → API → Processor → Email channel → Message store.

Help me write the flow JSON with proper step references.
```

**Review your work:**
```text
Review architectures/notification-service.json.

Check that it meets the Acme Corp standards from patterns/acme-base-pattern.json.
What's missing? What needs to be fixed before validation will pass?
```

Don't struggle in silence — ask questions whenever you're unsure how to proceed.

### 1. Generate Your Starting Point

Use the pattern from Day 21 to scaffold your architecture:

```bash
calm generate -p patterns/notification-service-pattern.json -o architectures/notification-service.json
```

Open the generated file and review what the pattern gave you. This is your starting point — now customize it.

### 2. Fill In Your Team's Details

The generated scaffold has placeholders. Replace them with real information:

**For each node, add:**
- Meaningful descriptions (not placeholders)
- Your team's cost center: `CC-5001`
- Owner: `notifications-team`
- Environment: `production`
- Contact: `#notifications-oncall` (Slack channel)
- Repository URLs (can be placeholders like `https://github.com/acme/notification-api`)

**For each relationship, add:**
- Clear descriptions of what data flows
- Data classification (think about what's being transmitted)
- Encryption: `true` for all
- Protocol information where relevant

### 3. Add External Dependencies

Your service doesn't exist in isolation. Add nodes and relationships for:

**Identity Provider (IdP):**
- The notification API must authenticate requests
- Add an IdP node (type: `system`)
- Add a relationship from your API to the IdP

**Consider:** What other external systems might a notification service need?

### 4. Add Interfaces

Ensure your nodes have appropriate interfaces:

- **Notification API:** REST endpoint for submitting notifications
- **Message Store:** Database connection interface
- **Delivery channels:** Appropriate interfaces for email (SMTP?), SMS (API?), etc.

### 5. Document an Architectural Decision

You need to decide: **synchronous or asynchronous processing?**

The PM mentioned "high volume" — create an ADR documenting your decision.

**Deliverable:** `docs/adr/003-async-notification-processing.md`

**Include:**
- Context: Why is this decision needed?
- Decision: What did you choose?
- Consequences: What are the trade-offs?

Then link this ADR in your architecture file.

### 6. Add a Business Flow

Model the "User Registration Welcome Email" flow through your architecture:

1. External system calls Notification API
2. API validates with IdP
3. Message processor queues the notification
4. Email channel sends the welcome email
5. Message store records the delivery

**Hints:**
- Review Day 9 for flow structure
- Each step needs a unique-id and references the relationship it uses

### 7. Add Operational Metadata

Your on-call team needs to know how to operate this service. Add metadata:

**At the architecture level:**
- Runbook URL
- Monitoring dashboard URL
- On-call rotation info

**At critical node level:**
- Deployment type (container, serverless, etc.)
- Scaling characteristics
- Health check endpoints

### 8. Validate Compliance

This is the moment of truth. Your architecture must pass BOTH validations:

```bash
# Structural validation — Does it have required components?
calm validate -p patterns/notification-service-pattern.json -a architectures/notification-service.json

# Standards validation — Does it have required properties?
calm validate -p patterns/acme-base-pattern.json -a architectures/notification-service.json -u url-mapping.json
```

**Both must pass!** If either fails:
1. Read the error messages carefully
2. Fix the issues
3. Re-validate
4. Repeat until both pass

### 9. Visualize and Review

Open your architecture in VSCode:
1. Open `architectures/notification-service.json`
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. Review the visualization — does it match your mental model?
4. Take a screenshot for your portfolio

### 10. Generate Documentation

```bash
calm docify -a architectures/notification-service.json -o docs/notification-service
```

Review the generated documentation — this is what you'd hand to the Security SME for review tomorrow.

### 11. Commit Your Work

```bash
git add architectures/notification-service.json docs/adr/003-async-notification-processing.md docs/notification-service README.md
git commit -m "Day 22: Product Developer - Notification Service architecture"
git tag day-22
```

## Deliverables / Validation Criteria

Your Day 22 submission should include a commit tagged `day-22` containing:

✅ **Required Files:**
- `architectures/notification-service.json` — Complete, compliant architecture
- `docs/adr/003-async-notification-processing.md` — ADR for async decision
- `docs/notification-service/` — Generated documentation
- Updated `README.md` — Day 22 marked as complete

✅ **Validation:**
```bash
# Structural validation passes
calm validate -p patterns/notification-service-pattern.json -a architectures/notification-service.json

# Standards validation passes
calm validate -p patterns/acme-base-pattern.json -a architectures/notification-service.json -u url-mapping.json

# ADR exists
test -f docs/adr/003-async-notification-processing.md

# Architecture has flows
grep -q '"flows"' architectures/notification-service.json

# Check tag
git tag | grep -q "day-22"
```

## Tips

- **Start from the scaffold** — Don't build from scratch, that's the whole point of patterns
- **Validate often** — Don't wait until the end to discover you're missing properties
- **Think about operations** — What would your on-call team need to know?
- **Use CALM Chat** — Ask it to help fill in details or review your architecture
- **Check the governance docs** — Your Enterprise Architect (yesterday you) wrote docs/acme-governance.md

## Thinking Like a Product Developer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Product Developer Mindset                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ❌ DON'T think: "These governance requirements are bureaucracy"          │
│                                                                             │
│   ✅ DO think: "The pattern gave me a head start"                          │
│                "Standards ensure I don't forget important details"          │
│                "Validation catches mistakes before security review"         │
│                "My architecture is automatically compliant"                 │
│                                                                             │
│   Good governance makes your job easier, not harder.                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Developer Checklist

Before submitting for security review, verify:

- [ ] All placeholder values replaced with real information
- [ ] All nodes have required standard properties
- [ ] All relationships have data classification and encryption info
- [ ] External dependencies (IdP) are documented
- [ ] At least one business flow is modeled
- [ ] ADR explains the async processing decision
- [ ] Both validations pass
- [ ] Documentation is generated

## Reflection

- How did the pattern accelerate your work?
- What would have been different without the governance framework?
- Did you discover any gaps in the Enterprise Architect's patterns?

## Next Steps

Tomorrow (Day 23) you'll switch personas again to become a **Security SME**. You'll review this architecture from a security perspective, identify gaps, add controls, and decide whether to approve it for production!
