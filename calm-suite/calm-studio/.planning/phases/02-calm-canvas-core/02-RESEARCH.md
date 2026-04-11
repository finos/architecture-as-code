# Phase 2: CALM Canvas Core - Research

**Researched:** 2026-03-11
**Domain:** Svelte Flow (@xyflow/svelte), CALM data model, SvelteKit canvas architecture
**Confidence:** HIGH (core stack), MEDIUM (undo/redo pattern, copy/paste)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Node visual design:**
- Distinct shapes per CALM node type — each of the 9 types gets a unique shape (e.g., actor=person, database=cylinder, service=rounded rect, network=cloud)
- Monochrome color scheme — shape alone differentiates types, no per-type coloring
- Each node displays its name + a small type icon by default (no description on canvas)
- Custom node types (any string not in the 9 built-in types): Claude's discretion on rendering

**Palette & node creation:**
- Left sidebar panel, always visible, with search at the top
- Palette items show labeled entries with shape preview (mini shape icon + type name)
- Node placement supports both drag-and-drop AND click-to-place
- Palette includes the 9 core CALM types plus a "Custom..." entry for arbitrary type strings

**Containment rendering:**
- Containment (deployed-in, composed-of) renders as labeled boundary boxes — parent node becomes a larger box with name as header, children positioned inside
- Containers are collapsible — click toggle to collapse into compact node, expand to reveal children
- Containment creation supports both methods: drag a node into a container AND draw a deployed-in/composed-of edge (both create the parent-child relationship)
- Visual differentiation between deployed-in and composed-of containers: Claude's discretion

**Edge styles & labels:**
- 5 relationship types distinguished by line style variation:
  - connects: solid line + filled arrow
  - interacts: dashed line + filled arrow
  - deployed-in: solid line + diamond
  - composed-of: dashed line + filled diamond
  - options: dotted line + open arrow
- Protocol labels (HTTPS, JDBC, gRPC, etc.) display as inline text on connects edges, centered on the line
- Edge creation supports both handle-to-handle drag AND multi-select nodes + menu
- New edges default to 'connects' type — change via right-click or properties panel (Phase 3)

**Phase Boundary:** Properties panel and bidirectional sync are Phase 3. Import/export is Phase 4. Extension packs are Phase 7.

### Claude's Discretion
- Custom node type visual rendering
- Visual differentiation between deployed-in and composed-of container styles
- Dark mode implementation details
- Keyboard shortcut specifics beyond Cmd+Z / Cmd+Shift+Z / Delete
- Search/filter UI details
- Node resize handle style
- Selection highlight style (box select vs shift-click behavior)
- Exact spacing, typography, and sizing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANV-01 | User can drag CALM-typed nodes from a palette onto a canvas | Svelte Flow HTML5 DnD API + `screenToFlowPosition()` + DnDProvider context pattern |
| CANV-02 | User can draw typed edges between nodes (connects, interacts, deployed-in, composed-of) | Svelte Flow `edgeTypes` + custom Svelte edge components with `stroke-dasharray` + custom SVG `<marker>` elements |
| CANV-03 | User can select, multi-select, move, resize, and delete nodes and edges | Svelte Flow built-in + `<NodeResizer>` component + `deleteKey` prop |
| CANV-04 | User can zoom, pan, and navigate with trackpad/mouse | Svelte Flow built-in: `zoomOnScroll`, `panOnDrag`, `panOnScroll` props |
| CANV-05 | User can undo/redo any canvas action (unlimited history) | Custom history store: snapshot `nodes`+`edges` before mutations, Cmd+Z/Shift+Cmd+Z keyboard handler |
| CANV-06 | User can use keyboard shortcuts (Cmd+Z, Cmd+S, Delete, spacebar-pan) | `svelte-put/shortcut` action + Svelte Flow `deleteKey` + `selectionKey` props |
| CANV-07 | User can copy/paste nodes with new unique-ids auto-generated | Custom clipboard store: filter `selected` nodes, duplicate with `nanoid()` offsets |
| CANV-08 | User can search/filter nodes by name, type, or ID | Fuse.js fuzzy search on nodes array; results highlight in canvas via `selected` prop |
| CANV-09 | User can toggle dark mode and light mode (system preference detection) | CSS custom properties on `<html>` class + `matchMedia('prefers-color-scheme')` + localStorage |
| CALM-01 | All 9 CALM node types as distinct custom Svelte components | `nodeTypes` map: one `.svelte` file per type, SVG shapes via Tailwind+raw SVG |
| CALM-02 | Custom node types supported (any string) via GenericNode component | `type: 'generic'` fallback in `nodeTypes` map with data-driven label |
| CALM-03 | All 5 CALM relationship types as distinct edge styles | `edgeTypes` map + `stroke-dasharray` SVG + custom SVG `<marker>` definitions |
| CALM-04 | CALM interfaces rendered as typed handles on node edges | `<Handle>` components with `id` prop per interface; handle position driven by interface array |
| CALM-05 | Containment relationships rendered as sub-flows with parent-child constraints | Svelte Flow `parentId` + `extent: 'parent'` + collapsible parent node component |
| CALM-06 | Protocol labels displayed on connects edges | `<EdgeLabel>` component centered on edge path with `nodrag nopan` classes |
</phase_requirements>

