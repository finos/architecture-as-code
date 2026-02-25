# Day 10: Link to an ADR

## Overview
Connect architectural decisions to your CALM architecture by linking [Architecture Decision](https://adr.github.io/) Records.

## Objective and Rationale
- **Objective:** Create ADR documents and link them to your architecture using the `adrs` property
- **Rationale:** Architecture Decision Records capture the "why" behind design choices. Linking them to CALM architectures creates traceability from decisions to implementation, essential for onboarding, audits, and understanding system evolution.

## Requirements

### 1. Understand ADRs in CALM

Architecture Decision Records (ADRs) capture significant architectural decisions along with their context and consequences. CALM supports linking ADRs to architectures through the `adrs` top-level property.

**How CALM ADR Linking Works:**
- The `adrs` property is a simple array of URL strings
- URLs can be **relative paths** to local markdown files (e.g., `docs/adr/0001-decision.md`)
- URLs can be **absolute URLs** to external resources (e.g., a wiki, GitHub repo, or ADR management tool)
- This flexibility means you can link to existing ADR repositories if you already have them

**ADR Formats:**
There are several popular ADR formats. We'll use **[MADR (Markdown Any Decision Records)](https://adr.github.io/madr)** which includes:
- Title and date
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context (the situation and problem)
- Decision (what was decided)
- Consequences (positive and negative impacts)

> **Already have ADRs?** If your organization maintains ADRs in a wiki, GitHub repo, or ADR tool, you can link directly to those URLs instead of creating local files.

### 2. Create Your ADR Directory

```bash
mkdir -p docs/adr
```

### 3. Create Your First ADR

We'll create ADRs using the **MADR format** - a lightweight, markdown-based approach that's easy to maintain alongside your code.

**File:** `docs/adr/0001-use-message-queue-for-async-processing.md`

**Content:**
```markdown
# 1. Use Message Queue for Asynchronous Order Processing

Date: 2024-12-15

## Status
Accepted

## Context
Our e-commerce platform needs to handle order processing asynchronously to:
- Improve user experience with fast order confirmation
- Decouple order capture from payment processing
- Handle traffic spikes without overloading payment services
- Enable retry logic for failed payment attempts

## Decision
We will introduce a RabbitMQ message broker between the Order Service and Payment Service.

**Technical Details:**
- Protocol: AMQP
- Broker: RabbitMQ 3.12+
- Message format: JSON
- Durability: Persistent messages with acknowledgments

## Consequences

### Positive
- **Resilience:** Payment service failures don't block order submission
- **Scalability:** Can scale payment processing independently
- **User Experience:** Immediate order confirmation
- **Retries:** Failed payments can be retried automatically

### Negative
- **Complexity:** Adds another system component to manage
- **Eventual Consistency:** Order status updates are asynchronous
- **Operational Overhead:** Requires monitoring, backlog management

### Mitigations
- Implement comprehensive message monitoring
- Add dead-letter queues for failed messages
- Provide customer-facing order status tracking
```

### 4. Create a Second ADR

**File:** `docs/adr/0002-use-oauth2-for-api-authentication.md`

**Content:**
```markdown
# 2. Use OAuth2 for API Authentication

Date: 2024-12-15

## Status
Accepted

## Context
The API Gateway requires a secure, standardized authentication mechanism for:
- Web application clients
- Mobile application clients
- Third-party API integrations

## Decision
Implement OAuth2 with JWT tokens for all API authentication.

**Technical Details:**
- Standard: OAuth 2.0 (RFC 6749)
- Token format: JWT (RFC 7519)
- Grant types: Authorization Code, Client Credentials
- Token expiry: 1 hour access tokens, 30 day refresh tokens
- Audiences: api.example.com, mobile.example.com

## Consequences

### Positive
- **Industry Standard:** Well-understood, widely supported
- **Flexibility:** Supports multiple client types
- **Stateless:** JWTs contain claims, no server-side session storage
- **Ecosystem:** Compatible with existing OAuth2 libraries

### Negative
- **Token Management:** Clients must handle refresh logic
- **Token Size:** JWTs larger than session cookies
- **Revocation:** Immediate revocation requires additional infrastructure

### Mitigations
- Short-lived access tokens minimize revocation issues
- Implement token refresh flows
- Add token introspection endpoint for validation
```

### 5. Link ADRs to Your Architecture

**Prompt:**
```text
Add an adrs array at the top level of architectures/ecommerce-platform.json (after the $schema and before metadata).

Add these URLs:
- "docs/adr/0001-use-message-queue-for-async-processing.md"
- "docs/adr/0002-use-oauth2-for-api-authentication.md"

These are relative paths from the repository root.
```

### 6. Validate with ADRs

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 7. Create an ADR Index

**File:** `docs/adr/README.md`

**Content:**
```markdown
# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the e-commerce platform.

## Format

We use **MADR (Markdown Any Decision Records)** format, based on [the MADR template](https://adr.github.io/madr/):

- Title and date
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context (the situation and problem)
- Decision (what was decided)
- Consequences (positive, negative, and mitigations)

## Linking to CALM

All ADRs in this directory are linked from `architectures/ecommerce-platform.json` in the `adrs` array. This creates traceability between decisions and implementation.

## Index

### Active

| ADR | Title | Date |
|-----|-------|------|
| [0001](0001-use-message-queue-for-async-processing.md) | Use Message Queue for Asynchronous Order Processing | 2024-12-15 |
| [0002](0002-use-oauth2-for-api-authentication.md) | Use OAuth2 for API Authentication | 2024-12-15 |

### Superseded
None yet.

## Creating New ADRs

Use the numbering sequence: 0003, 0004, etc.

Filename format: `NNNN-short-title-with-hyphens.md`

Link the ADR in `architectures/ecommerce-platform.json` in the `adrs` array.

## Benefits

1. **Traceability:** Link decisions to architecture implementation
2. **Onboarding:** New team members understand "why" not just "what"
3. **Auditing:** Decision history for compliance and reviews
4. **Evolution:** Track how architecture decisions change over time
```

### 8. Update Your README

Update your README to reflect that Day 10 is complete, mention that ADRs are now linked to the architecture, and add links to the specific ADR files so reviewers can jump directly to the decisions.

### 9. Commit Your Work

```bash
git add architectures/ecommerce-platform.json docs/adr README.md
git commit -m "Day 10: Link ADRs to architecture for decision traceability"
git tag day-10
```

## Deliverables

✅ **Required:**
- `architectures/ecommerce-platform.json` - With adrs array
- `docs/adr/0001-use-message-queue-for-async-processing.md`
- `docs/adr/0002-use-oauth2-for-api-authentication.md`
- `docs/adr/README.md` - ADR index
- Updated `README.md` - Day 10 marked complete

✅ **Validation:**
```bash
# Verify ADRs array exists
grep -q '"adrs"' architectures/ecommerce-platform.json

# Verify ADR files exist
test -f docs/adr/0001-use-message-queue-for-async-processing.md
test -f docs/adr/0002-use-oauth2-for-api-authentication.md
test -f docs/adr/README.md

# Check ADR links in architecture
grep -A 2 '"adrs"' architectures/ecommerce-platform.json | grep -q '0001'
grep -A 2 '"adrs"' architectures/ecommerce-platform.json | grep -q '0002'

# Validate
calm validate -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-10"
```

## Resources

- [MADR - Markdown Any Decision Records](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://adr.github.io/)
- [ADR Templates Collection](https://github.com/joelparkerhenderson/architecture_decision_record)

## Tips

- Write ADRs when making significant architectural decisions
- Include both positive and negative consequences
- Link ADRs from CALM to create traceability from decisions to implementation
- Use consistent numbering (0001, 0002, etc.)
- Keep ADRs immutable - supersede old decisions rather than editing them
- **Flexibility:** ADRs can be local markdown, links to a wiki, or URLs to an external ADR repository
- If you already have ADRs elsewhere, just add those URLs to the `adrs` array

## Next Steps
Tomorrow (Day 11) you'll generate documentation with the docify command!
