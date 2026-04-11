---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0004: Domain-Oriented Control Keys

## Context and Problem Statement

CALM 1.2 controls require a `key` field that uniquely identifies a security or compliance requirement attached to a node or relationship. CalmStudio needed to decide on a naming convention for these keys. The FINOS AI Governance Framework (AIGF) uses AIR-IDs (e.g., `AIR-001`, `AIR-002`) as its identifier scheme, and an initial implementation used framework-prefixed keys like `aigf-data-protection`. This raised the question: should control keys encode the framework source, or should they be domain-oriented?

## Considered Options

- **Framework-prefixed keys** — `aigf-data-protection`, `nist-ac-2`, `pci-dss-6.1`. Keys identify the source framework.
- **Domain-oriented keys** — `data-protection`, `access-control`, `edge-protection`. Keys identify the domain concern. Framework IDs go in `config-url` only.

## Decision Outcome

Chosen: **Domain-oriented keys**, per CALM spec maintainer guidance. Control keys should express the domain concern (what is being protected or enforced), not the framework that defines it. Framework-specific identifiers (AIR-IDs, NIST control numbers, PCI DSS references) belong in `config-url` and `config`, not in the key. This makes controls reusable across frameworks without key collisions.

The key regex is `^[a-zA-Z0-9-]+$` — alphanumeric and hyphens only.

### Consequences

- **Good:** Controls are spec-aligned and framework-agnostic. The same `data-protection` control can reference AIGF, NIST, and PCI DSS simultaneously through multiple `requirements[]` entries. Control keys are stable even when framework versions change.
- **Neutral:** Requires a mapping layer to translate domain keys to framework-specific AIR-IDs. CalmStudio implements this via the `config-url` field pointing to a control catalogue. Architects unfamiliar with CALM may expect framework-prefixed keys.
- **Bad:** Domain-oriented keys are less immediately recognisable to compliance teams who think in terms of NIST control numbers or PCI DSS clauses. Training and documentation are needed to explain the mapping.