---

## Summary

This phase builds the visual canvas foundation of CalmStudio using Svelte Flow (@xyflow/svelte) 1.x — which reached stable v1.0 on May 14, 2025 with full Svelte 5 runes support. The library provides the graph rendering engine, node/edge interaction primitives, and viewport management out of the box. All CALM-specific behavior (typed nodes, custom edge styles, containment, protocol labels) is layered on top via Svelte Flow's customization APIs (`nodeTypes`, `edgeTypes`, custom handles).

The dominant pattern is: CALM data model lives in `packages/calm-core` as plain TypeScript types, the canvas state is `$state.raw([...])` arrays of Svelte Flow `Node` and `Edge` objects, and all visual differentiation is done in custom `.svelte` components registered via `nodeTypes`/`edgeTypes` maps. Sub-flows (containment) use the built-in `parentId` + `extent: 'parent'` mechanism — no custom sub-flow engine is needed. Undo/redo and copy/paste are NOT built into Svelte Flow and must be implemented manually as history/clipboard Svelte stores.

**Primary recommendation:** Install `@xyflow/svelte@latest` into `apps/studio`, build SvelteKit around it with SSR disabled for the canvas route, implement 9 custom node components and 5 custom edge components as distinct `.svelte` files, and wire history/clipboard stores manually.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/svelte | ^1.5.1 | Graph canvas engine — nodes, edges, viewport, handles, selection | Only production-ready Svelte 5 graph library; React Flow parity; stable v1 released May 2025 |
| svelte | ^5.x | UI components (already in project via SvelteKit) | Project decision pre-Phase 1 |
| tailwindcss | ^4.x | Utility CSS for node/edge component styling | shadcn-svelte standard; v4 fully supported |
| shadcn-svelte | latest | UI primitives (sidebar, popover, tooltip, input, button) | Svelte 5 + Tailwind v4 compatible; copy-owned components |
| nanoid | ^5.x | Unique ID generation for pasted nodes and new nodes | Smaller than uuid, URL-safe, crypto-based |
| fuse.js | ^7.x | Fuzzy search for node palette and canvas node search | Lightweight, no deps, works on plain arrays |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| svelte-put/shortcut | ^3.x | Keyboard shortcut registration (Svelte action) | Cmd+Z, Cmd+S, Delete, Cmd+C/V binding |
| @testing-library/svelte | ^5.x | Component unit tests | Testing custom node/edge Svelte components |
| vitest | ^3.x | Test runner | Unit + component tests (SvelteKit default) |
| @playwright/test | ^1.x | E2E canvas interaction tests | Full drag-drop, connection, undo workflows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xyflow/svelte | React Flow + Svelte wrapper | Defeats the purpose; React in Svelte = bundle bloat |
| @xyflow/svelte | Cytoscape.js | No Svelte component model; harder custom nodes |
| fuse.js | minisearch | fuse.js simpler for in-memory object search; minisearch better for large document sets |
| shadcn-svelte | Flowbite Svelte | shadcn-svelte has better Svelte 5 support and copy-ownership model |
| nanoid | crypto.randomUUID() | Both work; nanoid shorter IDs, URL-safe by default |

