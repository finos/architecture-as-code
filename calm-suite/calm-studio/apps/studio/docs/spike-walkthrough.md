# calm-studio visualization revamp — walkthrough

This branch (`feat/calm-studio-viz-revamp`) brings calm-studio's CALM 1.2
visualization to parity with calm-hub-ui and adds editor-specific affordances
that surface decorator-driven governance (threats, controls, mitigations) at
the canvas level.

Tracking issue: [#2686](https://github.com/finos/architecture-as-code/issues/2686).
Mid-term consolidation RFC: [#2690](https://github.com/finos/architecture-as-code/issues/2690).
Design doc: `.planning/specs/2026-06-19-calm-studio-viz-revamp-design.md` (gitignored).

## Why this work exists

Today, calm-studio renders the topology of a CALM 1.2 document but loses much
of the governance richness the schema already supports — threats, controls,
mitigations, and decorators are not represented visually. An architect editing
the document cannot see, at a glance, where threats concentrate or which nodes
lack controls. This change closes that gap.

## What ships in this branch

### Pure modules — `packages/calm-core/src/viz/`

Framework-agnostic TypeScript that both Svelte (calm-studio) and React
(calm-hub-ui) could consume — structured for the eventual extraction to a
shared `@finos/calm-viz-core` package proposed in RFC #2690.

- **`badges/BadgeAPI.ts`** — adapter registry. Pass a `CalmArchitecture` and a
  set of adapters; receive an index that maps node and edge IDs to `Badge[]`.
- **`badges/adapters/decoratorsAdapter.ts`** — reads canonical CALM 1.2
  `decorators[]` on nodes and relationships, infers severity from
  `data.severity`, legacy `risk-level`, or the decorator `type` itself.
  Malformed entries are logged and skipped, not thrown.
- **`badges/adapters/controlsAdapter.ts`** — counts a node's `controls{}`
  entries, emits a `count` badge with severity scaled by total control count.
- **`overlay/severityResolver.ts`** — aggregates the highest severity seen
  across all badges for a node. Drives node-border tints in threat-overlay
  mode.
- **`grouping/dimensions.ts`** + **`grouping/groupingEngine.ts`** — facet
  extractors (container / nodeType / aiDomain / owner / customKey) and virtual
  group construction. Reserved for ELK virtual-grouping integration in a
  follow-up phase.
- **`positions/positionStore.ts`** — framework-agnostic localStorage wrapper
  for persisting user-dragged node positions per architecture ID, with a
  quota-exceeded fallback to an in-memory map.

All modules are pure TypeScript with no Svelte runes — the deliberate boundary
that keeps future extraction to a shared package as relocation rather than
rewrite.

**Test coverage:** 36 unit tests + 8 integration tests against the canonical
loan-approval fixture (see below). Total calm-core suite: 118 passing.

### Canonical fixture

`apps/studio/static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json`
is a real-world reference architecture migrated to canonical CALM 1.2 shape:

- 79 nodes (12 systems, 7 AI agents, 3 orchestrators, 9 MCP servers, 9
  services, 7 observability surfaces, 4 guardrails, 3 gateways, …)
- 70 relationships (13 composed-of, 57 connects, 6 interacts; no messy
  cross-hierarchy edges)
- **58 threat decorators** moved from a legacy
  `metadata.threat-model.threats[]` block into per-node `decorators[]` with
  severity, layer, communication path, AIGF risk mappings, and mitigations
  text preserved.
- 294 control references retained on their original nodes.

### Svelte 5 viz layer — `apps/studio/src/lib/viz/`

- **Stores (`overlay/`, `grouping/`)** — `overlayStore.svelte.ts`
  (`mode: 'default' | 'threat'`) and `groupingStore.svelte.ts` (active facet
  dimension). Reactive via Svelte 5 runes.
- **Badge components (`badges/`)** — `BadgeChip.svelte` (single chip with
  severity-tinted dot) and `BadgeCluster.svelte` (wrapped chip cluster). Used
  by every node renderer through `NodeFrame`.
- **`nodes/NodeFrame.svelte`** — wrapper that adds a severity-driven gradient
  border tint and a top-right badge cluster slot around any node body. All
  11 node types (Service, Actor, System, Database, Webclient, Ecosystem,
  Ldap, Network, DataAsset, Generic, Container, Extension) now route through
  `NodeFrame` while keeping their existing icon SVGs and styles intact.
- **`overlay/OverlayToggle.svelte`** — toolbar button that flips the overlay
  store between `default` and `threat`. Disabled when the loaded architecture
  has no threats. Shown in the canvas toolbar.
- **`overlay/ThreatPanel.svelte`** — dockable right-side panel listing threats
  grouped by severity bucket (Critical / High / Medium / Low). Appears when
  overlay mode is `threat` AND no node is selected.
- **`drawer/DetailDrawer.svelte`** + four sections
  (`ControlsSection`, `ThreatsSection`, `DecoratorsSection`,
  `ComposedOfSection`) — selection-driven side panel. Replaces the
  `ThreatPanel` on the right anchor when a node is selected.
- **`integration/decorateFlowNodes.ts`** — wires the pure-module side and the
  Svelte side. `decorateFromArch(nodes, arch, { overlayMode })` produces a
  new array of Svelte Flow nodes with `data.badges` and `data.severity` set.
  `collectThreatBadges(arch)` extracts all threat decorator badges for the
  ThreatPanel.

### Canvas wiring — `apps/studio/src/lib/canvas/` + `apps/studio/src/routes/+page.svelte`

- `+page.svelte` calls `decorateFromArch` after every projection of the
  canonical model into Svelte Flow nodes (4 sites), passing the current
  overlay mode. A reactive effect re-decorates nodes when the user flips the
  toggle.
- `stores/projection.ts` suppresses redundant `composed-of` and `deployed-in`
  edges when their target is already nested under the source via `parentId`
  (Hub UI parity — matches `calm-hub-ui/src/visualizer/components/reactflow/relationshipParser.ts:170-172`).
  Cross-hierarchy edges (target NOT a direct child) still render so the
  relationship stays visible.
- `CalmCanvas.svelte` adds `<MiniMap>` with severity-tinted node dots in
  bottom-right, behind glass-blur material.
- `+page.svelte`'s canvas toolbar gains the `<OverlayToggle>` button.
- A selection-vs-overlay mutual exclusion governs the right-side surface:
  `DetailDrawer` wins when a node is selected; `ThreatPanel` returns when no
  selection and overlay mode is `threat`.

## How to demo

1. Run all tests and the calm-core build to confirm a green baseline:

   ```bash
   npm test --workspace calm-suite/calm-studio/packages/calm-core
   npm test --workspace @calmstudio/studio
   npm run build --workspace calm-suite/calm-studio/packages/calm-core
   ```

   Expect calm-core to report `118 passed | 1 todo`, the studio app to report
   `432+ passed` (or higher with this PR's added integration tests), and the
   calm-core build to finish cleanly with `ESM`, `CJS`, and `DTS` artifacts.

2. Boot the studio dev server:

   ```bash
   npm run dev --workspace=@calmstudio/studio
   ```

3. In the running app, import the canonical fixture:

   - Open the file dialog (or drop the file onto the canvas)
   - Pick `calm-suite/calm-studio/apps/studio/static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json`
   - The canvas renders the 79-node architecture with `composed-of` nesting
     visible as parent-child containers and connects edges between siblings.

4. Walk through the new affordances:

   - **Control badges** appear on every node with a `controls{}` block — the
     loan-approval doc has 294 control references across 13 nodes.
   - **Threat tints (overlay)** — click the **Default / Threats** toggle in the
     canvas toolbar (top-left of the floating bar). Node borders pick up the
     severity gradient — cyan for `low`, amber for `medium`, orange for
     `high`, rose for `critical`. The right-side **Threats** panel lists all
     58 threats grouped by severity bucket.
   - **Detail drawer** — click any node. The right-side panel becomes a
     **Detail Drawer** showing the node's description, controls with the
     count of threats each control mitigates, threats associated with the
     node (severity-coloured dots), other decorators, and `composed-of`
     children.
   - **Minimap** — bottom-right corner. Dots inherit severity tint while
     overlay mode is `threat`, default grey when overlay is off.
   - **Composed-of cleanliness** — note that the previously redundant diamond
     arrows on top of nested containers are gone. Containment is conveyed by
     the parent-child layout alone, matching calm-hub-ui's rendering.

## What's queued for follow-up

These items are scoped in the design doc but not in this PR:

- **Bidirectional `connects` edges** — when two `connects` relationships exist
  between the same pair of nodes in opposite directions, render both with a
  subtle offset. Cosmetic; deferred for scope.
- **`GroupingDropdown` + ELK virtual-grouping integration** — facet-driven
  re-layout (Container default, switchable to nodeType / `ai:*` domain /
  owner / custom dotted-path key). The pure-module side
  (`grouping/dimensions.ts` + `grouping/groupingEngine.ts`) is in place; the
  ELK integration is the missing piece.
- **Position persistence wiring** — `positionStore` module is in place but
  CalmCanvas drag commits don't write through it yet. Pinned positions are
  already supported by `elkLayout`.
- **Perf-smoke test** — a synthetic 300-node test asserting the viz pipeline
  stays under 1.5s. Pure modules' perf is already trivial on the 79-node
  canonical sample.
- **Screenshots / GIF** for the PR body — captured manually before merge.
- **Shared `@finos/calm-viz-core` extraction** — tracked in RFC #2690. The
  pure modules in `packages/calm-core/src/viz/` are written to be relocated
  to that package without rewrite once boundary is agreed with the calm-hub
  maintainers.

## Programmatic verification (Node REPL)

```js
import { readFileSync } from 'fs';
import {
	createBadgeAPI,
	decoratorsAdapter,
	controlsAdapter,
	createSeverityResolver,
	dimensions,
	applyGrouping
} from '@calmstudio/calm-core';

const arch = JSON.parse(
	readFileSync(
		'calm-suite/calm-studio/apps/studio/static/fixtures/loan_approval_solution_arch_2026.canonical.calm.json',
		'utf8'
	)
);

const badges = createBadgeAPI(arch, [decoratorsAdapter, controlsAdapter]);
const severity = createSeverityResolver(badges, arch);
const aiGroups = applyGrouping(arch, dimensions.aiDomain);

console.log(
	'agent-gateway threats:',
	badges.forNode('agent-gateway').filter((b) => b.data?.decoratorType === 'threat').length
);
console.log('agent-gateway severity:', severity.forNode('agent-gateway'));
console.log('AI domain groups:', Array.from(aiGroups.virtualGroups.keys()));
```

Expect threat counts, a `critical` severity on cross-layer-affected nodes,
and AI-domain buckets like `vg-aiDomain-agent`, `vg-aiDomain-orchestrator`.
