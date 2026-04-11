# Phase 8: C4 View Mode - Research

**Researched:** 2026-03-13
**Domain:** Svelte 5 / @xyflow/svelte — hierarchical view filtering, read-only canvas overlay, breadcrumb navigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Level mapping & filtering**
- C4 levels map to CALM node types automatically (no manual tagging):
  - Context: actor, system, ecosystem (top-level nodes with no parentId)
  - Container: service, database, webclient, network, ldap, data-asset
  - Component: aws:*, gcp:*, azure:*, k8s:*, ai:*, generic, custom types
- Only top-level nodes shown at Context level — everything nested inside containers is hidden
- Extension pack infrastructure (VPC, Subnet, Namespace) appears at Component level, not Container
- Edges to hidden nodes are hidden (only show edges where both source AND target are visible)

**Drill-down interaction**
- Double-click a system/container node to drill down into its children
- Single-click still selects the node for properties inspection
- Zoom-in animation when drilling down (spatial context: "going inside this thing")
- C4 view mode is read-only navigation — no editing, no drag-and-drop, no node creation
- Click "All" in the toolbar to exit C4 mode and return to full editing

**Breadcrumb navigation**
- Clickable breadcrumb bar at top of canvas: "All Systems > Payment System > API Gateway"
- Click any breadcrumb segment to jump back to that level
- Always visible when in C4 mode
- "All Systems" as the root label at Context level

