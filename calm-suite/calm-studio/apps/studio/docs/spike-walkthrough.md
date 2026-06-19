# calm-studio visualization revamp — spike walkthrough

This branch (`feat/calm-studio-viz-revamp`) implements the foundation for a richer
visualization layer in calm-studio: decorator-driven badges, threat-severity tints,
faceted grouping primitives, position persistence, and supporting integration glue.
The spike is staged in two parts; this PR delivers Part 1 (foundation) and queues
Part 2 (canvas wiring + UI polish) for follow-up work.

## Why this work exists

Today, calm-studio renders the topology of a CALM 1.2 document but loses much of
the governance richness the schema already supports — threats, controls,
mitigations, and decorators are not represented visually. An architect editing
the document cannot see, at a glance, where threats concentrate or which nodes
lack controls. The canonical example below makes this concrete.

See the [tracking issue (#2686)](https://github.com/finos/architecture-as-code/issues/2686)
and the [design doc](../../../../.planning/specs/2026-06-19-calm-studio-viz-revamp-design.md)
for full context.

## What's in this PR (Part 1 — foundation)

### Pure modules (`packages/calm-core/src/viz/`)

Framework-agnostic TypeScript that both Svelte (calm-studio) and React
(calm-hub-ui) could consume — structured for the eventual extraction to a
shared `@finos/calm-viz-core` package proposed in a forthcoming RFC.

- **`badges/BadgeAPI.ts`** — adapter registry. Pass a `CalmArchitecture` and a
  set of adapters; receive an index that maps node and edge IDs to `Badge[]`.
- **`badges/adapters/decoratorsAdapter.ts`** — reads canonical CALM 1.2
  `decorators[]` on nodes and relationships. Emits one badge per decorator
  with severity inferred from `data.severity` (or legacy `risk-level`, or the
  decorator type itself). Malformed entries are logged and skipped, not thrown.
- **`badges/adapters/controlsAdapter.ts`** — counts a node's `controls{}`
  entries, emits a `count` badge with severity scaled by total control count.
- **`overlay/severityResolver.ts`** — aggregates the highest severity seen
  across all badges for a node. Used to drive node-border tints in
  threat-overlay mode (Part 2).
- **`grouping/dimensions.ts`** — five facet extractors: container (via
  composed-of relationships), node-type, AI domain (the segment after `ai:`),
  owner (from `metadata.owner`), and a custom dotted-path key.
- **`grouping/groupingEngine.ts`** — applies a dimension across an
  architecture and returns virtual groups + a node-to-group map. Future ELK
  integration will use this as virtual parents for nested layout.
- **`positions/positionStore.ts`** — framework-agnostic localStorage wrapper
  for persisting user-dragged node positions per architecture ID. Falls back
  to an in-memory map on `QuotaExceededError` so the canvas stays interactive.

All modules are pure TypeScript with no Svelte runes — the deliberate boundary
that keeps future extraction to a shared package as relocation rather than
rewrite.

**Test coverage:** 36 new vitest cases land alongside the modules. Pre-existing
calm-core suite (82 tests) stays green. Total: 118 passing + 1 todo.

### Canonical fixture

`apps/studio/static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json`
is a real-world reference architecture migrated to canonical CALM 1.2 shape:

- 79 nodes (12 systems, 7 AI agents, 3 orchestrators, 9 MCP servers, 9 services,
  7 observability surfaces, 4 guardrails, 3 gateways, ...)
- 70 relationships (13 composed-of, 57 connects, 6 interacts; no messy
  cross-hierarchy edges)
- **58 threat decorators** moved from a legacy `metadata.threat-model.threats[]`
  block into per-node `decorators[]` with severity, layer, communication path,
  AIGF risk mappings, and mitigations text preserved.
- 294 control references retained on their original nodes.

The doc renders cleanly in calm-hub today; calm-studio is being brought to
visual parity with it as the spike progresses.

### Svelte 5 stores and components

- **`apps/studio/src/lib/viz/overlay/overlayStore.svelte.ts`** —
  `createOverlayStore()`: `mode: 'default' | 'threat'`, with `toggle()` and
  `setMode()`. Used to drive the threat-overlay UI in Part 2.
- **`apps/studio/src/lib/viz/grouping/groupingStore.svelte.ts`** —
  `createGroupingStore(initial: Dimension)`: holds the active facet dimension
  and a custom dotted-path key.
- **`apps/studio/src/lib/viz/badges/BadgeChip.svelte`** — single badge chip
  with a severity-tinted dot, monospace label, hover-tooltip. Direction A
  visual baseline (Linear-restrained).
- **`apps/studio/src/lib/viz/badges/BadgeCluster.svelte`** — renders an array
  of badges as a wrapped chip cluster.
- **`apps/studio/src/lib/viz/nodes/NodeFrame.svelte`** — wrapper that adds a
  severity-driven gradient border tint and a top-right badge cluster slot
  around any node body. Existing node bodies + styles remain untouched.
- **`apps/studio/src/lib/canvas/nodes/ServiceNode.svelte`** and **`ActorNode.svelte`** —
  refactored as a canary: body wrapped in `<NodeFrame {badges} {severity}>`
  consuming the values from `node.data`.
- **`apps/studio/src/lib/viz/integration/decorateFlowNodes.ts`** — integration
  helper that takes an array of Svelte Flow nodes plus a `BadgeIndex` and
  `SeverityIndex`, and returns a new array with each node's `data` augmented
  with `badges` and `severity`. Designed to be plugged into `CalmCanvas.svelte`
  in Part 2 without disturbing its existing `$state.raw` reactivity model.

## What's queued for Part 2 (next session)

These items are scoped in the [design doc](../../../../.planning/specs/2026-06-19-calm-studio-viz-revamp-design.md)
and tracked in issue #2686 but not in this PR:

- Replicate `NodeFrame` adoption to the remaining 9 node types
  (`SystemNode`, `DatabaseNode`, `WebclientNode`, `EcosystemNode`, `LdapNode`,
  `DataAssetNode`, `GenericNode`, `ContainerNode`, `ExtensionNode`).
- Hub-UI parity: drop redundant `composed-of` edge when parent-child nesting
  applies; bidirectional `connects` edges; minimap; rich hover tooltip.
- `OverlayToggle` + `ThreatPanel` (consumes `overlayStore`).
- `GroupingDropdown` + ELK integration of virtual groups
  (consumes `groupingStore`).
- `DetailDrawer` + four sections (controls, threats, decorators,
  composed-of children) on node selection.
- Wire `decorateFlowNodes` and position persistence into
  `CalmCanvas.svelte`'s state setup.
- Integration test against the canonical fixture; perf-smoke at 300 nodes.

## How to manually demo Part 1 today

1. Build and check the pure modules:

   ```bash
   npm run build --workspace calm-suite/calm-studio/packages/calm-core
   npm test --workspace calm-suite/calm-studio/packages/calm-core
   ```

   You should see a clean build and `118 passed | 1 todo`.

2. Load the canonical fixture into a Node REPL and exercise the API surface:

   ```js
   import { readFileSync } from 'fs';
   import {
     createBadgeAPI,
     decoratorsAdapter,
     controlsAdapter,
     createSeverityResolver,
     dimensions,
     applyGrouping,
   } from '@calmstudio/calm-core';

   const arch = JSON.parse(
     readFileSync(
       'calm-suite/calm-studio/apps/studio/static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json',
       'utf8',
     ),
   );

   const badges = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
   const severity = createSeverityResolver(badges, arch);
   const groups = applyGrouping(arch, dimensions.aiDomain);

   console.log('agent-gateway threats:', badges.forNode('agent-gateway').filter(b => b.data?.decoratorType === 'threat').length);
   console.log('agent-gateway severity:', severity.forNode('agent-gateway'));
   console.log('AI domain groups:', Array.from(groups.virtualGroups.keys()));
   ```

   You should see threat counts per node, a `'critical'` severity for nodes
   with cross-layer threats, and the AI domain grouping bucketing nodes by
   the segment after `ai:`.

3. Inspect the canary in dev mode (visual cue, not full integration):

   ```bash
   npm run dev --workspace=@calmstudio/studio
   ```

   The `NodeFrame` wrapper is now active on `ServiceNode` and `ActorNode`.
   The severity-tint border and badge cluster will appear once the canvas is
   wired (Part 2). For now the wrapper renders transparently and existing
   styles are preserved.

## Related artifacts

- Sandbox migration script (gitignored, not in this PR):
  `sandbox/calm-studio-viz-spike/migrate-threat-model.mjs` — converted the
  loan-approval doc from `metadata.threat-model.*` to canonical
  `decorators[]`. Run on the source `~/Downloads/loan_approval_solution_arch_2026.calm.json`
  to reproduce the fixture.

- Design doc (gitignored, lives under `.planning/specs/`):
  `2026-06-19-calm-studio-viz-revamp-design.md` — full goals, architecture,
  test plan, and rollout for the spike.

- Future RFC (drafted, not yet filed): shared CALM semantics layer
  (`@finos/calm-viz-core`) for alignment between calm-hub-ui and calm-studio.
  Will be opened post-spike so its boundary discussion is informed by
  concrete code shipped here.
