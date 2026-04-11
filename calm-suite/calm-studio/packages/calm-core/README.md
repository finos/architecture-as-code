# @calmstudio/calm-core

CALM architecture types, validation, and AIGF governance catalogue for TypeScript.

[![npm version](https://img.shields.io/npm/v/@calmstudio/calm-core.svg)](https://www.npmjs.com/package/@calmstudio/calm-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../../LICENSE)
[![CI](https://github.com/finos/calmstudio/actions/workflows/ci.yml/badge.svg)](https://github.com/finos/calmstudio/actions/workflows/ci.yml)

Part of the [FINOS CALM](https://calm.finos.org/) ecosystem — the open standard for
Architecture-as-Code.

---

## Install

```bash
npm install @calmstudio/calm-core
# or
pnpm add @calmstudio/calm-core
```

> **Runtime peer dependency:** `ajv` and `ajv-formats` are required and listed as
> `dependencies`, so they install automatically.

---

## Quick Example

```typescript
import { CalmArchitecture, CalmNode, validateCalmArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
  nodes: [
    {
      'unique-id': 'web-app',
      'node-type': 'service',
      name: 'Web Application',
      description: 'Frontend SPA served over HTTPS',
    },
    {
      'unique-id': 'api-gateway',
      'node-type': 'service',
      name: 'API Gateway',
      description: 'REST API entry point',
    },
  ],
  relationships: [
    {
      'unique-id': 'web-to-api',
      'relationship-type': 'connects',
      source: 'web-app',
      destination: 'api-gateway',
      protocol: 'HTTPS',
    },
  ],
};

const issues = validateCalmArchitecture(arch);
const hasErrors = issues.some(i => i.severity === 'error');
console.log(hasErrors ? 'Invalid architecture' : 'Valid architecture');
// "Valid architecture"
```

---

## API Overview

### Types

| Export | Description |
|---|---|
| `CalmArchitecture` | Root document: `nodes`, `relationships`, optional `decorators` |
| `CalmNode` | A system component: service, database, actor, etc. |
| `CalmRelationship` | A directed edge between two nodes |
| `CalmControl` | A governance control attached to a node or relationship |
| `CalmControls` | Map of control key to `CalmControl` |
| `CalmNodeType` | Union type of the 9 built-in node types |
| `CalmRelationshipType` | Union type of the 5 built-in relationship types |
| `CalmInterface` | A typed endpoint (URL, host-port, container image, etc.) |
| `CalmDecorator` | Architecture-wide cross-cutting overlay (governance, mapping) |
| `CalmEvidence` | Links a control to evidence of compliance |

**Built-in node types:** `actor`, `system`, `service`, `database`, `network`,
`webclient`, `ecosystem`, `ldap`, `data-asset`

**Built-in relationship types:** `connects`, `interacts`, `deployed-in`,
`composed-of`, `options`

### Validation

| Export | Description |
|---|---|
| `validateCalmArchitecture(arch)` | Validates structure and semantics; returns `ValidationIssue[]` |
| `ValidationIssue` | `{ severity, message, nodeId?, relationshipId?, path? }` |

Validation checks include:
- JSON Schema conformance (required fields, types)
- Duplicate `unique-id` detection
- Dangling relationship references
- Self-loop detection
- Orphan node warnings
- Missing description info-level hints

### AIGF Governance Catalogue

The package embeds the [FINOS AI Governance Framework (AIGF)](https://air-governance-framework.finos.org/)
v2.0 catalogue for design-time governance.

| Export | Description |
|---|---|
| `aigfRisks` | Full array of `AIGFRisk` objects (FINOS AIGF v2.0) |
| `aigfMitigations` | Full array of `AIGFMitigation` objects |
| `aigfNodeRiskMappings` | AI node type → applicable risks and recommended mitigations |
| `isAINode(nodeOrType)` | Returns `true` if the node type is an AI/LLM node |
| `getAIGFForNodeType(nodeType)` | Returns `{ risks, mitigations }` for a given node type |
| `AIGF_CONTROL_KEYS` | `ReadonlySet<string>` of all CALM control keys defined in the catalogue |
| `AIGFRisk` | Interface for a single AIGF risk entry |
| `AIGFMitigation` | Interface for a single AIGF mitigation entry |
| `AIGFNodeRiskMapping` | Interface for a node-type-to-risk mapping |

#### Example: look up AIGF risks for an AI node type

```typescript
import { getAIGFForNodeType, isAINode } from '@calmstudio/calm-core';

const nodeType = 'ai:llm';

if (isAINode(nodeType)) {
  const { risks, mitigations } = getAIGFForNodeType(nodeType);
  console.log(`${risks.length} applicable risks, ${mitigations.length} recommended mitigations`);
}
```

---

## CALM 1.2 Quick Reference

All types follow the [CALM 1.2 specification](https://calm.finos.org/release/1.2/).

- Controls are attached directly to nodes/relationships (not at document level)
- Control keys use domain-oriented kebab-case (`edge-protection`, `mcp-security`)
- Framework IDs go in `config-url` only — not in the control key
- `requirement-url` is required per control; `config-url` and `config` are optional

---

## Full Documentation

Full documentation at [CalmStudio Docs](https://finos.github.io/calmstudio/)

---

## Part of the FINOS CALM Ecosystem

- [CALM Specification](https://calm.finos.org/release/1.2/)
- [architecture-as-code](https://github.com/finos/architecture-as-code)
- [FINOS AI Governance Framework (AIGF)](https://air-governance-framework.finos.org/)
- [CalmStudio](https://github.com/finos/calmstudio) — visual CALM architecture editor

---

## License

[Apache-2.0](../../LICENSE)