**Visual styling per level**
- External systems greyed out with "[External]" badge at Context level
- External flag stored in customMetadata: `{ "c4-scope": "external" }`
- Ecosystem nodes auto-detected as external
- Subtle background tint per level: Context=neutral, Container=light blue (#f8faff), Component=light green (#f8fff8)
- Level badge in corner of canvas (e.g., "[Context]")
- When drilled into a container, show adjacent peer systems as small faded nodes at edges for spatial context

**View selector UX**
- Segmented control in top toolbar: [All | Context | Container | Component]
- "All" is the default (normal editing mode); clicking a C4 level enters read-only navigation
- Keyboard shortcuts: 1=All, 2=Context, 3=Container, 4=Component (only when not editing text)
- Palette hidden in C4 mode (can't add nodes)
- Properties panel shows selected node info but read-only
- Code panel stays visible as reference
- Exiting C4 mode restores previous canvas position/zoom

### Claude's Discretion
- Exact animation timing and easing for drill-down transitions
- Faded peer node sizing and positioning
- Breadcrumb styling and overflow behavior for deep hierarchies
- Level badge positioning and design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| C4VM-01 | User can switch between C4 levels (Context, Container, Component) via view selector; canvas filters to show only nodes appropriate to that level | C4 level store + `$derived` filtered nodes/edges from canonical nodes/edges array |
| C4VM-02 | User can double-click a system node at Context level to drill down into its Container view, showing children linked via `composed-of` or `deployed-in` relationships | `ondblclick` on SvelteFlow nodes; parentId chain traversal for child discovery |
| C4VM-03 | User can drill from Container into Component level and breadcrumb trail shows navigation path | Breadcrumb state stack + `setViewport`/`fitView` for spatial animation |
| C4VM-04 | C4 view mode is a read-only navigate overlay — underlying CALM JSON unchanged, all edits go through normal workflows | `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable` (read-only) props on SvelteFlow; no `applyFromCanvas` calls |
| C4VM-05 | C4 styling conventions applied per level (external systems greyed out, level background tints, level badge) | `data` field injection into filtered nodes for style variant; CSS variables per level |

</phase_requirements>

## Summary

Phase 8 adds C4 View Mode as a read-only navigation overlay over the existing CALM canvas. The implementation is entirely additive — no changes to the CALM model, no new file format fields (except the already-supported `customMetadata["c4-scope"]`), and no changes to the sync engine. All filtering, styling, and drill-down state lives in a new Svelte 5 module-level store (`c4State.svelte.ts`) and the canvas receives pre-filtered `displayNodes`/`displayEdges` in C4 mode.

The core insight is that `+page.svelte` already owns `nodes` and `edges` as `$state.raw` arrays and passes them to `CalmCanvas` as props. C4 mode simply derives a filtered subset of those arrays and passes the filtered view to `CalmCanvas` instead of the full arrays. The canvas component itself needs only two new props (`readonly` and a `ondblclicknode` callback) — it does not need to know about C4 levels at all.

Viewport save/restore is handled by `useSvelteFlow().getViewport()` / `setViewport()` already available in `@xyflow/svelte 1.5.1`, eliminating any need for custom scroll position tracking.

**Primary recommendation:** Implement a `c4State.svelte.ts` store that owns C4 mode state and derives filtered node/edge arrays. `+page.svelte` switches between `nodes`/`edges` (All mode) and `c4DisplayNodes`/`c4DisplayEdges` (C4 mode) based on store state. `CalmCanvas` gets `nodesDraggable` and `nodesConnectable` props threaded through to `<SvelteFlow>`.

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/svelte | 1.5.1 | Canvas, node rendering, viewport control | Already the canvas foundation |
| Svelte 5 | (project-wide) | `$state`, `$derived`, `$effect` runes | Established pattern throughout codebase |

### Supporting (no new installs required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xyflow/svelte `useSvelteFlow` | 1.5.1 | `getViewport()` / `setViewport()` for save/restore; `fitView()` for drill-down animation | On C4 mode enter/exit and drill-down |

### No New Dependencies

This phase requires zero new npm packages. All capabilities are present in the existing stack:
- Filtering: Svelte 5 `$derived` from existing `nodes`/`edges`
- Viewport save/restore: `getViewport()` / `setViewport()` from `useSvelteFlow`
- Read-only canvas: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable` props on `<SvelteFlow>` (already used in codebase)
- Animation: `setViewport({ duration })` or `fitView({ duration })` — already used for `navigateToNode`

## Architecture Patterns

### Recommended Project Structure

New files:
```
src/lib/
├── c4/
│   ├── c4State.svelte.ts     # C4 mode store: level, drill path, derived filtered arrays
│   ├── c4Filter.ts           # Pure functions: classify nodes by level, filter edges, detect external
│   └── C4Breadcrumb.svelte   # Breadcrumb bar component (purely presentational)
```

Modified files:
```
src/routes/+page.svelte        # Wire segmented control, pass filtered arrays to CalmCanvas, save/restore viewport
src/lib/canvas/CalmCanvas.svelte  # Add nodesDraggable/nodesConnectable props, ondblclicknode callback
src/lib/toolbar/Toolbar.svelte    # Add segmented control [All | Context | Container | Component]
src/lib/properties/PropertiesPanel.svelte  # Add readonly prop to disable mutations
src/lib/palette/NodePalette.svelte         # Accept hidden prop (or conditionally render from parent)
```

### Pattern 1: C4 Level Classification (Pure Functions in `c4Filter.ts`)

**What:** Pure TypeScript functions that classify CALM node types into C4 levels and filter node/edge arrays.
**When to use:** Called from `$derived` in `c4State.svelte.ts`. Must not import `.svelte.ts` files — same rule as `projection.ts` and `containment.ts`.

```typescript
// c4Filter.ts
// Source: CONTEXT.md locked decisions

export type C4Level = 'context' | 'container' | 'component';

const CONTEXT_TYPES = new Set(['actor', 'system', 'ecosystem']);
const CONTAINER_TYPES = new Set(['service', 'database', 'webclient', 'network', 'ldap', 'data-asset']);

export function classifyNodeC4Level(calmType: string): C4Level {
  if (CONTEXT_TYPES.has(calmType)) return 'context';
  if (CONTAINER_TYPES.has(calmType)) return 'container';
  // Extension pack infrastructure types with isContainer flag appear at 'component'
  // All colon-prefixed types (aws:*, k8s:*, etc.) and generic/custom types
  return 'component';
}

export function isExternalNode(node: Node): boolean {
  const meta = node.data?.customMetadata as Record<string, string> | undefined;
  if (meta?.['c4-scope'] === 'external') return true;
  // Ecosystem nodes are auto-detected as external
  return (node.data?.calmType as string) === 'ecosystem';
}

/**
 * Filter nodes for a given C4 level.
 * At Context level: only top-level nodes (no parentId) of context type.
 * At Container level: all container-type nodes regardless of parentId.
 * At Component level: all component-type nodes.
 * When drilled into a parent, include only children of that parent.
 */
export function filterNodesForLevel(
  nodes: Node[],
  level: C4Level,
  drillParentId: string | null
): Node[] { /* ... */ }

/**
 * Filter edges to only those where both source AND target are in the visible node set.
 */
export function filterEdgesForVisibleNodes(edges: Edge[], visibleIds: Set<string>): Edge[] {
  return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
}
```

**Key constraint:** `c4Filter.ts` must remain a pure TypeScript file (no `.svelte.ts` imports) to stay testable in Vitest — consistent with `projection.ts` and `containment.ts` patterns.

### Pattern 2: C4 State Store (`c4State.svelte.ts`)

**What:** Module-level Svelte 5 `$state` + `$derived` for all C4 mode state. Exports getter functions.
**When to use:** Consumed by `+page.svelte` to drive what gets passed to `CalmCanvas`.

```typescript
// c4State.svelte.ts
import type { Node, Edge } from '@xyflow/svelte';
import type { C4Level } from './c4Filter';
import { filterNodesForLevel, filterEdgesForVisibleNodes, applyC4Styles } from './c4Filter';

export type C4ModeState = { level: C4Level; drillStack: { nodeId: string; label: string }[] } | null;

/** null = "All" mode (normal editing). Non-null = C4 navigation mode. */
let c4Mode = $state<C4ModeState>(null);

/** Reactive: are we currently in C4 mode? */
export function isC4Mode(): boolean { return c4Mode !== null; }

export function getC4Level(): C4Level | null { return c4Mode?.level ?? null; }

export function getC4DrillStack(): { nodeId: string; label: string }[] {
  return c4Mode?.drillStack ?? [];
}

export function enterC4Mode(level: C4Level): void {
  c4Mode = { level, drillStack: [] };
}

export function drillDown(nodeId: string, label: string): void {
  if (!c4Mode) return;
  c4Mode = { ...c4Mode, drillStack: [...c4Mode.drillStack, { nodeId, label }] };
}

export function drillUpTo(index: number): void {
  if (!c4Mode) return;
  c4Mode = { ...c4Mode, drillStack: c4Mode.drillStack.slice(0, index) };
}

export function exitC4Mode(): void { c4Mode = null; }
```

### Pattern 3: Derived Filtered Arrays in `+page.svelte`

**What:** `$derived` computed from `nodes`, `edges`, and c4Mode state. Swapped in/out as the source for CalmCanvas.

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { isC4Mode, getC4Level, getC4DrillStack, ... } from '$lib/c4/c4State.svelte';
  import { filterNodesForLevel, filterEdgesForVisibleNodes, applyC4Styles } from '$lib/c4/c4Filter';

  // Existing canonical arrays
  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);

  // Derived C4 display arrays — recomputed reactively when c4Mode or nodes/edges change
  const c4DisplayNodes = $derived.by(() => {
    if (!isC4Mode()) return nodes;
    const level = getC4Level()!;
    const stack = getC4DrillStack();
    const drillParentId = stack.length > 0 ? stack[stack.length - 1].nodeId : null;
    const filtered = filterNodesForLevel(nodes, level, drillParentId);
    return applyC4Styles(filtered, level);  // injects data.c4External, data.c4Level etc.
  });

  const c4DisplayEdges = $derived.by(() => {
    if (!isC4Mode()) return edges;
    const visibleIds = new Set(c4DisplayNodes.map(n => n.id));
    return filterEdgesForVisibleNodes(edges, visibleIds);
  });
</script>

<!-- Canvas always receives displayNodes/displayEdges -->
<CalmCanvas
  bind:nodes={isC4Mode() ? undefined : nodes}
  nodes={isC4Mode() ? c4DisplayNodes : undefined}
  edges={isC4Mode() ? c4DisplayEdges : edges}
  readonly={isC4Mode()}
  ondblclicknode={isC4Mode() ? handleC4DrillDown : undefined}
  ...
/>
```

**Note:** The `bind:nodes` pattern above needs care — in readonly mode, CalmCanvas must not write back to nodes. The cleaner approach is to pass `displayNodes` as a prop and only `bind:nodes` when in edit mode. See Anti-Patterns below.

### Pattern 4: Viewport Save/Restore

**What:** Save viewport before entering C4 mode, restore on exit. `useSvelteFlow` already provides this.
**When to use:** On `enterC4Mode()` and `exitC4Mode()` calls.

```typescript
// In CalmCanvas.svelte — add exported functions
const { getViewport, setViewport, fitView, setCenter } = useSvelteFlow();

export function saveViewport(): Viewport {
  return getViewport();
}

export function restoreViewport(vp: Viewport) {
  setViewport(vp, { duration: 300 });
}
```

```svelte
<!-- In +page.svelte -->
<script>
  let savedViewport: Viewport | null = null;

  function handleEnterC4Mode(level: C4Level) {
    savedViewport = canvas?.saveViewport() ?? null;
    enterC4Mode(level);
    // Fit view to filtered nodes after DOM update
    tick().then(() => canvas?.fitViewport());
  }

  function handleExitC4Mode() {
    exitC4Mode();
    tick().then(() => {
      if (savedViewport) canvas?.restoreViewport(savedViewport);
    });
  }
</script>
```

### Pattern 5: Read-Only Canvas Props

**What:** `<SvelteFlow>` accepts `nodesDraggable`, `nodesConnectable`, and `elementsSelectable` props for read-only mode.
**When to use:** When `readonly` prop is true on CalmCanvas.

```svelte
<!-- CalmCanvas.svelte -->
let { readonly = false, ondblclicknode, ... } = $props();

<SvelteFlow
  {nodesDraggable}
  {nodesConnectable}
  nodesDraggable={!readonly}
  nodesConnectable={!readonly}
  deleteKey={readonly ? [] : ['Delete', 'Backspace']}
  ...
>
```

The `elementsSelectable` prop can remain true in readonly mode — the CONTEXT says "Properties panel shows selected node info but read-only", so click-to-select should still work.

### Pattern 6: Segmented Control in Toolbar

**What:** Four-segment control: [All | Context | Container | Component]. Current selection highlighted.
**When to use:** Top toolbar, matches existing `toolbar-btn` CSS patterns.

```svelte
<!-- Toolbar.svelte — add props -->
let { c4Level = null, onc4levelchange, ... } = $props();

<div class="c4-selector" role="group" aria-label="C4 view level">
  {#each ['all', 'context', 'container', 'component'] as seg}
    <button
      type="button"
      class="c4-btn"
      class:active={c4Level === seg || (seg === 'all' && c4Level === null)}
      onclick={() => onc4levelchange(seg === 'all' ? null : seg)}
    >
      {seg === 'all' ? 'All' : seg.charAt(0).toUpperCase() + seg.slice(1)}
    </button>
  {/each}
</div>
```

### Pattern 7: Drill-Down Double-Click

**What:** `ondblclicknode` event from SvelteFlow — not natively provided, must be wired via `onnodeclick` with double-click detection, or use the `on:dblclick` DOM event on the node component.

**The correct approach:** SvelteFlow fires `onnodedblclick` (note: verify exact event name). In `@xyflow/svelte`, the `SvelteFlow` component has `onnodedblclick?: (event: { event: MouseEvent; node: Node }) => void`. This eliminates need for manual double-click debouncing.

```svelte
<!-- CalmCanvas.svelte -->
<SvelteFlow
  onnodedblclick={handleNodeDblClick}
  ...
>

function handleNodeDblClick(event: { event: MouseEvent; node: Node }) {
  if (readonly) {
    ondblclicknode?.(event.node);
  }
}
```

### Anti-Patterns to Avoid

- **Modifying canonical nodes/edges for C4 display:** Never mutate `nodes`/`edges` arrays for C4 styling (e.g., setting `hidden: true`). Use derived display arrays — the canonical arrays must remain clean for editing.
- **Calling `applyFromCanvas` in C4 mode:** C4 mode must never trigger model writes. Any canvas event handlers (ondragstop, onconnect, etc.) must be gated by `!readonly`.
- **Using `bind:nodes` in readonly mode:** In C4 mode, SvelteFlow cannot be allowed to write back to the display array since it's derived. Pass display arrays as one-way props (not `bind:`).
- **Deep-cloning nodes for style injection:** Instead of cloning every node to add `data.c4External`, add a lightweight data field only where needed. For the faded peer nodes, the existing `data` object can receive a `c4Peer: true` flag that the node component uses for CSS.
- **Global keyboard shortcuts conflicting with text input:** Keyboard shortcuts 1-4 must be gated by `!isInputFocused()` — established pattern already used in `+page.svelte` for other shortcuts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport save/restore | Custom scroll position state | `useSvelteFlow().getViewport()` / `setViewport()` | Already in `@xyflow/svelte 1.5.1`; handles transform (x, y, zoom) atomically |
| Drill-down animation | Manual CSS transform tweening | `setViewport({ duration: 300 })` or `fitView({ duration: 400 })` | SvelteFlow handles easing internally; same pattern as `navigateToNode` already in CalmCanvas |
| Double-click detection | setTimeout-based double-click debouncer | `onnodedblclick` event on `<SvelteFlow>` | Library fires this natively; confirmed in @xyflow/svelte event types |
| Node visibility filtering | `hidden` prop on individual nodes | Derived arrays with only visible nodes | SvelteFlow handles `hidden` but it still renders nodes (just invisible); derived arrays are more performant for large diagrams |

**Key insight:** SvelteFlow's prop-based read-only mode (`nodesDraggable={false}`, `nodesConnectable={false}`) is the correct pattern — not disabling individual interaction handlers.

## Common Pitfalls

### Pitfall 1: `bind:nodes` + Derived Array Conflict
**What goes wrong:** If you `bind:nodes={c4DisplayNodes}` where `c4DisplayNodes` is a `$derived`, SvelteFlow will attempt to write back filtered nodes on internal mutations, causing "cannot assign to derived" runtime errors.
**Why it happens:** `$derived` values are read-only in Svelte 5.
**How to avoid:** In C4 mode, pass `nodes={c4DisplayNodes}` (one-way), not `bind:nodes`. Only use `bind:nodes` when `!isC4Mode()`.
**Warning signs:** "Cannot write to derived state" runtime error on first node interaction in C4 mode.

### Pitfall 2: Canvas Event Handlers Firing in Read-Only Mode
**What goes wrong:** `oncanvaschange` (which marks dirty) and `applyFromCanvas` called during C4 browsing.
**Why it happens:** Node drag events still fire even though `nodesDraggable={false}` prevents user drags — programmatic node updates still trigger change handlers.
**How to avoid:** Gate every handler that calls `applyFromCanvas` or `oncanvaschange` with `if (readonly) return`.
**Warning signs:** `isDirty` becomes `true` just from navigating C4 levels.

### Pitfall 3: Parent-Child Node Visibility at Context Level
**What goes wrong:** Nodes with `parentId` set (containment children) appear at Context level because their `node-type` is 'system' or 'actor'.
**Why it happens:** Context level shows "top-level nodes" — but the classifier only checks `node-type`, not `parentId`.
**How to avoid:** `filterNodesForLevel` at Context level must check `!node.parentId` in addition to `classifyNodeC4Level(node.data.calmType) === 'context'`.
**Warning signs:** Children of container nodes appear floating at Context level.

### Pitfall 4: Faded Peer Nodes Triggering Drill-Down
**What goes wrong:** Faded peer nodes at the canvas edges (showing neighboring systems) are double-clicked and trigger unexpected drill-downs.
**Why it happens:** Peer nodes are rendered as full interactive nodes with the same `ondblclicknode` handler.
**How to avoid:** Add a `c4Peer: true` flag to peer node data. In the drill-down handler, check `if (node.data?.c4Peer) return` before drilling.
**Warning signs:** Clicking a faded peer node navigates to an unexpected drill context.

### Pitfall 5: Breadcrumb Label "All Systems" Miscounted
**What goes wrong:** When drillStack is empty but level is 'context', the breadcrumb shows only "All Systems" with no way to return to the level selector.
**Why it happens:** Confusing "breadcrumb root" with "exit C4 mode".
**How to avoid:** The segmented control handles exit from C4 mode (clicking "All"). The breadcrumb only shows the drill path within C4 — "All Systems" is the root breadcrumb for the current level, clicking it calls `drillUpTo(0)` which clears the drill stack (not exits C4 mode).

### Pitfall 6: Keyboard Shortcut Conflict with Number Input Fields
**What goes wrong:** Pressing "2" to switch to Context view while editing a node ID or port number in the properties panel.
**Why it happens:** Global `keydown` handlers fire even when input fields have focus.
**How to avoid:** Gate C4 keyboard shortcuts with `if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return`.
**Warning signs:** Properties panel field values are cleared when pressing number keys.

### Pitfall 7: SvelteFlow Node Count Performance with Large Diagrams
**What goes wrong:** C4 filtering via `hidden: true` on individual nodes still renders all nodes in the DOM (SvelteFlow renders hidden nodes but sets `visibility: hidden`).
**Why it happens:** SvelteFlow's `hidden` prop is a display toggle, not a render skip.
**How to avoid:** Use derived arrays (filtering the arrays themselves) rather than `hidden` prop. This is the established pattern for performance — SvelteFlow only renders what's in the nodes array.

## Code Examples

Verified patterns from existing codebase:

### Saving and Restoring Viewport (useSvelteFlow 1.5.1)
```typescript
// Source: @xyflow/svelte dist/lib/hooks/useSvelteFlow.svelte.d.ts
const { getViewport, setViewport, fitView } = useSvelteFlow();

// Save before entering C4 mode
const saved = getViewport(); // returns { x, y, zoom }

// Restore on exit (with animation)
await setViewport(saved, { duration: 300 });

// Fit filtered nodes after drill-down
fitView({ duration: 400, maxZoom: 1.2, padding: 0.2 });
```

### Making Canvas Read-Only (SvelteFlow props)
```svelte
<!-- Source: @xyflow/svelte SvelteFlow component props -->
<SvelteFlow
  nodesDraggable={!readonly}
  nodesConnectable={!readonly}
  deleteKey={readonly ? [] : ['Delete', 'Backspace']}
  bind:nodes={...}
  ...
/>
```

### Svelte 5 Derived Display Arrays (established calmModel pattern)
```typescript
// Source: +page.svelte existing pattern ($derived is used for calmJson)
const c4DisplayNodes = $derived.by(() => {
  if (!isC4Mode()) return nodes;
  // ... filter
});
```

### Node Double-Click Event (SvelteFlow)
```svelte
<!-- Source: @xyflow/svelte SvelteFlow component event props -->
<SvelteFlow
  onnodedblclick={(e) => {
    if (readonly) ondblclicknode?.(e.node);
  }}
/>
```

### Detecting External Nodes via customMetadata
```typescript
// Source: CONTEXT.md + CalmNode.customMetadata in calm-core/src/types.ts
const isExternal = (node: Node): boolean => {
  const meta = node.data?.customMetadata as Record<string, string> | undefined;
  return meta?.['c4-scope'] === 'external' || node.data?.calmType === 'ecosystem';
};
```

### C4 Level Classification from CALM Type
```typescript
// Source: CONTEXT.md locked decisions
const CONTEXT_TYPES = new Set(['actor', 'system', 'ecosystem']);
const CONTAINER_TYPES = new Set(['service', 'database', 'webclient', 'network', 'ldap', 'data-asset']);

function classifyNodeC4Level(calmType: string): C4Level {
  if (CONTEXT_TYPES.has(calmType)) return 'context';
  if (CONTAINER_TYPES.has(calmType)) return 'container';
  return 'component'; // all colon-prefixed + generic + custom
}
```

### parentId Chain for Child Discovery
```typescript
// Source: containment.ts pattern — parentId is already on Svelte Flow nodes
function getChildrenOf(parentId: string, nodes: Node[]): Node[] {
  return nodes.filter(n => n.parentId === parentId);
}

// Check if node has children (can drill down)
function hasDrillableChildren(nodeId: string, nodes: Node[]): boolean {
  return nodes.some(n => n.parentId === nodeId);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| C4 as a separate diagram type (draw separate diagrams) | C4 as a view filter over existing CALM JSON | This phase | No schema changes; one source of truth |
| Per-node `hidden` prop for filtering | Derived arrays (filter the array itself) | Established in this research | Better performance; fewer DOM nodes |
| Custom double-click detection | `onnodedblclick` SvelteFlow event | @xyflow/svelte 1.5.1 | Simpler, reliable |

## Open Questions

1. **Does `onnodedblclick` fire when `nodesDraggable={false}`?**
   - What we know: `nodesDraggable={false}` prevents drag interactions; click events are separate
   - What's unclear: Whether disabling drag suppresses dblclick in the SvelteFlow internals
   - Recommendation: Verify in Wave 0 smoke test. Fallback: use DOM-level `ondblclick` on the CalmCanvas wrapper div, then hit-test to find the nearest node.

2. **Peer node rendering approach**
   - What we know: Peer nodes (adjacent systems shown faded at canvas edges) need to appear at edges of the drill-down view
   - What's unclear: The positional placement — do they use actual canvas positions or get repositioned to the viewport edges?
   - Recommendation: Use actual canvas positions (they'll naturally be at the edge when fitting the drilled view). Apply `opacity: 0.3` via `data.c4Peer` flag. This avoids complex edge positioning logic.

3. **Toolbar segmented control placement**
   - What we know: Current toolbar has left (app name) / center (filename) / right (file ops + export) layout
   - What's unclear: Where segmented control fits without crowding the toolbar
   - Recommendation: Add between left and center, or as a secondary row. Claude's discretion area — planner decides.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts `test` block) |
| Config file | `apps/studio/vite.config.ts` (inline `test:` block) |
| Quick run command | `pnpm --filter studio test --run` |
| Full suite command | `pnpm --filter studio test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| C4VM-01 | `classifyNodeC4Level` returns correct level for each CALM type | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-01 | `filterNodesForLevel` returns only nodes of that level at Context | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-01 | Edges hidden when either endpoint is filtered out | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-02 | `getChildrenOf(parentId, nodes)` returns correct child set | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-02 | `hasDrillableChildren` returns true for nodes with parentId children | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-03 | `drillDown` appends to stack; `drillUpTo(0)` clears to root | unit | `pnpm --filter studio test --run src/tests/c4State.test.ts` | ❌ Wave 0 |
| C4VM-04 | `isExternalNode` detects ecosystem type and `c4-scope: external` metadata | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |
| C4VM-05 | `applyC4Styles` injects `c4External` flag on external nodes at Context level | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter studio test --run src/tests/c4Filter.test.ts src/tests/c4State.test.ts`
- **Per wave merge:** `pnpm --filter studio test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/studio/src/tests/c4Filter.test.ts` — covers C4VM-01, C4VM-02, C4VM-04, C4VM-05 (pure function tests; no Svelte transform needed)
- [ ] `apps/studio/src/tests/c4State.test.ts` — covers C4VM-03 (module-level `$state` — may need Svelte transform; if so, test via `c4Filter.ts` logic only and keep state integration as manual verification)

**Note on testability:** `c4Filter.ts` (pure functions, no `.svelte.ts` imports) is fully testable in Vitest as-is. `c4State.svelte.ts` uses Svelte 5 runes — Vitest in this project has `passWithNoTests: true` and uses `jsdom` environment, but does not configure `@sveltejs/vite-plugin-svelte` transform for `.svelte.ts`. Following the established pattern from `projection.ts`, keep all testable logic in `c4Filter.ts` and test only that file in Vitest. The `c4State.svelte.ts` logic is thin enough to verify manually.

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `apps/studio/src/lib/canvas/CalmCanvas.svelte` — existing patterns for readonly props, useSvelteFlow, ndblclick
- Codebase direct read: `apps/studio/src/lib/canvas/containment.ts` — parentId/extent pattern for child discovery
- Codebase direct read: `apps/studio/src/lib/stores/projection.ts` — pure function file pattern (no .svelte.ts imports)
- Codebase direct read: `apps/studio/src/lib/stores/calmModel.svelte.ts` — module-level $state rune pattern
- `apps/studio/node_modules/@xyflow/svelte/dist/lib/hooks/useSvelteFlow.svelte.d.ts` — `getViewport`/`setViewport` API confirmed in 1.5.1
- `packages/calm-core/src/types.ts` — `CalmNode.customMetadata: Record<string, string>` confirmed
- `.planning/phases/08-c4-view-mode/08-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `@xyflow/svelte` type exports — `onnodedblclick` event name confirmed in index.d.ts export list (SvelteFlow component event props)

### Tertiary (LOW confidence)
- Assumption: `onnodedblclick` fires when `nodesDraggable={false}`. Needs smoke test verification (Open Question 1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing @xyflow/svelte 1.5.1 APIs confirmed
- Architecture patterns: HIGH — all patterns follow established project conventions (pure TS files, module-level $state, derived arrays)
- Pitfalls: HIGH — derived from direct codebase analysis; each pitfall maps to a specific code interaction already present
- `onnodedblclick` event behavior in readonly mode: LOW — needs empirical verification

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable libraries; @xyflow/svelte API unlikely to change)