**Installation:**
```bash
pnpm --filter @calmstudio/studio add @xyflow/svelte tailwindcss nanoid fuse.js
pnpm --filter @calmstudio/studio add -D vitest @testing-library/svelte @playwright/test svelte-put
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/studio/src/
├── lib/
│   ├── canvas/
│   │   ├── CalmCanvas.svelte       # SvelteFlow wrapper, binds nodes/edges
│   │   ├── nodes/                  # One file per CALM node type
│   │   │   ├── ActorNode.svelte
│   │   │   ├── SystemNode.svelte
│   │   │   ├── ServiceNode.svelte
│   │   │   ├── DatabaseNode.svelte
│   │   │   ├── NetworkNode.svelte
│   │   │   ├── WebclientNode.svelte
│   │   │   ├── EcosystemNode.svelte
│   │   │   ├── LdapNode.svelte
│   │   │   ├── DataAssetNode.svelte
│   │   │   ├── GenericNode.svelte  # Custom string type fallback
│   │   │   └── ContainerNode.svelte # Parent node for deployed-in/composed-of
│   │   ├── edges/
│   │   │   ├── ConnectsEdge.svelte
│   │   │   ├── InteractsEdge.svelte
│   │   │   ├── DeployedInEdge.svelte
│   │   │   ├── ComposedOfEdge.svelte
│   │   │   ├── OptionsEdge.svelte
│   │   │   └── EdgeMarkers.svelte  # SVG <defs> for custom markers
│   │   └── nodeTypes.ts            # nodeTypes + edgeTypes maps
│   ├── palette/
│   │   ├── NodePalette.svelte      # Left sidebar with search
│   │   └── DnDProvider.svelte      # Context for drag type
│   ├── stores/
│   │   ├── history.svelte.ts       # Undo/redo: snapshot array + pointer
│   │   ├── clipboard.svelte.ts     # Copy/paste: selected node snapshot
│   │   └── theme.svelte.ts         # Dark mode: class toggle + localStorage
│   └── calm-model.ts               # Re-exports from @calmstudio/calm-core
├── routes/
│   └── +page.svelte               # Main canvas layout (sidebar + canvas)
└── app.css                         # Tailwind + @xyflow/svelte CSS imports
```

### Pattern 1: Custom Node Registration
**What:** Each CALM node type is a standalone Svelte component that receives `NodeProps` and renders its unique shape via SVG or HTML/CSS.
**When to use:** For all 9 CALM node types + GenericNode fallback + ContainerNode.

```svelte
<!-- Source: https://svelteflow.dev/learn/customization/custom-nodes -->
<!-- apps/studio/src/lib/canvas/nodes/ServiceNode.svelte -->
<script lang="ts">
  // SPDX-FileCopyrightText: 2024 CalmStudio contributors
  // SPDX-License-Identifier: Apache-2.0
  import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';

  let { id, data, selected }: NodeProps = $props();
</script>

<NodeResizer minWidth={120} minHeight={60} isVisible={selected} />

<Handle type="target" position={Position.Top} />
<Handle type="source" position={Position.Bottom} />
<Handle type="source" position={Position.Right} />
<Handle type="target" position={Position.Left} />

<div class="node-service" class:selected>
  <!-- SVG rounded-rect shape -->
  <svg width="32" height="32" viewBox="0 0 32 32">
    <rect x="2" y="2" width="28" height="28" rx="6" ry="6"
          fill="none" stroke="currentColor" stroke-width="2"/>
  </svg>
  <span class="node-label">{data.label}</span>
</div>
```

```typescript
// apps/studio/src/lib/canvas/nodeTypes.ts
// Source: https://svelteflow.dev/learn/customization/custom-nodes
import ActorNode from './nodes/ActorNode.svelte';
import ServiceNode from './nodes/ServiceNode.svelte';
// ... all 9 types
import GenericNode from './nodes/GenericNode.svelte';
import ContainerNode from './nodes/ContainerNode.svelte';

export const nodeTypes = {
  actor: ActorNode,
  system: SystemNode,
  service: ServiceNode,
  database: DatabaseNode,
  network: NetworkNode,
  webclient: WebclientNode,
  ecosystem: EcosystemNode,
  ldap: LdapNode,
  'data-asset': DataAssetNode,
  generic: GenericNode,
  container: ContainerNode,
} as const;
```

### Pattern 2: Custom Edge with Stroke Style + Inline Marker
**What:** Custom edge component uses `BaseEdge` with SVG `stroke-dasharray` for line style and references custom `<marker>` SVG definitions for arrowheads/diamonds.
**When to use:** All 5 CALM relationship edge types.

```svelte
<!-- Source: https://svelteflow.dev/learn/customization/custom-edges -->
<!-- apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte -->
<script lang="ts">
  import { BaseEdge, EdgeLabel, getStraightPath, type EdgeProps } from '@xyflow/svelte';

  let { id, sourceX, sourceY, targetX, targetY, label }: EdgeProps = $props();
  let [edgePath, labelX, labelY] = $derived(
    getStraightPath({ sourceX, sourceY, targetX, targetY })
  );
</script>

<!-- Solid line + filled arrow marker (url defined in EdgeMarkers.svelte) -->
<BaseEdge {id} path={edgePath} markerEnd="url(#marker-arrow-filled)"
          style="stroke: currentColor;" />

{#if label}
  <EdgeLabel x={labelX} y={labelY}>
    <span class="edge-label nodrag nopan">{label}</span>
  </EdgeLabel>
{/if}
```

