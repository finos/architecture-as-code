# Phase 14: OpenGRIS Extension Pack - Research

**Researched:** 2026-03-20
**Domain:** CalmStudio extension pack system — FINOS OpenGRIS node types
**Confidence:** HIGH (pack system patterns verified in codebase), MEDIUM (OpenGRIS architecture details from official docs and README)

---

## Summary

Phase 14 adds a new `opengris` extension pack to CalmStudio's `packages/extensions` package. The pattern is completely established by Phases 7 and 8.1 — every extension pack follows the same three-file recipe: an icons file (`src/icons/opengris.ts`), a pack definition file (`src/packs/opengris.ts`), and registration in `src/index.ts`. No new abstractions are needed.

OpenGRIS is a FINOS-incubating open standard for distributed grid computing. Its reference implementation (opengris-scaler) uses a hub-and-spoke topology: a central **Scheduler** routes tasks submitted by **Clients** (via TCP/ZeroMQ) to **Workers**. **Worker Managers** are provisioning adapters (Baremetal, AWS Batch, AWS ECS, IBM Symphony) that create and destroy workers dynamically. An **Object Storage Server** (C++ for performance) holds serialized task arguments and results. Two higher-level abstractions live in separate repos: **opengris-pargraph** (DAG-based task dependency engine, Dask-like) and **opengris-parfun** (`@parallel` decorator for function-level map-reduce parallelism).

The pack will ship 8 node types under the `opengris:` namespace with two containers (`opengris:worker-manager` and `opengris:cluster`). Icons are hand-crafted abstract SVGs in the established 16x16 stroke-based style — no official OpenGRIS icon set exists. A matching test file mirrors the `fluxnova.test.ts` pattern.

**Primary recommendation:** Follow the fluxnova pack exactly. Three new files, update two existing files (`index.ts` and one test), and the pack is live.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript strict | `^5.7.0` | Type safety for pack definition | Already in `packages/extensions` tsconfig |
| Vitest | `^4.1.0` | Unit tests for pack definition | Already configured in `vitest.config.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `PackDefinition` | (project type) | Typed pack structure | Required for all packs |
| `NodeTypeEntry` | (project type) | Per-node metadata | Required for each node type |
| `PackColor` | (project type) | Color family for badge, bg, border, stroke | Required for visual identity |

No external packages are needed. All infrastructure is in place.

**Installation:**
```bash
# No new dependencies — extensions package already has everything
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/extensions/src/
├── icons/
│   └── opengris.ts          # NEW: hand-crafted SVGs for 8 node types
├── packs/
│   └── opengris.ts          # NEW: OpenGRIS PackDefinition
├── index.ts                 # MODIFY: export openGrisPack, add to initAllPacks()
└── registry.test.ts         # MODIFY: update pack count assertion (9 → 10)
```

A dedicated test file `src/packs/opengris.test.ts` is also needed (mirrors `fluxnova.test.ts` pattern).

### Pattern 1: Three-File Pack

Every extension pack in this codebase follows the same structure:

**File 1: `src/icons/opengris.ts`**
```typescript
// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0
// Hand-crafted abstract SVG icons for OpenGRIS node types (16x16 viewBox, stroke-based).

export const opengrisIcons: Record<string, string> = {
  scheduler: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">...</svg>`,
  worker: `...`,
  'worker-manager': `...`,
  client: `...`,
  'object-storage': `...`,
  cluster: `...`,
  'task-graph': `...`,
  'parallel-function': `...`,
};
```

**File 2: `src/packs/opengris.ts`**
```typescript
// Source: matches fluxnova.ts pattern exactly
import type { PackDefinition, PackColor } from '../types.js';
import { opengrisIcons } from '../icons/opengris.js';

const opengrisColor: PackColor = {
  bg: '#f0fdf4',        // green-50 — evokes distributed compute/grid
  border: '#16a34a',    // green-600
  stroke: '#15803d',    // green-700
  badge: '[OGRIS]',
};

function node(
  typeId: string,
  label: string,
  iconKey: string,
  description: string,
  opts?: { isContainer?: boolean; defaultChildren?: string[] },
): PackDefinition['nodes'][number] {
  return {
    typeId,
    label,
    icon: opengrisIcons[iconKey] ?? opengrisIcons['scheduler']!,
    color: opengrisColor,
    description,
    ...(opts?.isContainer ? { isContainer: true } : {}),
    ...(opts?.defaultChildren ? { defaultChildren: opts.defaultChildren } : {}),
  };
}

