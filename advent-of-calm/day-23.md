# Day 23: The Platform Team Challenge — Security SME

## Overview
Complete the three-day mini-project as a Security SME. Review the Notification Service architecture, identify security concerns, add controls, and make an approval decision.

## The Scenario Concludes

| Day | Persona | Status |
|-----|---------|--------|
| 21 | Enterprise Architect | ✅ Complete — Governance framework ready |
| 22 | Product Developer | ✅ Complete — Architecture built |
| **23** | **Security SME** | **Today — Review and approve** |

## Objective and Rationale
- **Objective:** Conduct a security review of the Notification Service architecture, add appropriate controls, and make an approval decision
- **Rationale:** Security reviews are a critical gate in enterprise architecture workflows. CALM enables security teams to assess architectures systematically, document concerns, add controls, and create an audit trail of the review process.

## Your Brief

**From your Security Manager:**
> "The Notification Service team has submitted their architecture for security review. Before they can proceed to implementation, you need to assess it for security risks, ensure appropriate controls are in place, and either approve it or send it back for remediation. Pay particular attention to PII handling — notifications often contain personal data."

**The architecture is at:** `architectures/notification-service.json`
**Governance docs are at:** `docs/acme-governance.md`

## Requirements

### 1. Initial Assessment with CALM Chat

Use CALM Chat to get an initial security assessment:

**Prompt:**
```text
Review architectures/notification-service.json from a security perspective.

Analyze:
1. Authentication and authorization mechanisms
2. Data in transit protection
3. Data at rest protection
4. PII handling (notifications often contain personal data)
5. Audit logging capabilities
6. Third-party integrations (IdP, SMS providers, etc.)

Identify potential security concerns and gaps.
```

**Document the response** — This becomes part of your security review record.

### 2. Verify Data Classifications

Review every relationship in the architecture:

| Relationship | Contains PII? | Current Classification | Appropriate? |
|--------------|--------------|------------------------|--------------|
| API to Processor | ? | ? | ? |
| Processor to Email | ? | ? | ? |
| Processor to SMS | ? | ? | ? |
| ... | ... | ... | ... |

**Consider:**
- Email addresses are PII
- Phone numbers are PII
- Message content may contain PII
- User IDs may be pseudonymous PII

Update any misclassified relationships. Anything carrying PII should be `confidential` or higher.

### 3. Add Security Controls

Add controls to address identified risks. Controls consist of a **control-requirement** (the what) and a **control-config** (the how). Your job is to apply each control at the most appropriate level.

> **Note:** In a real enterprise, each `control-requirement-url` would point to an actual document defining the security requirement in detail. For this exercise, we're providing the control configurations directly — but remember that creating and maintaining those requirement documents is an important part of governance.

**Where controls can be applied:**
| Level | Use When |
|-------|----------|
| **Architecture** | Control applies system-wide (e.g., company security policies) |
| **Node** | Control applies to a specific component (e.g., database encryption) |
| **Relationship** | Control applies to a specific connection (e.g., TLS on an API call) |
| **Flow** | Control applies to a business process (e.g., audit logging for user registration) |

**Here are three controls to add — decide where each belongs:**

> **Note:** This is not a comprehensive security review. A real security assessment would cover many more controls. These three illustrate different placement scenarios.

---

**Control 1: API Authentication**
```json
{
  "control-requirement-url": "https://acme.com/security/api-authentication",
  "control-config": {
    "mechanism": "OAuth2",
    "token-validation": "JWT",
    "issuer": "https://idp.acme.com",
    "required-scopes": ["notifications:write"]
  }
}
```
*Think: Does this apply to the whole architecture, a specific node, or a specific relationship?*

---

**Control 2: Encryption at Rest**
```json
{
  "control-requirement-url": "https://acme.com/security/encryption-at-rest",
  "control-config": {
    "algorithm": "AES-256-GCM",
    "key-management": "AWS KMS",
    "key-rotation-days": 90
  }
}
```
*Think: Which component stores data that needs encryption?*

---

**Control 3: PII Handling**
```json
{
  "control-requirement-url": "https://acme.com/privacy/pii-handling",
  "control-config": {
    "data-classification": "confidential",
    "retention-days": 30,
    "deletion-capability": "on-request",
    "anonymization": "email-masking"
  }
}
```
*Think: Where does PII flow? The whole system? Specific relationships?*

---

**Your task:** Add each control to the architecture at the level you think is most appropriate. Use CALM Copilot if you're unsure:

```text
I need to add an API Authentication control to my notification service architecture.
Should this go at the architecture level, on the API node, or on specific relationships?
What's the best practice?
```

### 4. Review Third-Party Risk

The architecture includes external dependencies (IdP, possibly SMS/email providers).

For each external system:
- Is the connection secured?
- What data is shared with them?
- Are there appropriate controls on outbound data?

Add any missing controls or metadata related to third-party risk.

### 5. Create Security Findings Document

Create a formal security review document:

**Deliverable:** `docs/security-review-notification-service.md`