```svelte
<!-- apps/studio/src/lib/canvas/edges/EdgeMarkers.svelte -->
<!-- Rendered once in CalmCanvas.svelte, defines all shared SVG markers -->
<svg style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <!-- connects: filled arrowhead -->
    <marker id="marker-arrow-filled" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
    </marker>
    <!-- deployed-in: open diamond -->
    <marker id="marker-diamond-open" viewBox="0 0 20 10" refX="18" refY="5"
            markerWidth="12" markerHeight="10" orient="auto-start-reverse">
      <path d="M 0 5 L 9 1 L 18 5 L 9 9 z" fill="none" stroke="currentColor" />
    </marker>
    <!-- composed-of: filled diamond -->
    <marker id="marker-diamond-filled" viewBox="0 0 20 10" refX="18" refY="5"
            markerWidth="12" markerHeight="10" orient="auto-start-reverse">
      <path d="M 0 5 L 9 1 L 18 5 L 9 9 z" fill="currentColor" />
    </marker>
    <!-- options: open arrowhead -->
    <marker id="marker-arrow-open" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="currentColor" />
    </marker>
  </defs>
</svg>
```

For dashed/dotted strokes, the `InteractsEdge` uses `style="stroke-dasharray: 6 4;"` and `OptionsEdge` uses `style="stroke-dasharray: 2 4;"` on the `<BaseEdge>` style prop.

### Pattern 3: Drag-and-Drop from Palette
**What:** HTML5 native drag events + Svelte context carry the node type from palette item to canvas drop zone. `screenToFlowPosition()` converts client coordinates.
**When to use:** CANV-01 — external palette drag into canvas.

```svelte
<!-- Source: https://svelteflow.dev/examples/interaction/drag-and-drop -->
<!-- Palette item (simplified) -->
<div draggable="true" ondragstart={(e) => {
  e.dataTransfer?.setData('application/calm-node-type', nodeType);
  e.dataTransfer!.effectAllowed = 'copy';
}}>
  {nodeType}
</div>

<!-- CalmCanvas.svelte: canvas drop handler -->
<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { nanoid } from 'nanoid';
  let { screenToFlowPosition } = useSvelteFlow();
</script>

<div
  ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; }}
  ondrop={(e) => {
    e.preventDefault();
    const type = e.dataTransfer?.getData('application/calm-node-type');
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    nodes = [...nodes, {
      id: nanoid(),
      type,
      position,
      data: { label: `New ${type}`, calmId: nanoid() }
    }];
  }}
>
  <SvelteFlow bind:nodes bind:edges {nodeTypes} {edgeTypes} />
</div>
```

### Pattern 4: Sub-flows for Containment
**What:** Child nodes reference their container via `parentId`. The parent is a `ContainerNode` with resizable bounds. `extent: 'parent'` keeps children inside.
**When to use:** CALM-05 — deployed-in, composed-of relationships.

```typescript
// Source: https://svelteflow.dev/examples/layout/subflows
// When a deployed-in or composed-of edge is created, or when a node is
// dragged into a container, transform the data model:
function makeContainment(parentId: string, childId: string, nodes: Node[]): Node[] {
  return nodes.map(n => {
    if (n.id === childId) {
      return { ...n, parentId, extent: 'parent' };
    }
    if (n.id === parentId) {
      // Ensure parent has container type
      return { ...n, type: 'container', style: 'min-width: 200px; min-height: 150px;' };
    }
    return n;
  });
}
```

### Pattern 5: Manual Undo/Redo History Store
**What:** Svelte store snapshots the `{nodes, edges}` state before each mutation. Cmd+Z restores prior snapshot; Cmd+Shift+Z replays.
**When to use:** CANV-05.

```typescript
// apps/studio/src/lib/stores/history.svelte.ts
// Svelte Flow does NOT provide built-in undo/redo
type Snapshot = { nodes: Node[]; edges: Edge[] };

let stack = $state<Snapshot[]>([]);
let pointer = $state(-1);

export function pushSnapshot(nodes: Node[], edges: Edge[]) {
  // Drop redo history on new action
  stack = [...stack.slice(0, pointer + 1), { nodes: [...nodes], edges: [...edges] }];
  pointer = stack.length - 1;
}

export function undo(setNodes: (n: Node[]) => void, setEdges: (e: Edge[]) => void) {
  if (pointer <= 0) return;
  pointer--;
  const snap = stack[pointer]!;
  setNodes(snap.nodes);
  setEdges(snap.edges);
}

export function redo(setNodes: (n: Node[]) => void, setEdges: (e: Edge[]) => void) {
  if (pointer >= stack.length - 1) return;
  pointer++;
  const snap = stack[pointer]!;
  setNodes(snap.nodes);
  setEdges(snap.edges);
}
```

