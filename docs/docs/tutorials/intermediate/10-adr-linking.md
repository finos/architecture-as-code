---
id: 10-adr-linking
title: "Link Architecture Decision Records"
sidebar_position: 4
---

# Link Architecture Decision Records

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Connect architectural decisions to your CALM architecture by linking [Architecture Decision Records](https://adr.github.io/) (ADRs).

## Learning Objectives

By the end of this tutorial, you will:
- Understand how CALM's `adrs` property links decisions to architecture
- Use the MADR format to write clear, structured ADRs
- Link both local markdown files and external URLs as ADRs
- Create an ADR index for your project

## Prerequisites

Complete [Model Business Flows](./09-business-flows) first.

## Step-by-Step Guide

### 1. Understand ADRs in CALM

Architecture Decision Records (ADRs) capture significant architectural decisions along with their context and consequences. CALM supports linking ADRs to architectures through the `adrs` top-level property.

**How CALM ADR Linking Works:**
- The `adrs` property is a simple array of URL strings
- URLs can be **relative paths** to local markdown files (e.g., `docs/adr/0001-decision.md`)
- URLs can be **absolute URLs** to external resources (e.g., a wiki, GitHub repo, or ADR management tool)

**ADR Format — MADR:**
We'll use **[MADR (Markdown Any Decision Records)](https://adr.github.io/madr)** which includes:
- Title and date
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context (the situation and problem)
- Decision (what was decided)
- Consequences (positive and negative impacts)

> **Already have ADRs?** If your organization maintains ADRs in a wiki or ADR tool, you can link directly to those URLs instead of creating local files.

### 2. Create Your ADR Directory

```bash
mkdir -p docs/adr
```

### 3. Create Your First ADR

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

## Consequences

### Positive
- **Industry Standard:** Well-understood, widely supported
- **Flexibility:** Supports multiple client types
- **Stateless:** JWTs contain claims, no server-side session storage

### Negative
- **Token Management:** Clients must handle refresh logic
- **Revocation:** Immediate revocation requires additional infrastructure
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

Create an index table listing each ADR, its title, and date. Link the ADRs in `architectures/ecommerce-platform.json` to keep traceability clear.

Remember to baseline your work using git. Committing at this point gives you a clean restore point if you need to revisit this lesson.

## Key Concepts

### The `adrs` Property

```json
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "adrs": [
    "docs/adr/0001-use-message-queue-for-async-processing.md",
    "docs/adr/0002-use-oauth2-for-api-authentication.md"
  ],
  "nodes": [...]
}
```

The `adrs` array is a flat list of URL strings — either relative local paths or absolute URLs to external ADR repositories.

### MADR Template Structure

| Section | Purpose |
|---------|---------|
| Title | Short description of the decision |
| Status | Current state: Proposed / Accepted / Superseded |
| Context | The situation that drove the decision |
| Decision | What was chosen and key technical details |
| Consequences | Positive outcomes, negative trade-offs, mitigations |

### ADR Lifecycle

1. **Proposed** — drafted, under review
2. **Accepted** — approved and in effect
3. **Superseded** — replaced by a newer ADR (link to the replacement)

Never edit an accepted ADR — supersede it instead to preserve decision history.

## Resources

- [MADR — Markdown Any Decision Records](https://adr.github.io/madr/)
- [ADR GitHub Organization](https://adr.github.io/)
- [ADR Templates Collection](https://github.com/joelparkerhenderson/architecture_decision_record)

## Next Steps

In the [next tutorial](./11-docify), you'll generate a shareable documentation website from your architecture!
