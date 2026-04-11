# Phase 15: OpenGRIS Scaler.toml Exporter and Deployment Templates - Research

**Researched:** 2026-03-23
**Domain:** TOML export, CALM custom metadata, template authoring, toolbar conditional UX
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**TOML Export Trigger & UX**
- Auto-detect: "Export as Scaler.toml" only appears in the export dropdown when the canvas contains `opengris:` nodes. Same pattern as AIGF decorator (only generates when AI nodes detected).
- Single unified Scaler.toml output — one file with all sections ([scheduler], [cluster], [object_storage_server], etc.). Matches OpenGRIS documentation convention.
- Annotated with inline comments explaining each section and key fields.
- Lives in the existing export dropdown alongside JSON, SVG, PNG. No new UI elements.

**Config Values Source**
- Custom metadata on nodes — users set key-value pairs in the existing custom metadata panel. e.g., scheduler node gets `scheduler_address: tcp://127.0.0.1:8516`.
- Smart defaults — export fills in OpenGRIS defaults for missing values. Comments mark which values are defaults vs user-set.
- Auto-derive addresses from topology — if a worker connects to scheduler via edge, auto-assign matching addresses. Reduces manual metadata entry.
- Match TOML keys directly — metadata key `scheduler_address` maps to TOML `scheduler_address`. No translation layer. Users use the exact TOML field names.

**Worker Manager Type Mapping**
- Custom metadata key `manager_type` on `opengris:worker-manager` nodes. Values: `native`, `ecs`, `symphony`, `aws_hpc`. Defaults to `native` if not set.
- Templates pre-fill `manager_type` on their worker-manager nodes.
- Support multiple worker managers in one TOML (waterfall scaling) — if canvas has multiple `opengris:worker-manager` nodes, generate multiple TOML sections plus waterfall policy in [scheduler].
- Waterfall priority order via `priority` metadata key (1, 2, 3...). Lower number = higher priority. Templates pre-fill this.

**Template Selection**
- Ship all 4 templates: Local Dev Cluster, Market Risk (waterfall), Scientific Research (HPC Batch), Multi-Cloud (native + ECS + Symphony).
- New "OpenGRIS" category in Template Picker (alongside "FluxNova").
- Fully turnkey: templates include all metadata (addresses, ports, capabilities, manager_type, priority). Load template → Export Scaler.toml → working config.
- Add an `opengris-local-cluster.calm.json` demo file to `apps/studio/static/demos/` for welcome screen access.

### Claude's Discretion

- Exact default values for each TOML field (use OpenGRIS documentation defaults)
- Address auto-derivation algorithm (port assignment strategy for multi-component topologies)
- Template node layout positions (use ELK auto-layout or hand-position)
- TOML generation library choice (hand-craft strings or use a library)

### Deferred Ideas (OUT OF SCOPE)

- Docker-compose.yml generation alongside Scaler.toml — future phase
- Kubernetes manifests generation — future phase
- Live cluster topology visualization (connect to running Scaler and render live state) — separate tool entirely

</user_constraints>

---

## Summary

Phase 15 adds two interconnected capabilities: a TOML exporter that converts CALM architectures with OpenGRIS nodes into Scaler.toml configuration files, and 4 starter templates covering the most common OpenGRIS deployment patterns. Both deliverables follow established CalmStudio conventions exactly — the exporter slots into `export.ts` alongside `exportAsCalm`/`exportAsSvg`/`exportAsPng`, and templates follow the JSON-plus-`_template`-metadata pattern already used by all 6 FluxNova templates.

The core technical challenge is mapping between two representations: CALM's node-relationship graph and Scaler.toml's flat section model. The mapping is one-to-one: each `opengris:*` node type corresponds to exactly one TOML section. Config values come from `customMetadata` on nodes (type `Record<string, string>` in `CalmNode`), with smart defaults filling gaps. The waterfall scaling pattern — multiple `[native_worker_manager]`/`[ecs_worker_manager]` sections with priority-ordered failover — is the key complexity; it requires collecting all worker-manager nodes, sorting by `priority` metadata, and emitting their sections in order while also injecting `worker_manager_waterfall` into `[scheduler]`.

No external TOML serialization library is needed. The Scaler.toml format is flat (no deeply nested tables, no arrays of tables), making string building safe and straightforward. The entire exporter is a pure function that takes `CalmArchitecture` and returns a `string`.