### Pattern 6: SvelteKit SSR Workaround
**What:** Svelte Flow requires browser APIs. Use `vite.config.js` `ssr.noExternal` to prevent SSR import errors, and set `export const ssr = false` on the canvas route.

```typescript
// apps/studio/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    noExternal: ['@xyflow/svelte']
  }
});
```

```typescript
// apps/studio/src/routes/+page.ts
export const ssr = false; // Canvas is client-only
```

### Anti-Patterns to Avoid
- **Deep reactive `$state()` for nodes/edges:** Use `$state.raw()` — Svelte Flow mutates these arrays internally; deep reactivity causes double-render loops and performance issues.
- **Nesting `<SvelteFlowProvider>` multiple times:** Causes `getNodes()` to return empty arrays in child components. Wrap the application once at the page root level.
- **Building custom diamond/arrow SVG per edge:** Use shared `<marker>` definitions in `EdgeMarkers.svelte` rendered once in the DOM's `<defs>` — referenced by all edges via `url(#marker-id)`.
- **Reinventing collapsible container logic:** Use Svelte Flow's built-in `parentId` + `extent: 'parent'`. Only ContainerNode's Svelte component needs the collapse toggle state.
- **Putting search/filter logic inside Svelte Flow:** Node search is just array filtering in the palette sidebar. Canvas "highlight matching" sets `selected: true` on matching nodes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph rendering, drag, zoom, pan | Custom canvas/SVG engine | `@xyflow/svelte` | Handles viewport math, selection, handle snapping, edge routing, minimap — 50k+ lines of battle-tested code |
| Node resize handles | Custom drag-resize overlay | `<NodeResizer>` from `@xyflow/svelte` | Handles all 8 directions, min/max constraints, proper z-index |
| Edge path calculation | Custom SVG path math | `getStraightPath()`, `getBezierPath()`, `getSmoothStepPath()` from `@xyflow/svelte` | Accounts for handle positions, direction reversals, label placement midpoints |
| Fuzzy node search | Custom substring match | `fuse.js` | Handles typos, partial matches, weighted field scoring with zero config |
| Unique node IDs | `Math.random().toString()` | `nanoid()` | Cryptographically secure, collision-resistant, URL-safe 21-char IDs |
| Keyboard shortcut registration | Raw `document.addEventListener('keydown')` | `svelte-put/shortcut` action | Svelte lifecycle-aware, cleans up on component destroy, handles Meta+modifier combos |
| Dark mode class toggling | Inline `<script>` in `<head>` | Pattern: localStorage + matchMedia + CSS custom properties | Avoids FOUC, syncs across tabs, integrates with Tailwind `dark:` prefix |
| UI components (sidebar, tooltip, input) | Custom-built components | `shadcn-svelte` | Svelte 5 + Tailwind v4 ready, copy-owned (no breaking upgrade risk) |

**Key insight:** Svelte Flow is the entire rendering engine. The team's job is wiring CALM domain logic (types, containment rules, edge semantics) to the Svelte Flow API — not rebuilding graph rendering primitives.

---

## Common Pitfalls

### Pitfall 1: `$state()` vs `$state.raw()` for nodes/edges
**What goes wrong:** Using `$state([])` (deep reactive) for nodes/edges causes Svelte's proxy layer to intercept Svelte Flow's internal mutations, leading to double-render loops, stale position data after drag, and subtle UI glitches.
**Why it happens:** Svelte Flow mutates node position arrays internally during drag. Deep reactivity intercepts these mutations and triggers re-renders mid-gesture.
**How to avoid:** Always declare `let nodes = $state.raw([...])` and `let edges = $state.raw([...])`.
**Warning signs:** Node jumps back to start position on drag; edge drawing feels laggy.

### Pitfall 2: SvelteFlowProvider Nested Multiple Times
**What goes wrong:** `useSvelteFlow()` hook called inside a component that is a descendant of a secondary `<SvelteFlowProvider>` — `getNodes()` returns `[]`.
**Why it happens:** Svelte context lookup finds the nearest ancestor provider, which may be an empty one.
**How to avoid:** Never add a second `<SvelteFlowProvider>` wrapper. The `<SvelteFlow>` component already creates a provider.
**Warning signs:** `getNodes()` returns empty array even though canvas shows nodes.

### Pitfall 3: SSR Import Errors with @xyflow/svelte
**What goes wrong:** SvelteKit tries to SSR-import `@xyflow/svelte`, which uses browser-only APIs (`ResizeObserver`, `document`), causing build/runtime errors.
**Why it happens:** SvelteKit SSR bundles all imports by default.
**How to avoid:** Add `ssr: { noExternal: ['@xyflow/svelte'] }` to `vite.config.ts` AND `export const ssr = false` on the canvas route.
**Warning signs:** `ERR_UNSUPPORTED_DIR_IMPORT` or `ResizeObserver is not defined` during `pnpm build`.

