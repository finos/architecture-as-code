# Requirements Spec: FluxNova Templates + AI Governance Framework Integration

**Date:** 2026-03-14
**Status:** Draft Requirements — work commenced
**Target:** CalmStudio roadmap input
**CALM Schema Version:** 1.2 (latest)
**Dependencies:** calm-core, extensions, studio app (canvas, palette, validation, io, stores)

---

## Overview

Two feature sets to be added to CalmStudio:

1. **FluxNova Architecture Templates** — Pre-built CALM patterns for FluxNova BPM deployments and financial services blueprints
2. **AIGF Design-Time Governance** — Contextual AI governance risk/mitigation suggestions when architects use AI components

**Target demo date:** OSFF Toronto, April 13-14, 2026

### Upstream Contribution Strategy (Phased)

This work follows a **build first, propose second** approach:

- **Phase 1 (now → April):** Build in CalmStudio/CalmGuard using existing CALM 1.2 constructs (controls, decorators, evidence). Ship features without waiting for spec changes.
- **Phase 2 (OSFF Toronto, April 13-14):** Demo working implementation. Propose three upstream contributions:
  1. **AIGF Control Pack** → `finos/architecture-as-code` CALM `controls/` directory (standardized control key definitions for all 23 AIGF mitigations)
  2. **AIGF Reference Patterns** → `finos-labs/ai-reference-architecture-library` (CALM patterns for RAG, single-agent, multi-agent with AIGF controls)
  3. **FluxNova + AIGF Patterns** → `finos/fluxnova-examples` (CALM architecture files paired with BPMN blueprints)
- **Phase 3 (post-OSFF):** Propose CALM spec extensions:
  - **Risk annotations** — a `risks` property on nodes (parallel to `controls`) referencing AIGF risk IDs
  - **Governance profiles** — top-level `governance` block declaring which control packs must be satisfied
  - **Control pack schema** — formal schema for reusable sets of controls