**Primary recommendation:** Write `exportAsScalerToml(arch: CalmArchitecture, filename?: string): void` as a pure string-builder in `export.ts`. Hand-craft the TOML string from typed section-builder helpers (one function per TOML section). No TOML library needed; no DOM interaction.

---

## Standard Stack

### Core (all already in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7 | Type-safe TOML string building | Project convention — strict mode |
| `@calmstudio/calm-core` | workspace | `CalmArchitecture`, `CalmNode`, `CalmRelationship` types | Already in all files |
| `$lib/io/fileSystem` | internal | `downloadDataUrl` — the one download primitive | Used by all export functions |
| `$lib/io/sidecar` | internal | `detectPacksFromArch` — detect `opengris:` prefix | Reuse exact same logic |
| Vitest | 3.x | Unit tests for pure exporter logic | Project test framework |

### No New Dependencies

TOML generation is hand-crafted string building. The Scaler.toml format is flat sections with scalar values — no nested tables, no array-of-tables, no multi-line strings. A library like `smol-toml` or `@iarna/toml` would add a dependency for zero benefit. String templates are type-safe when the model is typed correctly.

**Installation:** None — no new packages.

---

## Architecture Patterns

### Recommended File Layout

```
apps/studio/src/lib/io/
  export.ts                         — add exportAsScalerToml (existing file)
  scalerToml.ts                     — pure TOML builder logic (new file, testable in isolation)

apps/studio/src/lib/templates/
  opengris-local-dev.json           — Template 1: Local Dev Cluster
  opengris-market-risk.json         — Template 2: Market Risk (waterfall)
  opengris-scientific-research.json — Template 3: Scientific Research (HPC Batch)
  opengris-multi-cloud.json         — Template 4: Multi-Cloud (native + ECS + Symphony)
  registry.ts                       — add 4 opengris imports + registration (existing file)

apps/studio/static/demos/
  opengris-local-cluster.calm.json  — Demo file for welcome screen

apps/studio/src/lib/toolbar/
  Toolbar.svelte                    — add conditional `onexportscalertoml` prop

apps/studio/src/routes/
  +page.svelte                      — wire hasOpenGrisNodes() → conditional export item

apps/studio/src/tests/
  io/scalerToml.test.ts             — unit tests for the TOML builder
  io/export.test.ts                 — add Scaler.toml export tests (existing file)
  templates/registry.test.ts        — add OpenGRIS template count assertions (existing file)
```

### Pattern 1: Pure Export Function (matches existing exportAsCalm, exportAsCalmscript)

```typescript
// Source: apps/studio/src/lib/io/export.ts (existing pattern)

// In export.ts — thin wrapper, same pattern as other exports
export function exportAsScalerToml(arch: CalmArchitecture, filename = 'scaler.toml'): void {
  const content = buildScalerToml(arch);  // pure function in scalerToml.ts
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

### Pattern 2: TOML Section Builders (new pattern in scalerToml.ts)

```typescript
// Source: inferred from CalmNode type + OpenGRIS Scaler documentation

interface ScalerSection {
  fields: Record<string, string | number | boolean>;
  comment?: string;
}

function buildSchedulerSection(node: CalmNode, workerManagers: CalmNode[]): string {
  const meta = node.customMetadata ?? {};
  // Auto-detect waterfall: if multiple worker-managers, inject policy
  const managerOrder = workerManagers
    .slice()
    .sort((a, b) => Number(a.customMetadata?.priority ?? 99) - Number(b.customMetadata?.priority ?? 99))
    .map(wm => managerSectionName(wm));

  const lines: string[] = ['[scheduler]'];
  lines.push(`# OpenGRIS Scaler scheduler configuration`);
  lines.push(`scheduler_address = "${meta.scheduler_address ?? 'tcp://127.0.0.1:8516'}" # ${meta.scheduler_address ? 'user-set' : 'default'}`);
  if (managerOrder.length > 1) {
    lines.push(`worker_manager_waterfall = [${managerOrder.map(n => `"${n}"`).join(', ')}]`);
  }
  return lines.join('\n');
}
```

### Pattern 3: OpenGRIS Node Detection (reuse sidecar pattern)

```typescript
// Source: apps/studio/src/lib/io/sidecar.ts (detectPacksFromArch)