### Pitfall 4: Containment Edge vs ParentId Out of Sync
**What goes wrong:** A `deployed-in` edge exists in the edges array but the child node has no `parentId` — containment visual rendering (nested box) does not appear.
**Why it happens:** The Svelte Flow `parentId` property on the Node object is what drives visual containment, not the edge type. Creating a containment edge must also update the child's `parentId`.
**How to avoid:** In the `onconnect` handler, detect when edge type is `deployed-in` or `composed-of`, then immediately call `makeContainment()` to update the node's `parentId`.
**Warning signs:** Edge drawn but child appears outside parent; collapsing parent doesn't hide child.

### Pitfall 5: Custom SVG Markers Not Rotating with Edge Direction
**What goes wrong:** Custom diamond or arrow markers always point the same direction regardless of edge orientation.
**Why it happens:** Missing `orient="auto-start-reverse"` on the `<marker>` element.
**How to avoid:** Always include `orient="auto-start-reverse"` on all `<marker>` definitions.
**Warning signs:** Arrowhead/diamond points up regardless of whether edge goes left/right/down.

### Pitfall 6: Undo/redo snapshot taken after mutation
**What goes wrong:** History captures the state AFTER the change, so undo restores to the wrong state.
**Why it happens:** Snapshot is pushed in the wrong event handler phase.
**How to avoid:** Push the snapshot BEFORE the mutation (in `onbeforedelete`, `onnodedragstart`, etc.), or capture state in a pre-mutation effect.
**Warning signs:** Cmd+Z undoes the wrong action, or takes two presses to see a change.

---

## Code Examples

### SvelteFlow Minimal Canvas (SvelteKit route)
```svelte
<!-- Source: https://svelteflow.dev/learn -->
<!-- apps/studio/src/routes/+page.svelte -->
<script lang="ts">
  // SPDX-FileCopyrightText: 2024 CalmStudio contributors
  // SPDX-License-Identifier: Apache-2.0
  import { SvelteFlow, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { nodeTypes, edgeTypes } from '$lib/canvas/nodeTypes';

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
</script>

<div style="width: 100%; height: 100vh;">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    deleteKey="Delete"
    selectionKey="Shift"
    multiSelectionKey="Meta"
    fitView
  />
</div>
```

### Context Menu on Node Right-Click
```typescript
// Source: https://svelteflow.dev/examples/interaction/context-menu
const handleContextMenu: NodeEventWithPointer<MouseEvent> = ({ event, node }) => {
  event.preventDefault();
  menu = {
    id: node.id,
    top: event.clientY < clientHeight - 200 ? event.clientY : undefined,
    left: event.clientX < clientWidth - 200 ? event.clientX : undefined,
    right: event.clientX >= clientWidth - 200 ? clientWidth - event.clientX : undefined,
    bottom: event.clientY >= clientHeight - 200 ? clientHeight - event.clientY : undefined,
  };
};
```

### Copy/Paste Pattern (CANV-07)
```typescript
// Manual implementation — Svelte Flow has no built-in copy/paste
// Source: https://github.com/xyflow/xyflow/issues/4317
import { nanoid } from 'nanoid';

let clipboard: Node[] = [];

function copy(nodes: Node[]) {
  clipboard = nodes.filter(n => n.selected);
}

function paste(nodes: Node[]): Node[] {
  const newNodes = clipboard.map(n => ({
    ...n,
    id: nanoid(),
    position: { x: n.position.x + 20, y: n.position.y + 20 },
    selected: false,
    data: { ...n.data, calmId: nanoid() }
  }));
  return [...nodes, ...newNodes];
}
```

### Dark Mode Toggle (CANV-09)
```typescript
// apps/studio/src/lib/stores/theme.svelte.ts
// Pattern: localStorage + matchMedia, sets 'dark' class on <html>
function initTheme() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored ? stored === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', dark);
  return dark;
}
```