export const openGrisPack: PackDefinition = {
  id: 'opengris',
  label: 'OpenGRIS',
  version: '1.0.0',
  color: opengrisColor,
  nodes: [
    node('opengris:scheduler', 'Scheduler', 'scheduler', 'Central task routing hub...'),
    node('opengris:worker', 'Worker', 'worker', 'Executes distributed tasks...'),
    node('opengris:worker-manager', 'Worker Manager', 'worker-manager',
         'Provisions and terminates workers...', { isContainer: true }),
    node('opengris:client', 'Client', 'client', 'Submits tasks to the scheduler...'),
    node('opengris:object-storage', 'Object Storage', 'object-storage',
         'Stores serialized task arguments and results...'),
    node('opengris:cluster', 'Cluster', 'cluster',
         'Container grouping scheduler, workers, and object storage...',
         { isContainer: true, defaultChildren: ['opengris:scheduler', 'opengris:worker', 'opengris:object-storage'] }),
    node('opengris:task-graph', 'Task Graph', 'task-graph', 'DAG-based task dependency graph...'),
    node('opengris:parallel-function', 'Parallel Function', 'parallel-function',
         '@parallel decorated function executing via map-reduce...'),
  ],
};
```

**File 3: `src/packs/opengris.test.ts`** — mirrors `fluxnova.test.ts`:
```typescript
// Source: mirrors fluxnova.test.ts pattern
import { describe, it, expect, beforeEach } from 'vitest';
import { openGrisPack } from './opengris.js';
import { initAllPacks } from '../index.js';
import { getAllPacks, resolvePackNode, resetRegistry } from '../registry.js';

describe('openGrisPack', () => {
  it('openGrisPack has id "opengris"', () => {
    expect(openGrisPack.id).toBe('opengris');
  });
  it('openGrisPack has 8 node type entries', () => {
    expect(openGrisPack.nodes).toHaveLength(8);
  });
  it('every node entry has non-empty typeId, label, icon, color, description', () => { ... });
  it('all typeIds start with "opengris:" prefix', () => { ... });
  it('opengris:worker-manager has isContainer=true', () => { ... });
  it('opengris:cluster has isContainer=true', () => { ... });
  it('no other OpenGRIS type has isContainer=true', () => { ... });
  it('opengris:cluster defaultChildren includes opengris:scheduler', () => { ... });
});

describe('OpenGRIS integration via initAllPacks', () => {
  beforeEach(() => { resetRegistry(); });

  it('initAllPacks() registers 10 packs total', () => {
    initAllPacks();
    expect(getAllPacks()).toHaveLength(10);  // was 9
  });
  it('resolvePackNode("opengris:scheduler") returns non-null after initAllPacks()', () => {
    initAllPacks();
    expect(resolvePackNode('opengris:scheduler')).not.toBeNull();
  });
});
```

**Modifications to `src/index.ts`:**
```typescript
// Add after existing imports:
export { openGrisPack } from './packs/opengris.js';
import { openGrisPack } from './packs/opengris.js';