// In page.svelte — drives conditional export item
function hasOpenGrisNodes(): boolean {
  const arch = JSON.parse(getModelJson()) as CalmArchitecture;
  return arch.nodes.some(n => n['node-type'].startsWith('opengris:'));
}
```

The `detectPacksFromArch` function in `sidecar.ts` already does the pack-ID extraction; checking for `opengris` in the result set is equivalent and slightly cheaper than re-parsing.

### Pattern 4: Conditional Toolbar Export Item

The Toolbar already has the governance badge rendered conditionally via `showGovernanceBadge` boolean prop. The same pattern works for the Scaler.toml item:

```svelte
<!-- Toolbar.svelte — inside export-menu -->
{#if showScalerTomlExport}
  <button
    type="button"
    class="export-menu-item"
    role="menuitem"
    onclick={() => handleExportOption(onexportscalertoml)}
  >
    Scaler.toml (OpenGRIS)
  </button>
{/if}
```

New Toolbar prop: `showScalerTomlExport: boolean` (default `false`), `onexportscalertoml: () => void`.

### Pattern 5: Template JSON Structure (matches FluxNova templates exactly)

```json
{
  "_template": {
    "id": "opengris-local-dev",
    "name": "OpenGRIS: Local Dev Cluster",
    "description": "Single-machine Scaler deployment for local development and testing",
    "category": "opengris",
    "tags": ["opengris", "local", "development", "scaler"],
    "version": "1.0.0",
    "author": "CalmStudio Contributors"
  },
  "nodes": [
    {
      "unique-id": "ogld-scheduler",
      "node-type": "opengris:scheduler",
      "name": "Local Scheduler",
      "description": "...",
      "customMetadata": {
        "scheduler_address": "tcp://127.0.0.1:8516"
      }
    }
  ],
  "relationships": []
}
```

### Pattern 6: Demo File Structure (matches existing demos)

Demo files in `static/demos/` are plain CALM JSON without `_template`. They are loaded by filename through the Demos dropdown in Toolbar.svelte. Adding `opengris-local-cluster.calm.json` requires:
1. Adding the file to `static/demos/`
2. Adding a `{ id, name, path }` entry to the `DEMOS` const in `Toolbar.svelte`

### Node-to-TOML-Section Mapping

| CALM Node Type | TOML Section | Required Metadata Keys | Defaults |
|---|---|---|---|
| `opengris:scheduler` | `[scheduler]` | `scheduler_address` | `tcp://127.0.0.1:8516` |
| `opengris:cluster` | `[cluster]` | `cluster_name` | `scaler-cluster` |
| `opengris:worker` | (count contribution to cluster) | `worker_count`, `worker_capabilities` | `1`, `"default"` |
| `opengris:worker-manager` (native) | `[native_worker_manager]` | `manager_type=native`, `priority` | type: `native`, priority: `1` |
| `opengris:worker-manager` (ecs) | `[ecs_worker_manager]` | `manager_type=ecs`, `ecs_cluster`, `ecs_task_definition` | task: `scaler-worker` |
| `opengris:worker-manager` (symphony) | `[symphony_worker_manager]` | `manager_type=symphony` | — |
| `opengris:worker-manager` (aws_hpc) | `[aws_hpc_worker_manager]` | `manager_type=aws_hpc`, `aws_region` | `us-east-1` |
| `opengris:object-storage` | `[object_storage_server]` | `storage_address` | `tcp://127.0.0.1:8517` |
| `opengris:client` | contributes `client_address` to `[top]` section | `client_address` | — |
| `opengris:task-graph` | `[top]` (task orchestration) | `max_parallel_tasks` | `4` |
| `opengris:parallel-function` | contributes to `[top]` | `function_name` | — |

### Address Auto-Derivation Algorithm

When a node lacks an explicit `address`-type metadata key, derive from topology:
1. Collect all `connects` relationships where `source` or `destination` matches the node.
2. If the peer node has an explicit address, derive the current node's address by incrementing the port by 1 (scheduler on 8516 → object-storage on 8517).
3. Fall back to static defaults if no connected peer has an address.

This keeps the algorithm O(n) over relationships and deterministic.

### Anti-Patterns to Avoid

- **Modifying CalmNode objects during export:** The exporter reads `arch.nodes` and `arch.relationships` but must never mutate them. All transformation is output-only.
- **Emitting TOML for non-opengris nodes:** The exporter should silently skip `actor`, `service`, `system`, etc. Only `opengris:*` types contribute to Scaler.toml.
- **Failing when opengris nodes are absent:** The function should return an empty/comment-only string gracefully, though the trigger (only show when nodes present) prevents this in practice.
- **Using a TOML library for output:** The format is flat enough that a library adds indirection without safety benefit. TypeScript type-checking on the field map provides sufficient correctness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File download | Custom anchor/click | `downloadDataUrl` from `$lib/io/fileSystem` | Already handles blob: URL lifecycle |
| OpenGRIS node detection | New detection function | `detectPacksFromArch` from `$lib/io/sidecar` | Returns pack IDs; check includes 'opengris' |
| Template registration | Custom map | `registerTemplate` + `initAllTemplates` in `registry.ts` | Already supports categories; just add opengris imports |
| Template loading | Custom JSON fetch | `loadTemplate(id)` | Strips `_template`, returns clean CALM arch |
| Export wiring in page | New event system | Existing `onexport*` prop pattern | Toolbar → page.svelte callback chain already established |

**Key insight:** This phase is almost entirely additive. The infrastructure (export pipeline, template registry, custom metadata model, pack detection) is already in place from prior phases. The only genuinely new code is the TOML string builder and the 4 template JSON files.

---

## Common Pitfalls

### Pitfall 1: Multiple Worker Manager Sections — TOML Key Collision

**What goes wrong:** If two `opengris:worker-manager` nodes have `manager_type=native`, the exporter naively emits `[native_worker_manager]` twice. TOML does not support duplicate section headers — the second one silently overrides the first in most parsers.

**Why it happens:** Template authors may add two native managers without realizing the constraint.

**How to avoid:** When emitting multiple sections of the same type, append an index suffix: `[native_worker_manager]`, `[native_worker_manager_2]`. Alternatively, only the first manager of each type gets the canonical name; document this in template comments.

**Warning signs:** Template test that loads the multi-cloud template and parses the TOML output — duplicate section headers are immediately visible.

### Pitfall 2: customMetadata Values Are Always Strings

**What goes wrong:** TOML integers and booleans are distinct from strings. `worker_count = 4` (integer) is different from `worker_count = "4"` (string). If the exporter emits all metadata values wrapped in quotes, the Scaler binary may reject the config.

**Why it happens:** `CalmNode.customMetadata` is `Record<string, string>` — all values are strings. The exporter must infer TOML type from the key name or value content.

**How to avoid:** Maintain a typed key registry: known integer keys (`worker_count`, `max_parallel_tasks`, `priority`, `port`) are emitted unquoted. Known boolean keys are emitted as `true`/`false`. All others are emitted as strings. This is a small whitelist, not a general parser.

**Warning signs:** Unit test that emits a TOML with `worker_count` and checks the output doesn't contain `"4"` (quoted).

### Pitfall 3: TemplatePicker categoryColor Map Is Hardcoded

**What goes wrong:** `TemplatePicker.svelte` has a hardcoded `categoryColor` map. If `opengris` is not in the map, the dot renders as the fallback `#64748b` (slate). This is functionally fine but visually inconsistent with the OpenGRIS green family.

**Why it happens:** The map was authored when only FluxNova templates existed. The `categoryLabel` map also needs updating.

**How to avoid:** Add `opengris: '#16a34a'` to `categoryColor` and `opengris: 'OpenGRIS'` to `categoryLabel` in `TemplatePicker.svelte` when registering templates.

**Warning signs:** Visual regression — category dot appears grey instead of green in the template picker.

### Pitfall 4: Demo File Not Listed in DEMOS Constant

**What goes wrong:** Adding `opengris-local-cluster.calm.json` to `static/demos/` is not sufficient. The file must also be listed in the `DEMOS` const in `Toolbar.svelte`. The Demos dropdown is static — it renders from the const, not from filesystem discovery.

**Why it happens:** Toolbar does not auto-discover files in `static/demos/`.

**How to avoid:** Add `{ id: 'opengris-local-cluster', name: 'OpenGRIS Local Cluster', path: '/demos/opengris-local-cluster.calm.json' }` to `DEMOS` in `Toolbar.svelte`.

### Pitfall 5: Toolbar showScalerTomlExport Reactivity

**What goes wrong:** The `showScalerTomlExport` prop must be reactive in `+page.svelte`. If it's computed once at mount and not re-derived from the current model state, adding an OpenGRIS node to the canvas after page load won't reveal the export option.

**Why it happens:** `$derived` is required, not a one-time `$state` initialization.

**How to avoid:** In `+page.svelte`, derive `showScalerTomlExport` from the live model:
```typescript
const showScalerTomlExport = $derived(
  getModel().nodes.some(n => n['node-type'].startsWith('opengris:'))
);
```
Pass this derived value to Toolbar. This re-evaluates whenever the model changes.

---

## Code Examples

Verified patterns from existing codebase:

### Reading customMetadata from CalmNode

```typescript
// Source: packages/calm-core/src/types.ts line 100-101
// CalmNode.customMetadata?: Record<string, string>

const schedulerMeta = schedulerNode.customMetadata ?? {};
const address = schedulerMeta['scheduler_address'] ?? 'tcp://127.0.0.1:8516';
```

### Detecting OpenGRIS Pack Presence

```typescript
// Source: apps/studio/src/lib/io/sidecar.ts — detectPacksFromArch
import { detectPacksFromArch } from '$lib/io/sidecar';

function hasOpenGrisNodes(arch: CalmArchitecture): boolean {
  return detectPacksFromArch(arch).includes('opengris');
}
```

### Export Function Skeleton (matches existing pattern)

```typescript
// Source: apps/studio/src/lib/io/export.ts — exportAsCalmscript pattern

export function exportAsScalerToml(arch: CalmArchitecture, filename = 'scaler.toml'): void {
  const content = buildScalerToml(arch);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

### Template Registration Pattern

```typescript
// Source: apps/studio/src/lib/templates/registry.ts — initAllTemplates pattern

import opengrisLocalDev from './opengris-local-dev.json';
import opengrisMarketRisk from './opengris-market-risk.json';
import opengrisScientificResearch from './opengris-scientific-research.json';
import opengrisMultiCloud from './opengris-multi-cloud.json';

// Inside initAllTemplates():
registerTemplate(opengrisLocalDev as CalmTemplate);
registerTemplate(opengrisMarketRisk as CalmTemplate);
registerTemplate(opengrisScientificResearch as CalmTemplate);
registerTemplate(opengrisMultiCloud as CalmTemplate);
```

### Toolbar Conditional Export Item Pattern

```svelte
<!-- Source: Toolbar.svelte — showGovernanceBadge pattern for reference -->
<!-- Analogous conditional rendering, already established -->

{#if showScalerTomlExport}
  <button
    type="button"
    class="export-menu-item"
    role="menuitem"
    onclick={() => handleExportOption(onexportscalertoml)}
  >
    Scaler.toml (OpenGRIS)
  </button>
{/if}
```

### Waterfall Scheduler Section with Multiple Managers

```toml
# Expected output for multi-manager architectures (Market Risk template)
[scheduler]
scheduler_address = "tcp://127.0.0.1:8516"
worker_manager_waterfall = ["native_worker_manager", "ecs_worker_manager"]

[native_worker_manager]
# priority: 1 (handles burst locally first)

[ecs_worker_manager]
# priority: 2 (overflow to cloud when on-premise capacity exhausted)
ecs_cluster = "risk-scaler-cluster"
ecs_task_definition = "scaler-worker"
```

---

## Template Designs

### Template 1: OpenGRIS Local Dev Cluster

**Use case:** Developer laptop, single machine, no cloud dependencies.

**Nodes:** `opengris:cluster` container with children: 1x `opengris:scheduler`, 2x `opengris:worker`, 1x `opengris:object-storage`, 1x `opengris:worker-manager` (native, priority 1)

**Key metadata:**
- scheduler: `scheduler_address=tcp://127.0.0.1:8516`
- object-storage: `storage_address=tcp://127.0.0.1:8517`
- worker-manager: `manager_type=native`, `priority=1`, `max_workers=4`

**Expected TOML sections:** `[scheduler]`, `[cluster]`, `[native_worker_manager]`, `[object_storage_server]`

### Template 2: OpenGRIS Market Risk (Waterfall)

**Use case:** Financial institution — burst-handles risk calcs on-prem, overflows to ECS.

**Nodes:** 1x `opengris:scheduler`, 4x `opengris:worker`, 1x `opengris:worker-manager` (native, priority 1), 1x `opengris:worker-manager` (ecs, priority 2), 1x `opengris:object-storage`, 1x `opengris:client` (risk engine)

**Key metadata:**
- Native manager: `manager_type=native`, `priority=1`, `max_workers=8`
- ECS manager: `manager_type=ecs`, `priority=2`, `ecs_cluster=risk-scaler-cluster`, `ecs_task_definition=scaler-worker`
- scheduler: `worker_manager_waterfall` auto-derived from priorities

**Expected TOML sections:** `[scheduler]` with waterfall, `[cluster]`, `[native_worker_manager]`, `[ecs_worker_manager]`, `[object_storage_server]`

### Template 3: OpenGRIS Scientific Research (HPC Batch)

**Use case:** Research institution with HPC cluster (AWS HPC Batch).

**Nodes:** 1x `opengris:scheduler`, 8x `opengris:worker`, 1x `opengris:worker-manager` (aws_hpc, priority 1), 1x `opengris:object-storage`, 1x `opengris:task-graph`

**Key metadata:**
- HPC manager: `manager_type=aws_hpc`, `aws_region=us-east-1`, `hpc_queue=scaler-queue`, `priority=1`
- task-graph: `max_parallel_tasks=16`

**Expected TOML sections:** `[scheduler]`, `[cluster]`, `[aws_hpc_worker_manager]`, `[object_storage_server]`, `[top]`

### Template 4: OpenGRIS Multi-Cloud (native + ECS + Symphony)

**Use case:** Enterprise deployment with three-tier waterfall.

**Nodes:** 1x `opengris:scheduler`, 1x `opengris:worker-manager` (native, priority 1), 1x `opengris:worker-manager` (ecs, priority 2), 1x `opengris:worker-manager` (symphony, priority 3), 1x `opengris:object-storage`, 1x `opengris:client`

**Expected TOML sections:** `[scheduler]` with 3-tier waterfall, `[cluster]`, `[native_worker_manager]`, `[ecs_worker_manager]`, `[symphony_worker_manager]`, `[object_storage_server]`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No TOML export | `exportAsScalerToml` (Phase 15) | Now | New capability for OpenGRIS users |
| No OpenGRIS templates | 4 turnkey OpenGRIS templates | Now | Load → Export → working config workflow |
| Static DEMOS list | DEMOS extended with opengris entry | Now | Demo accessible from welcome screen |
| Export dropdown always shows all options | Conditional Scaler.toml item | Now | Cleaner UX — option only when relevant |

**Deprecated/outdated:**
- None for this phase. All changes are additive.

---

## Open Questions

1. **Exact OpenGRIS Scaler.toml default port numbers**
   - What we know: Scheduler conventionally uses ZeroMQ TCP addresses. The format is `tcp://host:port`.
   - What's unclear: Official default ports are not confirmed from documentation in this research. `8516` and `8517` are used as placeholders.
   - Recommendation: Accept as Claude's discretion. Use `8516` for scheduler, `8517` for object-storage as consistent defaults. Document as defaults in TOML comments so users know to change them.

2. **Whether `[top]` section is distinct or part of scheduler**
   - What we know: CONTEXT.md lists `[top]` as a separate section. OpenGRIS uses "top" as a task orchestration layer.
   - What's unclear: Whether `[top]` is always present or only when task-graph/parallel-function nodes exist.
   - Recommendation: Emit `[top]` only when `opengris:task-graph` or `opengris:parallel-function` nodes are present. This matches the pattern of other sections only being emitted when their corresponding node exists.

3. **Worker node multiplicity in TOML**
   - What we know: Multiple `opengris:worker` nodes on the canvas represent a worker pool.
   - What's unclear: Whether TOML has a `[worker]` section or workers are configured via manager.
   - Recommendation: Workers are not represented as individual TOML sections. The worker count is expressed via `max_workers` on the worker-manager node. Count `opengris:worker` nodes to derive a default `max_workers` value.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/studio/vitest.config.ts` (inferred from project pattern) |
| Quick run command | `cd apps/studio && pnpm test` |
| Full suite command | `pnpm test` (from root, covers all packages) |

### Phase Requirements → Test Map

No formal REQ-IDs were specified for this phase. Mapping by deliverable:

| Deliverable | Behavior | Test Type | Automated Command | File Status |
|-------------|----------|-----------|-------------------|-------------|
| `buildScalerToml` | Emits `[scheduler]` section for scheduler node | unit | `cd apps/studio && pnpm test src/tests/io/scalerToml` | Wave 0 gap |
| `buildScalerToml` | Uses customMetadata values over defaults | unit | same | Wave 0 gap |
| `buildScalerToml` | Falls back to defaults when metadata absent | unit | same | Wave 0 gap |
| `buildScalerToml` | Emits waterfall policy for multiple worker-managers | unit | same | Wave 0 gap |
| `buildScalerToml` | Sorts waterfall by `priority` metadata ascending | unit | same | Wave 0 gap |
| `buildScalerToml` | Emits correct section name per `manager_type` | unit | same | Wave 0 gap |
| `buildScalerToml` | Skips non-opengris nodes silently | unit | same | Wave 0 gap |
| `exportAsScalerToml` | Calls `downloadDataUrl` with `.toml` filename | unit | `cd apps/studio && pnpm test src/tests/io/export` | Extend existing |
| `hasOpenGrisNodes` | Returns true when opengris: nodes present | unit | same | Wave 0 gap (in export.test.ts) |
| Template registration | `initAllTemplates` registers 10 templates total (6 + 4) | unit | `cd apps/studio && pnpm test src/tests/templates` | Extend existing |
| Template category | `getTemplatesByCategory('opengris')` returns 4 templates | unit | same | Extend existing |
| Toolbar | Scaler.toml button hidden when `showScalerTomlExport=false` | unit | `cd apps/studio && pnpm test src/tests/components/Toolbar` | Extend existing |
| Toolbar | Scaler.toml button visible when `showScalerTomlExport=true` | unit | same | Extend existing |
| Demo file | `opengris-local-cluster.calm.json` is valid CALM JSON | unit | `cd apps/studio && pnpm test` (JSON parse) | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `cd apps/studio && pnpm test src/tests/io/scalerToml`
- **Per wave merge:** `cd apps/studio && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/studio/src/tests/io/scalerToml.test.ts` — new file, covers all `buildScalerToml` behaviors
- [ ] `apps/studio/src/lib/io/scalerToml.ts` — new file, the pure TOML builder (implementation)
- [ ] Extend `apps/studio/src/tests/io/export.test.ts` — add `exportAsScalerToml` download behavior tests
- [ ] Extend `apps/studio/src/tests/templates/registry.test.ts` — update count assertions from 6 to 10
- [ ] Extend `apps/studio/src/tests/components/Toolbar.test.ts` — add `showScalerTomlExport` conditional rendering tests

---

## Sources

### Primary (HIGH confidence)

- Codebase reading — `apps/studio/src/lib/io/export.ts` — confirmed export function pattern
- Codebase reading — `apps/studio/src/lib/templates/registry.ts` — confirmed template registration pattern
- Codebase reading — `apps/studio/src/lib/toolbar/Toolbar.svelte` — confirmed export dropdown structure and conditional rendering (showGovernanceBadge pattern)
- Codebase reading — `packages/calm-core/src/types.ts` line 100-101 — confirmed `customMetadata: Record<string, string>` on CalmNode
- Codebase reading — `apps/studio/src/lib/io/sidecar.ts` — confirmed `detectPacksFromArch` reusability
- Codebase reading — `packages/extensions/src/packs/opengris.ts` — confirmed node type IDs and pack ID `'opengris'`
- Codebase reading — `apps/studio/src/lib/templates/fluxnova-flash-risk.json` — confirmed template JSON structure with `_template`, `customMetadata`, `nodes`, `relationships`
- Codebase reading — `apps/studio/src/tests/io/export.test.ts` — confirmed Blob/URL mock pattern for testing export functions
- Codebase reading — `apps/studio/package.json` — confirmed no TOML library present; none needed

### Secondary (MEDIUM confidence)

- CONTEXT.md (15-CONTEXT.md) — Scaler.toml section names `[scheduler]`, `[cluster]`, `[native_worker_manager]`, `[ecs_worker_manager]`, `[symphony_worker_manager]`, `[aws_hpc_worker_manager]`, `[object_storage_server]`, `[webui]`, `[top]` — taken from user discussion with OpenGRIS documentation

### Tertiary (LOW confidence)

- Default port numbers (8516/8517) — inferred from common ZeroMQ convention; official OpenGRIS defaults not confirmed from documentation in this session. Flag for validation against official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in-project, no new dependencies
- Architecture: HIGH — all patterns directly observed in existing production code
- Pitfalls: HIGH (structural) / MEDIUM (TOML type coercion) — structural pitfalls confirmed by code reading; TOML typing requires validation against real Scaler binary
- Template designs: MEDIUM — structure is confirmed correct; field names and defaults require OpenGRIS doc validation

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain — TOML format and existing codebase patterns are stable)