### CALM Node TypeScript Types (calm-core)
```typescript
// packages/calm-core/src/index.ts
// SPDX-FileCopyrightText: 2024 CalmStudio contributors
// SPDX-License-Identifier: Apache-2.0

export type CalmNodeType =
  | 'actor'
  | 'system'
  | 'service'
  | 'database'
  | 'network'
  | 'webclient'
  | 'ecosystem'
  | 'ldap'
  | 'data-asset';

export type CalmRelationshipType =
  | 'connects'
  | 'interacts'
  | 'deployed-in'
  | 'composed-of'
  | 'options';

export interface CalmNode {
  'unique-id': string;
  'node-type': CalmNodeType | string; // string allows custom types
  name: string;
  description?: string;
  interfaces?: CalmInterface[];
}

export interface CalmRelationship {
  'unique-id': string;
  'relationship-type': CalmRelationshipType;
  source: string;         // unique-id of source node
  destination: string;    // unique-id of destination node
  protocol?: string;      // e.g. 'HTTPS', 'JDBC', 'gRPC'
  description?: string;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte Flow on Svelte 4 stores | Svelte Flow 1.x with Svelte 5 runes (`$state.raw`) | May 2025 (v1.0) | Use `$state.raw()` for nodes/edges — NOT `$state()` |
| `@xyflow/svelte` alpha/beta | v1.5.x stable | 2025 | Stable API, safe to depend on |
| Testing Svelte with jsdom | Vitest Browser Mode + vitest-browser-svelte | 2024-2025 | Real browser testing for canvas interactions; jsdom still OK for unit tests |
| Tailwind CSS v3 in SvelteKit | Tailwind CSS v4 with `@theme` directive | 2025 | Config lives in CSS, not `tailwind.config.js` |
| shadcn-svelte Svelte 4 | shadcn-svelte with Svelte 5 + Tailwind v4 | 2025 | Full support; use latest CLI |

**Deprecated/outdated:**
- `@testing-library/svelte` with jsdom: still works but community moving to `vitest-browser-svelte` for real browser fidelity
- `useStore()` from `@xyflow/svelte`: only for advanced cases; prefer `useSvelteFlow()` and `useNodes()`/`useEdges()` hooks

---

## Open Questions

1. **SvelteKit scaffold for `apps/studio` is not yet created**
   - What we know: `apps/studio/src/index.ts` is an empty export — no SvelteKit app exists yet
   - What's unclear: Does Phase 2 need to bootstrap SvelteKit from scratch, or is that a Wave 0 task?
   - Recommendation: Make Wave 0 of Phase 2 explicitly scaffold the SvelteKit app (`pnpm create svelte` equivalent), add Tailwind v4, install `@xyflow/svelte`, and configure SSR. All subsequent waves assume this is done.

2. **CALM `options` relationship type**
   - What we know: The REQUIREMENTS.md lists 5 relationship types including `options`. The CALM official docs list 4 (connects, interacts, deployed-in, composed-of). `options` may be a CalmStudio-specific extension.
   - What's unclear: Is `options` in the official CALM JSON schema or project-defined?
   - Recommendation: Treat `options` as a first-class CALM type in `CalmRelationshipType`; validate against the CALM spec before Phase 3.

3. **Undo/redo snapshot granularity**
   - What we know: Manual history store is required; Svelte Flow fires `onnodedrag`, `onnodedragstop`, `onconnect`, `ondelete` events
   - What's unclear: Should every position micro-change during drag be snapshotted, or only on `dragstop`?
   - Recommendation: Snapshot on `onnodedragstop` (not during drag), `onconnect`, `ondelete`, and explicit node data mutations. This matches user expectations for Cmd+Z granularity.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.x + @testing-library/svelte ^5.x |
| Config file | `apps/studio/vite.config.ts` (vitest config inline) — Wave 0 creates it |
| Quick run command | `pnpm --filter @calmstudio/studio test --run` |
| Full suite command | `pnpm --filter @calmstudio/studio test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANV-01 | Drag palette node onto canvas creates a node | E2E | `pnpm test:e2e -- --grep "palette drag"` | Wave 0 |
| CANV-02 | Connect two nodes creates typed edge | E2E | `pnpm test:e2e -- --grep "typed edge"` | Wave 0 |
| CANV-03 | Select + Delete removes node | E2E | `pnpm test:e2e -- --grep "delete node"` | Wave 0 |
| CANV-04 | Zoom/pan controls work | E2E | `pnpm test:e2e -- --grep "zoom pan"` | Wave 0 |
| CANV-05 | Cmd+Z undoes last action | E2E | `pnpm test:e2e -- --grep "undo"` | Wave 0 |
| CANV-06 | Delete key removes selection | E2E | `pnpm test:e2e -- --grep "keyboard"` | Wave 0 |
| CANV-07 | Cmd+C + Cmd+V duplicates selected nodes with new IDs | unit | `pnpm test -- --grep "copy paste"` | Wave 0 |
| CANV-08 | Searching "service" highlights service nodes | unit | `pnpm test -- --grep "node search"` | Wave 0 |
| CANV-09 | Toggling dark mode adds 'dark' class to html | unit | `pnpm test -- --grep "dark mode"` | Wave 0 |
| CALM-01 | All 9 node types render distinct shapes | component | `pnpm test -- --grep "node renders"` | Wave 0 |
| CALM-02 | Unknown type falls back to GenericNode | component | `pnpm test -- --grep "GenericNode"` | Wave 0 |
| CALM-03 | connects edge has solid stroke; interacts has dashed | component | `pnpm test -- --grep "edge style"` | Wave 0 |
| CALM-04 | Interfaces render as handles at correct positions | component | `pnpm test -- --grep "handles"` | Wave 0 |
| CALM-05 | Containment edge sets parentId on child node | unit | `pnpm test -- --grep "containment"` | Wave 0 |
| CALM-06 | Protocol label appears centered on connects edge | component | `pnpm test -- --grep "protocol label"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/studio test --run`
- **Per wave merge:** `pnpm test` (all packages)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/studio/vite.config.ts` — vitest + SvelteKit config (Wave 0 scaffolds this)
- [ ] `apps/studio/src/tests/` — test directory
- [ ] `apps/studio/playwright.config.ts` — E2E config
- [ ] Framework install: `pnpm --filter @calmstudio/studio add -D vitest @testing-library/svelte @playwright/test vitest-browser-svelte`

---

## Sources

### Primary (HIGH confidence)
- [svelteflow.dev/learn](https://svelteflow.dev/learn) — SvelteKit setup, minimal canvas, `$state.raw` requirement
- [svelteflow.dev/learn/customization/custom-nodes](https://svelteflow.dev/learn/customization/custom-nodes) — NodeProps, nodeTypes registration, Handle component
- [svelteflow.dev/learn/customization/custom-edges](https://svelteflow.dev/learn/customization/custom-edges) — EdgeProps, BaseEdge, getStraightPath, EdgeLabel
- [svelteflow.dev/examples/layout/subflows](https://svelteflow.dev/examples/layout/subflows) — parentId, extent: 'parent' sub-flow pattern
- [svelteflow.dev/examples/edges/edge-markers](https://svelteflow.dev/examples/edges/edge-markers) — SVG `<marker>` definition pattern, markerEnd references
- [svelteflow.dev/examples/interaction/drag-and-drop](https://svelteflow.dev/examples/interaction/drag-and-drop) — HTML5 DnD API + screenToFlowPosition pattern
- [svelteflow.dev/examples/interaction/context-menu](https://svelteflow.dev/examples/interaction/context-menu) — onnodecontextmenu handler pattern
- [xyflow.com/blog/svelte-flow-release](https://xyflow.com/blog/svelte-flow-release) — v1.0 release date (May 14, 2025), Svelte 5 rewrite details
- [calm.finos.org/core-concepts/nodes/](https://calm.finos.org/core-concepts/nodes/) — CALM node schema, properties
- [calm.finos.org/core-concepts/relationships/](https://calm.finos.org/core-concepts/relationships/) — CALM relationship types, JSON structure

### Secondary (MEDIUM confidence)
- [github.com/xyflow/xyflow/issues/4317](https://github.com/xyflow/xyflow/issues/4317) — Copy/paste not built-in; community workaround via `selected` node filtering + nanoid
- [svelteflow.dev/api-reference/svelte-flow](https://svelteflow.dev/api-reference/svelte-flow) — Event props, no built-in undo/redo
- [npm @xyflow/svelte](https://www.npmjs.com/package/@xyflow/svelte) — SSR workaround: `ssr: { noExternal: ['@xyflow/svelte'] }`
- [svelte.dev/docs/svelte/testing](https://svelte.dev/docs/svelte/testing) — Vitest as standard test runner for Svelte 5

### Tertiary (LOW confidence — validate before implementing)
- CALM `options` relationship type: present in REQUIREMENTS.md but not confirmed in official CALM v1 spec docs. Treat as canonical per project decision; verify against CALM JSON schema before Phase 3.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — @xyflow/svelte v1.x confirmed stable, Svelte 5 rewrite confirmed, installation verified
- Architecture Patterns: HIGH — all patterns verified against official Svelte Flow docs/examples
- CALM Data Model: MEDIUM — 6 core node types confirmed; `ecosystem`, `ldap`, `data-asset` confirmed by REQUIREMENTS.md/CONTEXT.md authorship but not found in official CALM docs search
- Undo/Redo: MEDIUM — confirmed not built-in; manual snapshot pattern is industry standard for flow libraries
- Copy/Paste: MEDIUM — confirmed not built-in; GitHub issue confirmed workaround pattern works

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (Svelte Flow 1.x API is stable; check for minor version changes)