**Include:**
```markdown
# Security Review: Notification Service

## Review Details
- **Architecture:** architectures/notification-service.json
- **Reviewer:** [Your name/role]
- **Date:** [Today's date]
- **Review Type:** Pre-implementation security assessment

## Executive Summary
[1-2 paragraph summary of findings]

## Architecture Overview
[Brief description of what was reviewed]

## Findings

### Critical
[Any critical issues that must be fixed]

### High
[High-priority issues]

### Medium
[Medium-priority issues]

### Low / Informational
[Minor issues or suggestions]

## Controls Assessment
[Summary of controls reviewed and added]

## Data Classification Review
[Summary of data flow classifications]

## Recommendations
[List of recommendations for the team]

## Approval Decision
[ ] APPROVED - Architecture may proceed to implementation
[ ] CONDITIONALLY APPROVED - May proceed with noted remediation
[ ] NOT APPROVED - Must address findings before re-review

## Sign-off
[Your sign-off statement]
```

### 6. Generate Updated Documentation

```bash
calm docify -a architectures/notification-service.json -o docs/notification-service
```

The updated docs now reflect your security controls.

### 7. Make Your Decision

Based on your review:

**If APPROVED:**
```bash
git add architectures/notification-service.json docs/security-review-notification-service.md docs/notification-service
git commit -m "Day 23: Security Review - APPROVED with controls"
git tag day-23
git tag security-approved
```

**If CONDITIONALLY APPROVED:**
```bash
git add architectures/notification-service.json docs/security-review-notification-service.md
git commit -m "Day 23: Security Review - CONDITIONALLY APPROVED"
git tag day-23
# Document what must be fixed before security-approved tag
```

**If NOT APPROVED:**
```bash
git add docs/security-review-notification-service.md
git commit -m "Day 23: Security Review - NOT APPROVED - see findings"
git tag day-23
# Architecture needs remediation before re-review
```

### 8. Update README

Mark Day 23 complete and note the security review outcome.

## Deliverables / Validation Criteria

Your Day 23 submission should include a commit tagged `day-23` containing:

✅ **Required Files:**
- Updated `architectures/notification-service.json` — With security controls and fixes
- `docs/security-review-notification-service.md` — Formal security review document
- Updated `docs/notification-service/` — Regenerated documentation
- Updated `README.md` — Day 23 marked as complete

✅ **Validation:**
```bash
# Architecture has controls
grep -q '"controls"' architectures/notification-service.json

# Security review document exists
test -f docs/security-review-notification-service.md

# Validations still pass
calm validate -p patterns/notification-service-pattern.json -a architectures/notification-service.json
calm validate -p patterns/acme-base-pattern.json -a architectures/notification-service.json -u url-mapping.json

# Check tag
git tag | grep -q "day-23"
```

## Tips

- **Use CALM Chat extensively** — It's your security analysis assistant
- **Think like an attacker** — What could go wrong?
- **Document everything** — Security reviews need audit trails
- **Be constructive** — The goal is to improve, not just criticize
- **Consider the business context** — Not every system needs the same security posture

## Thinking Like a Security SME

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Security SME Mindset                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Questions to ask:                                                         │
│                                                                             │
│   AUTHENTICATION                                                            │
│   • How do we know who's calling the API?                                   │
│   • How do services authenticate to each other?                             │
│                                                                             │
│   AUTHORIZATION                                                             │
│   • Who can send notifications?                                             │
│   • Who can view notification history?                                      │
│                                                                             │
│   DATA PROTECTION                                                           │
│   • Is all data encrypted in transit?                                       │
│   • Is stored data encrypted at rest?                                       │
│   • How are encryption keys managed?                                        │
│                                                                             │
│   PRIVACY                                                                   │
│   • What PII does this system handle?                                       │
│   • How long is PII retained?                                               │
│   • Can we honor deletion requests?                                         │
│                                                                             │
│   AUDIT                                                                     │
│   • What gets logged?                                                       │
│   • Can we detect suspicious activity?                                      │
│   • Can we prove compliance?                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Common Security Controls for Notification Services

For reference, typical controls you might add:

| Control Domain | Example Controls |
|----------------|------------------|
| Authentication | OAuth2, API keys, mTLS for service-to-service |
| Authorization | RBAC, scope-based permissions |
| Encryption Transit | TLS 1.3, certificate pinning |
| Encryption Rest | AES-256, customer-managed keys |
| Logging | Security event logging, 90-day retention |
| Privacy | PII minimization, 30-day message retention |
| Rate Limiting | API rate limits to prevent abuse |

## Reflection

- How did having a formal architecture help your security review?
- What would this review have been like without CALM?
- How do controls in the architecture relate to implementation requirements?
- What's the value of documenting security decisions in the architecture?

## The Platform Team Challenge Complete! 🎉

You've now experienced CALM from three different perspectives:

| Day | Persona | You Learned |
|-----|---------|-------------|
| 21 | Enterprise Architect | How to create governance frameworks that scale |
| 22 | Product Developer | How to build within guardrails efficiently |
| 23 | Security SME | How to review and secure architectures systematically |

This is how CALM enables collaboration across roles in real enterprises.

## Next Steps

Tomorrow (Day 24) is the final day of Advent of CALM! You'll reflect on your complete journey, polish your portfolio, and learn how to continue with CALM beyond this challenge.