// In initAllPacks():
export function initAllPacks(): void {
  // ...existing packs...
  registerPack(openGrisPack);   // add this line
}
```

**Modification to `src/registry.test.ts`:**
```typescript
// Two tests need updating:
it('getAllPacks() returns 10 packs after initAllPacks()', () => {  // was 9
  initAllPacks();
  expect(getAllPacks()).toHaveLength(10);
});
// The fluxnova.test.ts also has: 'initAllPacks() registers 9 packs total' → update to 10
```

Note: `fluxnova.test.ts` line 59 also asserts `toHaveLength(9)` — that test must be updated to `10`.

### Pattern 2: Container Nodes

Two OpenGRIS nodes use `isContainer: true`:

- `opengris:worker-manager` — acts as a deployment container that holds workers, matches the provisioning adapter concept (Baremetal, AWS Batch, AWS ECS, IBM Symphony are "types" of worker manager, not separate nodes)
- `opengris:cluster` — groups the full Scaler deployment (scheduler + workers + object storage) as a single logical grouping

`opengris:cluster` also uses `defaultChildren` to pre-populate the canvas with the three essential components when dropped.

### Anti-Patterns to Avoid

- **Separate node type per Worker Manager adapter:** Do not create `opengris:aws-batch-worker-manager`, `opengris:symphony-worker-manager` etc. The Worker Manager is the concept; the adapter is configuration, not architecture topology.
- **Treating parfun/pargraph as infrastructure components:** `opengris:task-graph` and `opengris:parallel-function` represent logical programming abstractions (DAG, decorated function), not running servers. They appear in architecture diagrams as compute patterns, not deployment units.
- **Making `opengris:cluster` a hard container:** Keep `isContainer: true` but do not enforce that children must be specific types — the canvas allows any children.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pack type system | Custom interfaces | Existing `PackDefinition`, `NodeTypeEntry`, `PackColor` from `src/types.ts` | Already designed for exactly this purpose |
| Pack registry | New registry | Existing `registerPack`/`resolvePackNode` in `src/registry.ts` | Tested, works with colon-prefixed IDs |
| SVG icons | Third-party icon library | Hand-crafted inline SVGs (16x16 viewBox, stroke-based) | This is the established codebase standard; no official OpenGRIS icon set exists |
| Test scaffolding | Custom test helpers | Vitest with `fluxnova.test.ts` as template | Pattern already proven, coverage thresholds established |

**Key insight:** This phase is additive, not architectural. Zero new abstractions are needed.

---

## Common Pitfalls

### Pitfall 1: Forgetting the `registry.test.ts` Pack Count
**What goes wrong:** The test `'getAllPacks() returns 9 packs after initAllPacks()'` in `registry.test.ts` will fail after adding the 10th pack.
**Why it happens:** The count assertion is hardcoded to 9 and must be updated.
**How to avoid:** Update both `registry.test.ts` AND `fluxnova.test.ts` (line ~59, the integration block also asserts pack count = 9).
**Warning signs:** `expected 10 to deeply equal 9` in test output.

### Pitfall 2: Wrong Export Name
**What goes wrong:** Other packs use names like `awsPack`, `kubernetesPack`, `fluxnovaPack`. The OpenGRIS pack should be `openGrisPack` (camelCase with capital G) to match the FINOS project name casing.
**Why it happens:** Inconsistent naming conventions.
**How to avoid:** Export as `openGrisPack` in the pack file, import and register under the same name.

### Pitfall 3: TypeId Prefix Must Match Pack `id`
**What goes wrong:** Registry lookup splits on `:` to find the pack by `id`. If `typeId` is `'opengris:scheduler'` but pack `id` is `'openGRIS'` or `'open-gris'`, `resolvePackNode` returns null.
**Why it happens:** `registry.ts` uses `calmType.slice(0, colonIdx)` as the key.
**How to avoid:** Pack `id` must be exactly `'opengris'` (lowercase, no hyphens), matching the prefix in all typeIds.

### Pitfall 4: Missing `.js` Extension in Import
**What goes wrong:** TypeScript ESM imports require `.js` extension even for `.ts` source files. Import without `.js` will fail at runtime.
**Why it happens:** TypeScript compiles `.ts` to `.js`; the import path must reference the output.
**How to avoid:** Use `from '../icons/opengris.js'` not `from '../icons/opengris'` — match all other pack files.

### Pitfall 5: SVG Must Not Be Empty
**What goes wrong:** `registry.test.ts` line ~190 asserts `node.icon.trim().length > 0` for every node in every pack. An empty or missing icon key fails the test.
**Why it happens:** Icon key in pack definition doesn't match key in icons Record.
**How to avoid:** Icon keys in `opengrisIcons` Record must exactly match the `iconKey` arguments passed to `node()`. The fallback is `opengrisIcons['scheduler']!` so at minimum the `scheduler` key must always exist.

---

## Code Examples

Verified patterns from the codebase:

### Icon File Format (16x16 viewBox, stroke-based)
```typescript
// Source: packages/extensions/src/icons/fluxnova.ts (established codebase pattern)
export const opengrisIcons: Record<string, string> = {
  scheduler: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <!-- Hub/spoke routing: central hub with radial connections -->
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M3.5 3.5l1.8 1.8M10.7 10.7l1.8 1.8" stroke-linecap="round"/>
  </svg>`,

  worker: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <!-- Worker: processing unit / gear-like -->
    <rect x="3" y="4" width="10" height="8" rx="1.5"/>
    <path d="M6 8h4M8 6v4" stroke-linecap="round"/>
  </svg>`,

  'worker-manager': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <!-- Manager: container with smaller worker boxes inside -->
    <rect x="1" y="3" width="14" height="10" rx="1.5" stroke-dasharray="3 2"/>
    <rect x="3" y="6" width="4" height="4" rx="1"/>
    <rect x="9" y="6" width="4" height="4" rx="1"/>
  </svg>`,

  // ... remaining icons follow same conventions
};
```

### Registry Registration (from `src/index.ts` pattern)
```typescript
// Source: packages/extensions/src/index.ts (existing pattern)
export { openGrisPack } from './packs/opengris.js';
import { openGrisPack } from './packs/opengris.js';

export function initAllPacks(): void {
  registerPack(corePack);
  registerPack(fluxnovaPack);
  registerPack(aiPack);
  registerPack(awsPack);
  registerPack(gcpPack);
  registerPack(azurePack);
  registerPack(kubernetesPack);
  registerPack(messagingPack);
  registerPack(identityPack);
  registerPack(openGrisPack);    // new line
}
```

### Test File Structure (from `fluxnova.test.ts` pattern)
```typescript
// Source: packages/extensions/src/packs/fluxnova.test.ts (established pattern)
describe('openGrisPack', () => {
  it('openGrisPack has id "opengris"', () => { ... });
  it('openGrisPack has 8 node type entries', () => { ... });
  it('every node entry has non-empty typeId, label, icon, color, description', () => { ... });
  it('all typeIds start with "opengris:" prefix', () => { ... });
  it('opengris:worker-manager has isContainer=true', () => { ... });
  it('opengris:cluster has isContainer=true', () => { ... });
  it('no other OpenGRIS type has isContainer=true', () => { ... });
  it('opengris:cluster defaultChildren includes opengris:scheduler', () => { ... });
  it('openGrisPack.color.bg is "#f0fdf4" (green family)', () => { ... });
});

describe('OpenGRIS integration via initAllPacks', () => {
  beforeEach(() => { resetRegistry(); });
  it('initAllPacks() registers 10 packs total', () => { ... });
  it('resolvePackNode("opengris:scheduler") returns non-null after initAllPacks()', () => { ... });
});
```

---

## OpenGRIS Component Descriptions

The 8 node types and their authoritative one-line descriptions for the pack definition:

| typeId | Label | Description | isContainer |
|--------|-------|-------------|-------------|
| `opengris:scheduler` | Scheduler | Central hub that routes tasks from clients to available workers via Cap'n Proto/ZeroMQ | No |
| `opengris:worker` | Worker | Executes distributed tasks assigned by the scheduler; runs on GNU/Linux | No |
| `opengris:worker-manager` | Worker Manager | Provisions and terminates workers on demand via adapters (Baremetal, AWS Batch, AWS ECS, IBM Symphony) | Yes |
| `opengris:client` | Client | Submits tasks to the scheduler and retrieves results; cross-platform (Windows/Linux) | No |
| `opengris:object-storage` | Object Storage | Stores serialized task arguments and results; C++ implementation for performance | No |
| `opengris:cluster` | Cluster | Container grouping a full Scaler deployment (scheduler, workers, object storage) | Yes (defaultChildren: scheduler, worker, object-storage) |
| `opengris:task-graph` | Task Graph | DAG-based task dependency graph from opengris-pargraph; nodes are functions, edges are data dependencies | No |
| `opengris:parallel-function` | Parallel Function | Function decorated with `@parallel` from opengris-parfun executing via map-reduce across worker pool | No |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Adding packs requires new canvas node components | Single `ExtensionNode.svelte` handles all packs via PackMeta | Phase 7 | Adding a new pack requires zero canvas code changes |
| Manual pack registration | `initAllPacks()` registers all built-in packs | Phase 7 | Single call in app startup; test updates the count assertion |
| 9 packs registered | 10 packs registered after Phase 14 | Phase 14 | `getAllPacks().toHaveLength(9)` assertions → `toHaveLength(10)` |

**Currently registered:** `core`, `fluxnova`, `ai`, `aws`, `gcp`, `azure`, `k8s`, `messaging`, `identity` (9 packs).
**After Phase 14:** `opengris` added (10 packs).

---

## Open Questions

1. **Color family for OpenGRIS**
   - What we know: No official OpenGRIS brand color exists in published materials
   - What's unclear: Whether FINOS/OpenGRIS community has established colors
   - Recommendation: Use green (`#f0fdf4` bg, `#16a34a` border) as a neutral "compute/grid" color distinct from all existing packs (AI=purple, K8s=blue, AWS=orange, GCP=multi, Azure=blue, Messaging=teal, Identity=red, FluxNova=orange). If a brand color is published later, it's a one-line change.

2. **Parfun and Pargraph nodes in architecture diagrams**
   - What we know: These are Python libraries/decorators, not running services
   - What's unclear: Whether architects will use these as logical abstractions in CALM diagrams
   - Recommendation: Include them — CALM supports logical/conceptual nodes, not only deployed services. Mark descriptions clearly as "programming abstraction."

3. **Worker Manager as container vs. standalone**
   - What we know: K8s namespace uses `isContainer: true` for similar grouping concept
   - What's unclear: Whether users will drag workers into a worker-manager container or just connect them
   - Recommendation: `isContainer: true` (consistent with K8s namespace pattern); no `defaultChildren` since workers are provisioned dynamically.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `packages/extensions/vitest.config.ts` |
| Quick run command | `pnpm --filter @calmstudio/extensions test` |
| Full suite command | `pnpm --filter @calmstudio/extensions test` |

### Phase Requirements → Test Map

No formal requirement IDs were assigned to Phase 14. The implicit requirements map as follows:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `openGrisPack.id === 'opengris'` | unit | `pnpm --filter @calmstudio/extensions test` | ❌ Wave 0 |
| Pack has exactly 8 node entries | unit | same | ❌ Wave 0 |
| All typeIds prefixed `opengris:` | unit | same | ❌ Wave 0 |
| `opengris:worker-manager` is container | unit | same | ❌ Wave 0 |
| `opengris:cluster` is container with defaultChildren | unit | same | ❌ Wave 0 |
| No other type is container | unit | same | ❌ Wave 0 |
| All icons non-empty strings | unit | same | ❌ Wave 0 |
| All colors non-empty (bg/border/stroke) | unit | same | ❌ Wave 0 |
| `initAllPacks()` registers 10 packs | unit | same | ❌ Wave 0 (existing count asserts need update) |
| `resolvePackNode('opengris:scheduler')` non-null | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/extensions test`
- **Per wave merge:** `pnpm --filter @calmstudio/extensions test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/extensions/src/packs/opengris.test.ts` — all pack-specific assertions
- [ ] `packages/extensions/src/icons/opengris.ts` — icon stubs (can be empty SVGs in Wave 0, filled in Wave 1)
- [ ] Update `packages/extensions/src/registry.test.ts` line ~115: `toHaveLength(9)` → `toHaveLength(10)`
- [ ] Update `packages/extensions/src/packs/fluxnova.test.ts` line ~59: `toHaveLength(9)` → `toHaveLength(10)`

---

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/extensions/src/` — all pack patterns, types, registry, icon conventions verified directly
- Codebase: `packages/extensions/src/packs/fluxnova.test.ts` — definitive test pattern for new packs
- Codebase: `packages/extensions/src/index.ts` — definitive registration pattern (9 packs currently registered)

### Secondary (MEDIUM confidence)
- [finos/opengris-scaler README](https://github.com/finos/opengris-scaler) — Cap'n Proto + ZeroMQ protocol, hub-and-spoke topology, 4 core components confirmed
- [OpenGRIS Scaler documentation](https://finos.github.io/opengris-scaler/) — Worker Manager types (Baremetal, AWS Batch, AWS ECS, IBM Symphony), Object Storage Server role
- [finos/opengris README](https://github.com/finos/opengris) — standard governance scope, scaler/parfun/pargraph relationship
- [finos/opengris-parfun](https://github.com/finos/opengris-parfun) — `@parallel` decorator, map-reduce pattern
- [finos/opengris-pargraph](https://github.com/finos/opengris-pargraph) — `@delayed`/`@graph` decorators, DAG task graph concept

### Tertiary (LOW confidence)
- WebSearch: OpenGRIS Scaler last released 2026-03-12; Parfun last released 2025-10-30 — versions are actively maintained

---

## Metadata

**Confidence breakdown:**
- Pack implementation pattern: HIGH — verified directly in codebase across 9 existing packs
- OpenGRIS component topology: MEDIUM — from official GitHub README and documentation site
- OpenGRIS icon color choice: LOW — no official brand color published; green chosen as distinctive/available

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable — pack pattern won't change; OpenGRIS architecture changes slowly)