This positions CalmStudio/CalmGuard as the reference implementation for the AIGF-CALM integration tracked in [GitHub issue #139](https://github.com/finos/ai-readiness/issues/139).

---

## CALM 1.2 Schema Context

**Target spec version: CALM 1.2** (`https://calm.finos.org/release/1.2/`)

CALM 1.2 adds two features over 1.1 that are directly relevant to AIGF integration:

### Decorators (new in 1.2)

Decorators attach supplementary information to multiple nodes and relationships **without modifying the core architecture definition**. This is ideal for applying AIGF governance metadata across all AI nodes at once.

```json
{
  "unique-id": "aigf-governance-decorator",
  "type": "aigf-governance",
  "target": ["architecture.json"],
  "applies-to": ["llm-service", "agent-node", "mcp-server"],
  "data": {
    "framework-version": "2.0",
    "risks": ["AIR-OP-004", "AIR-SEC-026", "AIR-SEC-024"],
    "applied-mitigations": ["mi-10", "mi-20", "mi-18"],
    "governance-score": 85
  }
}
```

Schema: `https://calm.finos.org/release/1.2/meta/decorators.json`
- `unique-id` (string, required)
- `type` (string, required) — free-form category, e.g. `"aigf-governance"`, `"threat-model"`, `"deployment"`
- `target` (string[], required) — file paths or URLs referencing CALM documents
- `applies-to` (string[], required) — unique-ids of nodes, relationships, flows
- `data` (object, required) — free-form JSON payload

**Usage for AIGF:** Use decorators for architecture-wide governance overlays. Use controls for node-specific mitigation enforcement. Both approaches are complementary.

### Evidence (new in 1.2)

Links compliance evidence artifacts to controls. This is what CalmGuard needs for audit-ready compliance reports.

```json
{
  "evidence": {
    "unique-id": "ev-aigf-mi-20-proof",
    "evidence-paths": ["reports/mcp-security-audit-2026-03.pdf", "ci/aigf-scan-results.json"],
    "control-config-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
  }
}
```

Schema: `https://calm.finos.org/release/1.2/meta/evidence.json`
- `unique-id` (string, required) — for linking
- `evidence-paths` (string[], required) — paths to evidence artifacts
- `control-config-url` (string, required) — URI of the control this evidence relates to

### Controls (unchanged from 1.1)

```json
"controls": {
  "aigf-mcp-security": {
    "description": "MCP Server Security Governance (AIGF mi-20)",
    "requirements": [{
      "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
    }]
  }
}
```

Schema: `https://calm.finos.org/release/1.2/meta/control.json`
- Keys match `^[a-zA-Z0-9-]+$`
- Each control has `description` (string, required) and `requirements` (array, required)
- Each requirement has `requirement-url` (required) + either `config-url` or `config` (oneOf)

### Control Requirement (1.2)

Standalone control requirement definitions:
```json
{
  "control-id": "CR-AIGF-MI-20",
  "name": "MCP Server Security Governance",
  "description": "Comprehensive security controls for MCP servers in agentic AI systems"
}
```

Schema: `https://calm.finos.org/release/1.2/meta/control-requirement.json`
- `control-id` (string, required)
- `name` (string, required)
- `description` (string, required)

### CALM 1.2 Node Types

Core types: `actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`

Extension types (colon-prefixed): `fluxnova:engine`, `ai:llm`, `aws:lambda`, etc.

### CALM 1.2 Relationship Types

`connects`, `interacts`, `deployed-in`, `composed-of`, `options`

### CALM 1.2 Protocols

`HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

---

## Part A: FluxNova Templates

### A1. FluxNova Extension Pack

**What:** A new extension pack (`fluxnova`) registered alongside existing packs (core, aws, gcp, azure, kubernetes, ai).

**Location:** `packages/extensions/src/packs/fluxnova.ts`

**Node types to define:**

| typeId | Label | Description | isContainer |
|---|---|---|---|
| `fluxnova:engine` | BPM Engine | FluxNova BPMN 2.0 process execution engine | false |
| `fluxnova:rest-api` | REST API | FluxNova REST API layer (200+ endpoints, OpenAPI) | false |
| `fluxnova:cockpit` | Cockpit | Process monitoring and operations dashboard | false |
| `fluxnova:admin` | Admin | User/group/tenant management and authorization console | false |
| `fluxnova:tasklist` | Tasklist | Task assignment and lifecycle management UI | false |
| `fluxnova:modeler` | Modeler | BPMN/DMN visual modeling tool | false |
| `fluxnova:external-task-worker` | External Task Worker | Polyglot service that polls and executes external tasks | false |
| `fluxnova:dmn-engine` | DMN Engine | Decision Model and Notation rules engine | false |
| `fluxnova:process-db` | Process Database | Persistent store for process state, history, and audit logs | false |
| `fluxnova:platform` | FluxNova Platform | Container for the full FluxNova deployment | true |

**Pack color:** Use an orange/amber family to differentiate from existing packs:
```typescript
const fluxnovaColor: PackColor = {
  bg: '#fff7ed',
  border: '#f97316',
  stroke: '#ea580c',
  badge: '[FN]',
};
```

**Icons:** Create `packages/extensions/src/icons/fluxnova.ts` with 16x16 viewBox stroke-based SVG icons following the existing pattern from `icons/ai.ts`.

**Registration:** Add to `packages/extensions/src/index.ts`:
- Export `fluxnovaPack` from `./packs/fluxnova.js`
- Import and call `registerPack(fluxnovaPack)` in `initAllPacks()`

**Acceptance criteria:**
- [ ] FluxNova pack appears in the NodePalette alongside existing packs
- [ ] All 10 node types are drag-droppable onto the canvas
- [ ] Nodes render with correct icons, colors, and labels
- [ ] Container node (`fluxnova:platform`) accepts child nodes

---

### A2. Template System

**What:** A template loading system that lets users start from pre-built CALM architecture patterns instead of a blank canvas.

**Why:** CalmStudio currently only supports blank canvas or file import. Templates provide opinionated starting points for common architectures.

#### A2.1 Template Data Format

Each template is a JSON file conforming to the existing `CalmArchitecture` type from `calm-core`, extended with template metadata:

```typescript
// packages/calm-core/src/types.ts (extend)
interface CalmTemplate {
  /** Template metadata — not part of the CALM spec, stripped on export */
  _template: {
    id: string;           // e.g. 'fluxnova-kyc-onboarding'
    name: string;         // e.g. 'FluxNova: KYC Onboarding'
    description: string;  // One-line description
    category: string;     // e.g. 'fluxnova', 'ai-governance', 'general'
    tags: string[];       // e.g. ['fluxnova', 'kyc', 'pre-trade', 'financial-services']
    version: string;      // semver
    author: string;       // e.g. 'CalmStudio Contributors'
    /** Source reference for blueprints derived from external projects */
    sourceRef?: string;   // e.g. 'finos/fluxnova-examples/process-examples/financial-services/kyc'
  };
  /** Standard CALM architecture */
  nodes: CalmNode[];
  relationships: CalmRelationship[];
}
```

#### A2.2 Template Files

**Location:** `apps/studio/src/lib/templates/`

**Templates to create (priority order):**

**1. `fluxnova-platform.json`** — Base FluxNova deployment topology
- Nodes: engine, rest-api, cockpit, admin, tasklist, process-db
- Relationships: engine→process-db (JDBC), rest-api→engine (internal), cockpit/admin/tasklist→rest-api (HTTPS)
- Container: fluxnova:platform wrapping all components
- Controls: audit-logging on engine, encryption-in-transit on DB connection

**2. `fluxnova-kyc-onboarding.json`** — KYC pre-trade blueprint
- Extends platform template
- Additional nodes: identity-verification-svc (service), sanctions-screening-svc (service), document-mgmt-svc (service), notification-svc (service), kyc-database (database, PII classification)
- Relationships: engine orchestrates all services via HTTPS, services connect to kyc-database
- Controls: data-classification (PII) on kyc-database and identity-verification, audit-logging on all service connections
- Source ref: Scott Logic KYC blueprint from `finos/fluxnova-examples`

**3. `fluxnova-flash-risk.json`** — Flash risk management blueprint
- Extends platform template
- Additional nodes: risk-compute-onprem (service), risk-compute-cloud (service), risk-aggregation-svc (service), cloud-provisioner (service)
- Relationships: engine orchestrates parallel compute via gateways, aggregation collects results
- Controls: data-classification (Confidential) on compute nodes
- Source ref: Scott Logic Flash Risk blueprint

**4. `fluxnova-settlement.json`** — Post-trade settlement blueprint
- Extends platform template
- Additional nodes: counterparty-gateway (service), clearing-house-connector (service), regulatory-reporting-svc (service), settlement-db (database)
- Relationships: engine sequences settlement flow, connects to external counterparty systems
- Controls: audit-logging, encryption, regulatory-compliance on all external connections

**5. `fluxnova-ai-agent.json`** — FluxNova orchestrating AI agents (from FluxNova roadmap)
- Extends platform template
- Additional nodes: ai:agent, ai:llm, ai:guardrail, ai:tool
- Relationships: engine orchestrates agent execution, guardrail validates agent outputs
- Controls: AIGF controls on AI nodes (connects to Part B)

**6. `fluxnova-microservices.json`** — FluxNova orchestrating microservices via external tasks
- Extends platform template
- Additional nodes: 3 external-task-workers, message-broker (service), api-gateway (service)
- Relationships: workers poll engine REST API, broker handles async events

#### A2.3 Template Picker UI

**What:** A dialog/panel in CalmStudio for browsing and loading templates.

**Location:** `apps/studio/src/lib/templates/TemplatePicker.svelte`

**Behavior:**
1. Accessible from toolbar (new "Templates" button) and from empty canvas state ("Start from template")
2. Shows template cards grouped by category (FluxNova, AI, General)
3. Each card shows: name, description, tags, node count, preview thumbnail
4. Clicking a card loads the template onto the canvas (replacing current content — with confirmation if canvas is dirty)
5. Template metadata (`_template`) is stripped from the CALM architecture on export

**Template registry:**
```typescript
// apps/studio/src/lib/templates/registry.ts
import type { CalmTemplate } from '@calmstudio/calm-core';

const templates = new Map<string, CalmTemplate>();

export function registerTemplate(template: CalmTemplate): void { ... }
export function getTemplatesByCategory(category: string): CalmTemplate[] { ... }
export function getAllCategories(): string[] { ... }
export function loadTemplate(id: string): CalmArchitecture { ... } // strips _template
```

**Acceptance criteria:**
- [ ] Template picker is accessible from toolbar and empty canvas
- [ ] All 6 FluxNova templates load correctly onto canvas
- [ ] Nodes render with correct FluxNova pack icons/colors
- [ ] Relationships render with correct protocols and labels
- [ ] Controls are visible in node properties panel
- [ ] Export produces valid CALM JSON without `_template` metadata
- [ ] Canvas dirty state prompts confirmation before template load

---

### A3. Controls Support in calm-core

**What:** The `CalmNode` and `CalmRelationship` types in `calm-core` currently lack a `controls` property. The CALM spec defines controls as pattern-keyed objects on both nodes and relationships. This must be added.

**Changes to `packages/calm-core/src/types.ts`:**

```typescript
/** A single CALM control requirement */
interface CalmControlRequirement {
  'requirement-url': string;
  'config-url'?: string;
  config?: Record<string, unknown>;
}

/** A CALM control definition */
interface CalmControl {
  description: string;
  requirements: CalmControlRequirement[];
}

/** Controls object — keys are control identifiers matching ^[a-zA-Z0-9-]+$ */
type CalmControls = Record<string, CalmControl>;

// Update CalmNode
interface CalmNode {
  'unique-id': string;
  'node-type': CalmNodeType | string;
  name: string;
  description?: string;
  interfaces?: CalmInterface[];
  controls?: CalmControls;           // ADD
  'data-classification'?: string;     // ADD
  metadata?: Record<string, unknown>; // ADD
  customMetadata?: Record<string, string>;
}

// Update CalmRelationship
interface CalmRelationship {
  'unique-id': string;
  'relationship-type': CalmRelationshipType;
  source: string;
  destination: string;
  protocol?: string;
  description?: string;
  controls?: CalmControls;            // ADD
  metadata?: Record<string, unknown>; // ADD
}
```

**Validation updates:** `packages/calm-core/src/validation.ts` must validate control keys match `^[a-zA-Z0-9-]+$` and requirements have `requirement-url`.

**Properties panel:** `apps/studio/src/lib/properties/` must render controls as editable key-value sections on selected nodes/relationships.

**Acceptance criteria:**
- [ ] Controls roundtrip through import → canvas → export without data loss
- [ ] Controls are visible and editable in the properties panel
- [ ] Invalid control keys are flagged by validation
- [ ] `data-classification` renders as a badge/tag on canvas nodes
- [ ] Templates with controls load correctly

---

## Part B: AIGF Design-Time Governance

### B1. AIGF Data Package

**What:** A structured data package containing the full AIGF v2.0 risk and mitigation catalogue, parseable at design-time.

**Location:** `packages/calm-core/src/aigf/` (or a new `packages/aigf/` package if isolation preferred)

#### B1.1 Data Model

```typescript
// packages/calm-core/src/aigf/types.ts

type AIGFRiskType = 'OP' | 'SEC' | 'RC';
type AIGFMitigationType = 'PREV' | 'DET';

interface AIGFExternalRefs {
  owaspLlm?: string[];
  owaspMl?: string[];
  ffiec?: string[];
  euAiAct?: string[];
  nistSp80053r5?: string[];
  iso42001?: string[];
  nistAi600?: string[];
  mitreAtlas?: string[];
}

interface AIGFRisk {
  id: string;               // 'AIR-OP-004'
  sequence: number;         // 4
  title: string;            // 'Hallucination and Inaccurate Outputs'
  type: AIGFRiskType;       // 'OP'
  description: string;      // One-paragraph summary
  externalRefs: AIGFExternalRefs;
  relatedRisks: string[];   // ['AIR-OP-006', 'AIR-OP-020']
}

interface AIGFMitigation {
  id: string;                // 'mi-20'
  sequence: number;          // 20
  title: string;             // 'MCP Server Security Governance'
  type: AIGFMitigationType;  // 'PREV'
  description: string;       // One-paragraph summary
  externalRefs: AIGFExternalRefs;
  mitigates: string[];       // ['AIR-SEC-026', 'AIR-SEC-008', 'AIR-RC-001']
  relatedMitigations: string[];
  /** CALM control key to embed when this mitigation is applied */
  calmControlKey: string;    // 'aigf-mcp-security'
  /** Whether this mitigation has tiered implementation guidance */
  hasTiers: boolean;
}

/** Maps node type patterns to applicable AIGF risks */
interface AIGFNodeRiskMapping {
  /** Glob-like pattern matching node typeIds, e.g. 'ai:*', 'ai:llm', 'ai:agent' */
  nodeTypePattern: string;
  /** Risk IDs that apply when this node type is used */
  applicableRisks: string[];
  /** Mitigation IDs recommended for this node type */
  recommendedMitigations: string[];
}
```

#### B1.2 Catalogue Data

**Location:** `packages/calm-core/src/aigf/catalogue.ts`

Static data file containing all 23 risks and 23 mitigations, sourced from the AIGF GitHub repo YAML frontmatter. Exported as:

```typescript
export const aigfRisks: AIGFRisk[] = [ ... ];
export const aigfMitigations: AIGFMitigation[] = [ ... ];
```

#### B1.3 Node-to-Risk Mapping

**Location:** `packages/calm-core/src/aigf/mappings.ts`

Maps CalmStudio node types to applicable AIGF risks and recommended mitigations:

| Node Type Pattern | Applicable Risks | Recommended Mitigations |
|---|---|---|
| `ai:llm` | AIR-OP-004 (hallucination), AIR-OP-005 (versioning), AIR-OP-006 (non-deterministic), AIR-RC-001 (data leakage) | mi-10 (version pinning), mi-3 (firewalling), mi-1 (data leakage prevention), mi-15 (LLM-as-judge) |
| `ai:agent` | AIR-SEC-024 (auth bypass), AIR-OP-018 (model overreach), AIR-OP-028 (trust boundaries) | mi-18 (least privilege), mi-21 (decision audit), mi-22 (isolation) |
| `ai:orchestrator` | AIR-OP-028 (trust boundaries), AIR-SEC-025 (tool chain manipulation) | mi-22 (isolation), mi-19 (tool chain validation), mi-21 (decision audit) |
| `ai:vector-store` | AIR-SEC-002 (info leaked to vector store), AIR-SEC-009 (data poisoning) | mi-2 (data filtering), mi-12 (RBAC), mi-14 (encryption at rest), mi-6 (data classification) |
| `ai:tool` | AIR-SEC-025 (tool chain manipulation) | mi-19 (tool chain validation) |
| `ai:memory` | AIR-SEC-027 (state persistence poisoning) | mi-23 (credential protection), mi-14 (encryption at rest) |
| `ai:guardrail` | (none — guardrails ARE the mitigation) | — |
| `ai:rag-pipeline` | AIR-OP-004 (hallucination), AIR-SEC-002 (vector store leak) | mi-13 (citations), mi-2 (data filtering), mi-6 (data classification) |
| `ai:knowledge-base` | AIR-SEC-009 (data poisoning), AIR-OP-019 (data quality) | mi-6 (data classification), mi-16 (source data ACLs) |
| `ai:embedding-model` | AIR-SEC-008 (tampering with model), AIR-OP-005 (versioning) | mi-10 (version pinning), mi-5 (acceptance testing) |
| `ai:api-gateway` | AIR-SEC-010 (prompt injection), AIR-OP-007 (availability) | mi-3 (firewalling), mi-17 (AI firewall), mi-8 (QoS/DDoS) |
| `ai:human-in-the-loop` | (none — HITL IS the mitigation for mi-11) | — |
| `ai:eval-monitor` | (none — eval IS the mitigation for mi-4, mi-15) | — |

**Special case — MCP-related patterns:**

When any node has a relationship connecting to an external service with description containing "MCP" or when a node's `customMetadata` includes `mcp: true`:
- Surface AIR-SEC-026 (MCP supply chain compromise)
- Recommend mi-20 (MCP Server Security Governance)

```typescript
export const aigfNodeRiskMappings: AIGFNodeRiskMapping[] = [ ... ];

/** Resolve risks and mitigations for a given node type */
export function getAIGFForNodeType(nodeType: string): {
  risks: AIGFRisk[];
  mitigations: AIGFMitigation[];
};
```

---

### B2. Governance Suggestion Panel

**What:** A contextual panel in CalmStudio that surfaces AIGF risks and recommended mitigations when the architect selects or places AI-related nodes.

**Location:** `apps/studio/src/lib/governance/GovernancePanel.svelte`

#### B2.1 Panel Behavior

1. **Trigger:** Panel updates whenever the canvas selection changes or a new node is dropped
2. **Content:** For the selected node(s), show:
   - Applicable AIGF risks with severity indicators (OP=amber, SEC=red, RC=blue)
   - Recommended mitigations with type badges (PREV=shield, DET=magnifying glass)
   - Whether each mitigation is already applied as a control on the selected node
   - External framework references (EU AI Act article, ISO 42001 clause, etc.)
3. **Action:** "Apply mitigation" button that adds the corresponding CALM control to the selected node
4. **Architecture-level view:** Summary of all unmitigated risks across the entire architecture

#### B2.2 Applying a Mitigation

When the user clicks "Apply" on a mitigation, CalmStudio:

1. Adds a control to the selected node using the mitigation's `calmControlKey`:
   ```json
   {
     "controls": {
       "aigf-mcp-security": {
         "description": "MCP Server Security Governance (AIGF mi-20)",
         "requirements": [{
           "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
         }]
       }
     }
   }
   ```
2. Marks the risk as "mitigated" in the governance panel for that node
3. The control persists in the CALM JSON export
4. CalmGuard can later validate that these controls exist

#### B2.3 Architecture Governance Score

**What:** An overall governance readiness indicator for the architecture.

**Calculation:**
- Count all AI-related nodes in the architecture
- For each, check which AIGF mitigations are recommended vs. applied (as controls)
- Score = (applied mitigations / recommended mitigations) * 100
- Display as a gauge/badge: green (>80%), amber (50-80%), red (<50%)

**Location:** Show in the governance panel header and optionally in the toolbar.

**Acceptance criteria:**
- [ ] Governance panel appears when AI nodes are selected
- [ ] Risks are correctly mapped per the node-to-risk table
- [ ] "Apply mitigation" adds a valid CALM control to the node
- [ ] Controls survive roundtrip (canvas → export → import → canvas)
- [ ] Architecture-level governance score updates in real-time
- [ ] Panel shows external framework references (EU AI Act, ISO 42001, etc.)
- [ ] Non-AI nodes show no governance suggestions (panel is hidden or empty)

---

### B3. AIGF Validation Rules

**What:** Validation rules that flag governance gaps in the architecture.

**Location:** `apps/studio/src/lib/validation/aigf-rules.ts`

**Integration:** Wire into existing `ValidationPanel.svelte` and `validation.svelte.ts` store.

**Rules:**

| Rule ID | Severity | Description |
|---|---|---|
| `aigf-001` | warning | AI node `{name}` has no AIGF governance controls applied |
| `aigf-002` | warning | LLM node `{name}` missing version pinning control (mi-10) |
| `aigf-003` | warning | Vector store `{name}` missing data classification (mi-6) |
| `aigf-004` | error | Agent node `{name}` missing least privilege control (mi-18) — required for agentic architectures |
| `aigf-005` | error | MCP connection detected but no MCP security governance control (mi-20) |
| `aigf-006` | warning | Multi-agent pattern detected but no isolation/segmentation control (mi-22) |
| `aigf-007` | info | RAG pipeline `{name}` — consider adding citation traceability (mi-13) |
| `aigf-008` | warning | AI data store `{name}` missing encryption at rest control (mi-14) |
| `aigf-009` | warning | Agent `{name}` connected to external tools without tool chain validation control (mi-19) |
| `aigf-010` | info | Architecture governance score is {score}% — {count} recommended mitigations not yet applied |

**Rule configuration:** Rules should be toggleable via a settings/preferences mechanism. Organizations may want to promote warnings to errors or suppress info-level rules.

**Acceptance criteria:**
- [ ] Validation rules appear in ValidationPanel alongside existing structural validations
- [ ] Rules fire correctly based on node types and applied controls
- [ ] Clicking a validation issue selects the relevant node on canvas
- [ ] Rules are individually toggleable
- [ ] Error-level rules prevent export (or show confirmation) when enabled

---

## Part C: Cross-Cutting Concerns

### C1. CALM Spec Alignment

All additions must conform to CALM spec v1.1:
- Controls use the `^[a-zA-Z0-9-]+$` key pattern
- `requirement-url` is mandatory in control requirements
- `data-classification` is a string property on nodes
- Metadata is `Record<string, unknown>`

### C2. Export Compatibility

- Templates strip `_template` metadata on CALM JSON export
- AIGF controls export as standard CALM controls (no AIGF-specific schema extensions)
- Exported CALM JSON must validate with `calm-cli validate`

### C3. MCP Server Integration

CalmStudio's existing MCP server (21 tools) should expose template and governance capabilities:

**New MCP tools (lower priority, post-MVP):**

| Tool | Description |
|---|---|
| `list-templates` | Return available templates with metadata |
| `load-template` | Load a template onto the canvas by ID |
| `get-governance-status` | Return current architecture governance score and unmitigated risks |
| `apply-mitigation` | Apply an AIGF mitigation control to a specified node |
| `get-aigf-risks` | Return applicable AIGF risks for a given node type |

### C4. Testing

- Unit tests for AIGF data model and node-to-risk mappings
- Unit tests for template loading and metadata stripping
- Unit tests for controls validation in calm-core
- Component tests for GovernancePanel.svelte with mock canvas state
- E2E test: load FluxNova template → add AI node → apply AIGF mitigation → export → validate CALM JSON

---

## Implementation Priority

**MVP for OSFF Toronto (April 13-14):**

1. **P0 — FluxNova extension pack** (A1) — nodes in palette
2. **P0 — Controls in calm-core** (A3) — prerequisite for everything
3. **P0 — 2-3 FluxNova templates** (A2) — platform + KYC + flash risk
4. **P1 — Template picker UI** (A2.3) — load templates onto canvas
5. **P1 — AIGF data package** (B1) — risk/mitigation catalogue
6. **P1 — Governance suggestion panel** (B2) — contextual suggestions
7. **P2 — AIGF validation rules** (B3) — validation integration
8. **P2 — Remaining templates** (A2) — settlement, microservices, ai-agent
9. **P3 — MCP tools for templates/governance** (C3) — post-MVP

---

## Open Questions

1. **Template storage:** Should templates live in `apps/studio/` (app-level) or `packages/` (reusable)? If we plan to share templates via FINOS contribution, a package is better.
2. **AIGF data freshness:** The AIGF catalogue will evolve. Should we pin to v2.0 or build an update mechanism?
3. **Controls UX:** How much detail should the properties panel show for controls? Full requirement URLs? Or a simplified view with "View details" link to the AIGF site?
4. **FluxNova BPMN import:** Should CalmStudio eventually import `.bpmn` XML files and auto-generate the hosting CALM architecture? This is a stretch goal but would be the ultimate bridge.
5. **Governance policy profiles:** Should organizations be able to define which AIGF rules are errors vs. warnings? This maps to the open-core boundary (free = default profile, commercial = custom profiles).
