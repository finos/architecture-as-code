# Phase 3: Properties & Bidirectional Sync - Research

**Researched:** 2026-03-11
**Domain:** Svelte 5 state management, CodeMirror 6, bidirectional sync, resizable panel layouts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Properties panel layout**
- Right sidebar, mirrors the left NodePalette — classic IDE three-column layout (palette | canvas | properties)
- Collapses to a thin strip (~40px) with a hint icon when nothing is selected; expands when a node/edge is selected
- Resizable by dragging the left edge divider between canvas and panel
- Context-sensitive sections: node selected shows node fields, edge selected shows edge fields — header reflects what's selected

**Code editor behavior**
- Bottom split panel below the canvas — horizontal split, resizable divider, full width
- Visible by default on app launch (collapsed to ~30% height) — bidirectional sync is the key differentiator, show it immediately
- CALM JSON only in Phase 3; calmscript tab exists but is grayed out with "Coming in Phase 5" tooltip
- Selecting a node/edge on canvas scrolls the code editor to and highlights the corresponding JSON fragment

**Sync engine guardrails**
- Debounced live sync (300-500ms) — canvas updates as user types in code editor, with debounce; invalid JSON mid-edit holds last valid canvas state
- Invalid JSON handling: canvas keeps showing last valid diagram; CodeMirror shows red squiggles on invalid lines; small status indicator (red dot or "Invalid JSON" warning)
- Unified undo/redo history — one stack for the whole app (canvas + code + properties); Cmd+Z undoes the last action regardless of surface; extends existing snapshot-based history store
- Last-write-wins conflict resolution — both surfaces write to the same CALM model; direction mutex prevents infinite loops; rare edge case in single-user tool

**CALM metadata depth**
- Core fields + interfaces: node (unique-id read-only, name, description, node-type, interfaces), edge (unique-id read-only, relationship-type, protocol, description, source/dest interfaces)
- Interface editing: inline list within node properties — each row has type dropdown (url, host-port, container-image, port), value text input, delete button; "+Add interface" at bottom
- Custom key-value metadata (PROP-04) included — "Custom Properties" section at bottom of panel with add/remove key-value pairs
- Controls and flows deferred to Phase 6+
- Changing node-type in properties panel live-swaps the visual shape on canvas (uses existing resolveNodeType())

### Claude's Discretion
- Exact panel widths and default split ratios
- Loading/transition animations
- Error state visual design
- CodeMirror theme and configuration details
- Debounce timing within the 300-500ms range
- Direction mutex implementation strategy

### Deferred Ideas (OUT OF SCOPE)
- **AI Chat Panel** — In-app chat interface for generating diagrams from natural language, modifying architectures via prompts, generating architecture summaries/descriptions for onboarding newcomers to CALM/architecture. Pairs with MCP server (Phase 8).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROP-01 | User can edit CALM metadata for selected node (unique-id, name, description, node-type) | Properties panel writes to Node.data; resolveNodeType() enables live shape swap |
| PROP-02 | User can add/edit/remove interfaces on a node (URL, host-port, container-image, port, etc.) | Inline list component with per-row type dropdown + value input + delete; interfaces stored in Node.data.interfaces |
| PROP-03 | User can add/edit/remove CALM controls on nodes and edges | Deferred to Phase 6 per locked decisions — PROP-03 is listed in Phase 3 requirements but controls are deferred; implement empty/disabled section placeholder only |
| PROP-04 | User can add custom metadata key-value pairs to any node or edge | "Custom Properties" section at bottom of panel; stored in Node.data.customMetadata as Record<string, string> |
| PROP-05 | User can edit relationship properties (type, protocol, description, source/destination interfaces) | Edge properties panel; relationship-type via dropdown, same pattern as node panel |
| SYNC-01 | Diagram changes automatically update CALM JSON in real-time (forward sync) | calmModel store derives CalmArchitecture from nodes/edges; serialized to JSON string for CodeMirror |
| SYNC-02 | CALM JSON edits in code panel automatically update the diagram (reverse sync) | Debounced $effect on CodeMirror value; parses JSON; if valid, updates nodes/edges; direction mutex blocks re-entry |
| SYNC-03 | Sync engine prevents infinite loops via direction mutex | Boolean `syncing` flag (or Svelte 5 $state flag) set true during sync application; checked at start of each sync path |
| SYNC-04 | CALM JSON is the single canonical source of truth; visual state is derived | calmModel store owns canonical CalmArchitecture; canvas nodes/edges are derived representations |
| CODE-01 | User can view and edit CALM JSON in a CodeMirror panel alongside the canvas | CodeMirror 6 via svelte-codemirror-editor v2 (Svelte 5 compatible), bottom split panel |
| CODE-02 | User can toggle between CALM JSON and calmscript views | Tab bar above editor; CALM JSON tab active, calmscript tab disabled with "Coming in Phase 5" tooltip |
| CODE-03 | Code panel has syntax highlighting, line numbers, and error indicators | @codemirror/lang-json + @codemirror/lint; red squiggles on invalid JSON lines |
</phase_requirements>

---

## Summary

Phase 3 delivers three tightly coupled features: a properties panel (right sidebar), a CodeMirror JSON editor (bottom panel), and the bidirectional sync engine connecting them. The core architectural challenge is preventing infinite update loops while keeping all three surfaces — canvas, properties panel, and code editor — in sync without a full re-render cycle.

The canonical pattern for this problem is a **direction mutex**: a module-level boolean flag that is set to `true` whenever the sync engine is actively applying an update. Each sync path checks this flag at entry and returns immediately if it is already set, breaking the loop. This pattern is confirmed by multiple production implementations and is the approach the user has already chosen in the locked decisions.

The two new UI libraries required are `svelte-codemirror-editor` v2 (Svelte 5 runes support, CodeMirror 6 foundation) for the code panel, and `paneforge` v1 for the resizable split layout (palette | canvas+code | properties). Both are actively maintained and Svelte 5 compatible as of March 2026.

**Primary recommendation:** Model the sync engine as a new `calmModel.svelte.ts` store that owns `CalmArchitecture` as the single source of truth. Canvas nodes/edges are the "forward projection" into Svelte Flow format; the JSON string is the "backward projection" via `JSON.stringify`. The direction mutex lives inside the store as a private flag. Properties panel and code editor both call store mutation functions — never write to canvas nodes/edges directly.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte-codemirror-editor | ^2.1.0 | CodeMirror 6 wrapper for Svelte 5 (runes) | Only Svelte 5 rune-native CM6 wrapper with active maintenance; v2.0.0 dropped Svelte 3/4 entirely |
| @codemirror/lang-json | ^6.0.2 | JSON syntax highlighting + parse tree | Official CM6 language package; provides `json()` extension |
| @codemirror/lint | ^6.9.4 | Red squiggles and gutter markers for errors | Official CM6 lint package; pairs with lang-json for invalid JSON highlighting |
| paneforge | ^1.0.0 | Resizable split panels (three-column + bottom panel) | Svelte 5 stable release; inspired by react-resizable-panels; supports nested groups and LocalStorage persistence |
| jsonpos | ^3.0.0 | Find character offsets for JSON paths | Used to scroll CodeMirror to the JSON fragment for a selected node/edge |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @codemirror/theme-one-dark | ^6.1.2 | Dark theme for CodeMirror | When `isDark()` is true; pass as extension |
| nanoid | ^5.0.9 (already installed) | Generate interface unique-ids | When user adds a new interface row |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| svelte-codemirror-editor v2 | Raw CodeMirror 6 directly | Raw CM6 gives more control but requires writing the full Svelte binding layer — 200+ lines; the wrapper eliminates the boilerplate while exposing `onready` to get the `EditorView` for imperative ops |
| paneforge | svelte-splitpanes | svelte-splitpanes v8 is also Svelte 5 compatible; paneforge has a cleaner API and is from the same ecosystem as other shadcn-svelte components; both are valid |
| jsonpos | Manual JSON.stringify + indexOf | indexOf is fragile (false matches, can't distinguish keys from values); jsonpos uses a proper CST parser |
| Direction mutex boolean | RxJS Subject or event bus | Single-user tool; boolean mutex is the simplest correct solution; no observable overhead needed |

**Installation:**
```bash
pnpm add svelte-codemirror-editor @codemirror/lang-json @codemirror/lint paneforge jsonpos
pnpm add -D @codemirror/theme-one-dark
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/studio/src/lib/
├── canvas/
│   ├── nodes/              # (existing) 11 node components
│   ├── edges/              # (existing) edge components
│   ├── CalmCanvas.svelte   # (existing) — no changes needed for sync
│   ├── nodeTypes.ts        # (existing) resolveNodeType() — reused
│   └── ...
├── properties/             # NEW
│   ├── PropertiesPanel.svelte    # outer panel shell (collapse/expand logic)
│   ├── NodeProperties.svelte     # fields for selected node
│   ├── EdgeProperties.svelte     # fields for selected edge
│   ├── InterfaceList.svelte      # inline interface rows (PROP-02)
│   └── CustomMetadata.svelte     # key-value pairs (PROP-04)
├── editor/                 # NEW
│   ├── CodePanel.svelte          # shell: tab bar + CodeMirror + status bar
│   └── useJsonSync.ts            # selection-to-JSON scroll helper using jsonpos
├── stores/
│   ├── history.svelte.ts   # (existing) — extend Snapshot type to include calmJson
│   ├── clipboard.svelte.ts # (existing)
│   ├── theme.svelte.ts     # (existing)
│   └── calmModel.svelte.ts # NEW — canonical source of truth + sync engine
└── palette/                # (existing)
```

### Pattern 1: Canonical CALM Model Store

**What:** A module-level Svelte 5 `$state` store that owns `CalmArchitecture` as the single source of truth. Exposes typed mutation functions. Internally maintains `syncing` flag to prevent re-entry.

**When to use:** Any time canvas, properties panel, or code editor needs to mutate the CALM data.

**Example:**
```typescript
// Source: CONTEXT.md + established project patterns (module-level $state runes)
// apps/studio/src/lib/stores/calmModel.svelte.ts

import type { CalmArchitecture } from '@calmstudio/calm-core';
import type { Node, Edge } from '@xyflow/svelte';
import { pushSnapshot } from './history.svelte';

let model = $state<CalmArchitecture>({ nodes: [], relationships: [] });
let syncing = false;  // direction mutex — not $state, just a flag

/** Apply a CalmArchitecture from code editor. Returns false if syncing (loop guard). */
export function applyFromJson(arch: CalmArchitecture): boolean {
  if (syncing) return false;
  syncing = true;
  try {
    model = arch;
    // forward-project to Svelte Flow nodes/edges happens in $derived in +page.svelte
  } finally {
    syncing = false;
  }
  return true;
}

/** Apply canvas mutation (node moved, edge added). Returns false if syncing. */
export function applyFromCanvas(nodes: Node[], edges: Edge[]): boolean {
  if (syncing) return false;
  syncing = true;
  try {
    model = flowToCalm(nodes, edges);
  } finally {
    syncing = false;
  }
  return true;
}

export function getModel(): CalmArchitecture { return model; }
export function getModelJson(): string { return JSON.stringify(model, null, 2); }
```

### Pattern 2: Debounced Reverse Sync (Code Editor → Canvas)

**What:** `$effect` watches CodeMirror `value` string. A debounce timer (300-500ms) fires after the user stops typing. On fire, attempt `JSON.parse`. If valid, call `applyFromJson`. If invalid, show error indicator — do NOT update canvas.

**When to use:** Inside `CodePanel.svelte` or a composable `useJsonSync.ts`.

**Example:**
```typescript
// Source: Svelte 5 official docs ($effect) + CONTEXT.md debounce decision
let jsonValue = $state('');
let parseError = $state<string | null>(null);

$effect(() => {
  const val = jsonValue;
  const timer = setTimeout(() => {
    try {
      const parsed = JSON.parse(val) as CalmArchitecture;
      parseError = null;
      applyFromJson(parsed);         // mutex prevents infinite loop
      pushSnapshot(/* ... */);
    } catch (e) {
      parseError = (e as Error).message;
      // canvas keeps last valid state — no update
    }
  }, 400); // within 300-500ms window

  return () => clearTimeout(timer);  // cleanup on next effect run
});
```

### Pattern 3: Forward Sync (Canvas → Code Editor)

**What:** Canvas mutations call `applyFromCanvas`, which updates the canonical model. The JSON string is a `$derived` from the model. CodeMirror receives the new string as `value` prop — but only if it didn't originate from the code editor (mutex covers this).

**When to use:** After any canvas mutation (node add, move, delete, edge add/delete, property change from properties panel).

**Example:**
```typescript
// In +page.svelte — $derived keeps JSON string in sync with model
const calmJson = $derived(getModelJson());

// CodePanel receives the derived string
// <CodePanel value={calmJson} onchange={(v) => { jsonValue = v; }} />
```

### Pattern 4: Selection Scroll in CodeMirror

**What:** When a node/edge is selected on canvas, find its JSON offset using `jsonpos` and dispatch a `scrollIntoView` + decoration transaction to the `EditorView`.

**When to use:** When `selectedNodeId` or `selectedEdgeId` changes.

**Example:**
```typescript
// Source: jsonpos docs + CodeMirror 6 dispatch API
import { jsonpos } from 'jsonpos';
import { EditorView, Decoration, StateEffect } from '@codemirror/view';

function scrollToNode(view: EditorView, json: string, nodeId: string): void {
  // Find the node entry in the nodes array
  const arch = JSON.parse(json) as CalmArchitecture;
  const idx = arch.nodes.findIndex(n => n['unique-id'] === nodeId);
  if (idx === -1) return;

  const loc = jsonpos(json, { path: ['nodes', idx] });
  if (!loc) return;

  view.dispatch({
    selection: { anchor: loc.start.offset, head: loc.end.offset },
    scrollIntoView: true,
  });
}
```

### Pattern 5: Layout (Three-Column + Bottom Panel)

**What:** `paneforge` `PaneGroup` with `direction="horizontal"` for palette | canvas+code | properties. The canvas+code column is itself a vertical `PaneGroup` for canvas over code editor.

**When to use:** In `+page.svelte` to replace the current flex layout.

**Example:**
```svelte
<!-- Source: paneforge docs (https://paneforge.com/docs) -->
<PaneGroup direction="horizontal">
  <Pane defaultSize={15} minSize={10}>
    <NodePalette />
  </Pane>
  <PaneResizer />
  <Pane defaultSize={70}>
    <PaneGroup direction="vertical">
      <Pane defaultSize={70} minSize={30}>
        <CalmCanvas bind:nodes bind:edges />
      </Pane>
      <PaneResizer />
      <Pane defaultSize={30} minSize={10}>
        <CodePanel value={calmJson} />
      </Pane>
    </PaneGroup>
  </Pane>
  <PaneResizer />
  <Pane defaultSize={15} minSize={5} maxSize={40}>
    <PropertiesPanel selectedNode={selectedNode} selectedEdge={selectedEdge} />
  </Pane>
</PaneGroup>
```

### Anti-Patterns to Avoid

- **Writing to nodes/edges directly from properties panel:** Properties panel must call store mutation functions — never `nodes = nodes.map(...)` from outside CalmCanvas. This bypasses the mutex.
- **`$state()` for CodeMirror value when driving forward sync:** Using deep `$state` for the full JSON string fires on every keystroke. Use `$state.raw` for the string or rely on the CodeMirror `onchange` callback + debounce pattern.
- **`$effect` to link canvas state to JSON string directly:** Official Svelte 5 docs warn against using `$effect` to synchronize two pieces of state — use `$derived` for the forward direction (canvas → JSON) and an explicit debounced callback for the reverse.
- **Re-creating the CodeMirror editor on each value change:** The `svelte-codemirror-editor` component handles this, but if using raw CM6, replacing `EditorState` destroys undo history. Use `view.dispatch({ changes: { from: 0, to: doc.length, insert: newContent } })` for programmatic updates.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable panels | CSS-only drag listeners, mouse event calculations | paneforge | Handles min/max constraints, keyboard accessibility, percentage-based sizes, LocalStorage persistence |
| CodeMirror Svelte binding | Custom `use:` action + EditorView lifecycle | svelte-codemirror-editor v2 | Correct handling of CM6's immutable state model, editor lifecycle in Svelte component lifecycle, and `onready` EditorView access |
| JSON error squiggles | Manual regex parsing + DOM overlay | @codemirror/lint + @codemirror/lang-json | CM6's linter integrates with the parse tree; character-precise error ranges |
| JSON-to-character-offset mapping | `string.indexOf(nodeId)` | jsonpos | indexOf finds the first occurrence — wrong for repeated values; jsonpos uses the full CST to find the precise path |
| Debounce | Custom setTimeout management | Svelte 5 `$effect` cleanup function (native) | `$effect` returns a cleanup function; the closure captures `setTimeout` id; zero dependencies |

**Key insight:** CodeMirror 6 uses an immutable state model. Every update is a `Transaction`. Never directly mutate `view.state.doc`. All programmatic content changes must go through `view.dispatch({ changes: ... })`. Violating this causes CM6 to throw `"Calls to EditorView.update are not allowed while an update is in progress"`.

---

## Common Pitfalls

### Pitfall 1: Infinite Update Loop
**What goes wrong:** Canvas mutation → forward sync → sets CodeMirror value → CodeMirror `onchange` fires → reverse sync → updates canvas → triggers `onnodeschange` → forward sync → ...
**Why it happens:** Both sync directions are reactive and respond to the same state.
**How to avoid:** Direction mutex. Set `syncing = true` before any programmatic state update. Every sync entry point checks `if (syncing) return` before doing anything. Use `try/finally` to guarantee the flag is cleared.
**Warning signs:** Rapid re-renders, browser tab freeze within seconds of any edit, stack overflow in console.

### Pitfall 2: CodeMirror History Destroyed by Full Doc Replace
**What goes wrong:** Every time the canonical model updates (from canvas), the code editor value is set to a new string. If implemented as a full `EditorState.create()`, Cmd+Z in the code editor undoes to an empty document.
**Why it happens:** Re-creating `EditorState` wipes CM6's internal undo stack.
**How to avoid:** When forward-syncing JSON into the editor, check if the new JSON equals the current doc content (after debounce, the reverse-sync path has already committed). If equal, skip the dispatch. If different (canvas change), use `view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newJson } })` — this preserves undo history for edits made in the editor.
**Warning signs:** Cmd+Z in code editor jumps to empty document or very old state.

### Pitfall 3: `$state.raw` Breakage
**What goes wrong:** Phase 2 established `$state.raw()` for nodes/edges to avoid double-render loops with Svelte Flow. If the sync engine accidentally triggers deep `$state` reactivity on these arrays, Svelte Flow re-renders every node on every keystroke.
**Why it happens:** Assigning a new array to a `$state.raw` variable is fine; mutating inner elements is not reactive with `$state.raw` but can still cause unexpected behavior if mixed with deep reactive stores.
**How to avoid:** Continue using `$state.raw` for the nodes/edges arrays in CalmCanvas. The sync engine returns NEW arrays (map/filter patterns), not mutations. The canonical model store can use plain `$state` for `CalmArchitecture` since it isn't passed to Svelte Flow directly.
**Warning signs:** Performance regression, double node renders visible in React DevTools equivalent.

### Pitfall 4: Properties Panel Writes Bypass History
**What goes wrong:** User edits a property → canvas updates → but Cmd+Z doesn't undo it (or history is inconsistent).
**Why it happens:** `pushSnapshot` is not called before the mutation, or is called at the wrong layer.
**How to avoid:** Property panel mutation functions in the store call `pushSnapshot(nodes, edges)` (or the extended snapshot including calmJson) BEFORE modifying state — same pattern as all existing mutations in CalmCanvas.
**Warning signs:** Undo doesn't restore the pre-edit state for properties changes.

### Pitfall 5: Selected Node JSON Scroll Finds Wrong Node
**What goes wrong:** `jsonpos(json, { path: ['nodes', idx] })` returns the wrong character offset.
**Why it happens:** Array index in the `CalmArchitecture.nodes` array doesn't match the order in the serialized JSON if nodes have been reordered.
**How to avoid:** Find the index by searching the parsed `CalmArchitecture` object (not the SVelteFlow nodes array which may be in a different order). `arch.nodes.findIndex(n => n['unique-id'] === selectedId)`.
**Warning signs:** CodeMirror highlights the wrong JSON block when a node is selected.

### Pitfall 6: paneforge PaneGroup Layout Root Conflict
**What goes wrong:** Replacing the `div.app-shell` with PaneGroup breaks the full-viewport layout — panels overflow or collapse.
**Why it happens:** paneforge PaneGroup needs explicit `height: 100%` on itself and all ancestors up to the viewport.
**How to avoid:** Set `height: 100vh` on the outermost PaneGroup and ensure `overflow: hidden` is retained on the wrapper. The existing `app-shell` CSS can be adapted.
**Warning signs:** Panels appear with zero height or overflow the page.

---

## Code Examples

Verified patterns from official sources:

### CodeMirror 6 JSON with Linting (svelte-codemirror-editor v2)
```svelte
<!-- Source: svelte-codemirror-editor v2 README, @codemirror/lint npm docs -->
<script lang="ts">
  import CodeMirror from 'svelte-codemirror-editor';
  import { json, jsonParseLinter } from '@codemirror/lang-json';
  import { linter, lintGutter } from '@codemirror/lint';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { isDark } from '$lib/stores/theme.svelte';

  let { value = $bindable(''), onchange }: {
    value?: string;
    onchange?: (v: string) => void;
  } = $props();

  const extensions = $derived([
    linter(jsonParseLinter()),
    lintGutter(),
    ...(isDark() ? [oneDark] : []),
  ]);
</script>

<CodeMirror
  {value}
  lang={json()}
  {extensions}
  lineNumbers
  onchange={(v) => onchange?.(v)}
/>
```

### Direction Mutex in Module Store (Svelte 5)
```typescript
// Source: Established patterns from project STATE.md + CONTEXT.md decisions
// Module-level non-reactive flag — intentionally NOT $state (no reactivity needed)
let syncing = false;

export function withMutex<T>(fn: () => T): T | undefined {
  if (syncing) return undefined;
  syncing = true;
  try {
    return fn();
  } finally {
    syncing = false;
  }
}
```

### Debounced Reverse Sync with $effect Cleanup
```typescript
// Source: Svelte 5 official docs ($effect cleanup pattern)
// https://svelte.dev/docs/svelte/$effect
$effect(() => {
  const current = jsonValue; // track dependency
  const timer = setTimeout(() => {
    try {
      const arch = JSON.parse(current) as CalmArchitecture;
      parseError = null;
      withMutex(() => {
        pushSnapshot(getNodesSnapshot(), getEdgesSnapshot());
        applyArchitecture(arch);
      });
    } catch {
      parseError = 'Invalid JSON';
    }
  }, 400);
  return () => clearTimeout(timer); // Svelte calls this on next effect run
});
```

### jsonpos: Find Node's Character Offset in JSON
```typescript
// Source: jsonpos README (https://github.com/grantila/jsonpos)
import { jsonpos } from 'jsonpos';
import type { CalmArchitecture } from '@calmstudio/calm-core';

export function findNodeOffset(
  json: string,
  nodeUniqueId: string
): { start: number; end: number } | null {
  try {
    const arch = JSON.parse(json) as CalmArchitecture;
    const idx = arch.nodes.findIndex(n => n['unique-id'] === nodeUniqueId);
    if (idx === -1) return null;
    const loc = jsonpos(json, { path: ['nodes', idx] });
    if (!loc) return null;
    return { start: loc.start.offset, end: loc.end.offset };
  } catch {
    return null;
  }
}
```

### CalmArchitecture ↔ Svelte Flow Projection Functions
```typescript
// Source: Existing CalmCanvas.svelte node data shape + calm-core types.ts
import type { Node, Edge } from '@xyflow/svelte';
import type { CalmArchitecture, CalmNode, CalmRelationship } from '@calmstudio/calm-core';
import { resolveNodeType } from '$lib/canvas/nodeTypes';

/** Project CalmArchitecture → Svelte Flow nodes + edges */
export function calmToFlow(arch: CalmArchitecture): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = arch.nodes.map(cn => ({
    id: cn['unique-id'],
    type: resolveNodeType(cn['node-type']),
    position: { x: 0, y: 0 }, // positions are Svelte Flow-only, not in CALM JSON
    data: {
      label: cn.name,
      calmId: cn['unique-id'],
      calmType: cn['node-type'],
      description: cn.description,
      interfaces: cn.interfaces ?? [],
    },
  }));
  const edges: Edge[] = arch.relationships.map(cr => ({
    id: cr['unique-id'],
    source: cr.source,
    target: cr.destination,
    type: cr['relationship-type'],
    data: { protocol: cr.protocol, description: cr.description },
  }));
  return { nodes, edges };
}

/** Project Svelte Flow nodes + edges → CalmArchitecture */
export function flowToCalm(nodes: Node[], edges: Edge[]): CalmArchitecture {
  return {
    nodes: nodes.map(n => ({
      'unique-id': n.data.calmId as string,
      'node-type': n.data.calmType as string,
      name: n.data.label as string,
      description: n.data.description as string | undefined,
      interfaces: (n.data.interfaces ?? []) as CalmNode['interfaces'],
    })),
    relationships: edges.map(e => ({
      'unique-id': e.id,
      'relationship-type': (e.type ?? 'connects') as CalmRelationship['relationship-type'],
      source: e.source,
      destination: e.target,
      protocol: e.data?.protocol as string | undefined,
      description: e.data?.description as string | undefined,
    })),
  };
}
```

**Critical note on positions:** Svelte Flow positions (`node.position`) are purely visual and must NOT be stored in `CalmArchitecture`. The sync engine must preserve the existing positions when reverse-syncing from JSON to canvas. Pattern: on reverse sync, match nodes by `unique-id` and keep existing position if present, defaulting to `{x:0, y:0}` for new nodes.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 stores (`writable`, `derived`) | Svelte 5 module-level `$state` runes | Svelte 5 (Oct 2024) | Simpler store pattern — no `get()` imports, reactive by default in components |
| `$effect` for syncing two values | `$derived` for computed state, callbacks for side effects | Svelte 5 docs (2025) | Official guidance: don't use `$effect` to keep two states in sync; use derived or explicit event callbacks |
| CodeMirror 5 (textarea wrapping) | CodeMirror 6 (full state machine, immutable transactions) | CM6 stable (2022) | Programmatic updates require `view.dispatch()`; direct doc mutation throws |
| Separate undo stacks per surface | Unified undo stack across all surfaces | Design decision in CONTEXT.md | Simpler UX; users don't have to think about which surface owns undo |

**Deprecated/outdated:**
- `writable`/`derived` from `svelte/store`: Still works in Svelte 5 but the project has already adopted module-level `$state` runes (per STATE.md decisions). Phase 3 must follow that pattern.
- `CodeMirror.fromTextArea()`: CodeMirror 5 API — not applicable to CM6.

---

## Open Questions

1. **Position preservation on reverse sync**
   - What we know: CALM JSON does not store node positions; Svelte Flow requires positions to render.
   - What's unclear: When JSON is edited in the code panel and the architecture changes (e.g., a new node added), the new node has no position. The existing nodes must keep their canvas positions.
   - Recommendation: The canonical model store stores `Map<uniqueId, {x, y}>` as a separate positions map that is NOT serialized to CALM JSON. On reverse sync: new nodes get default position (e.g., `{x: 100 + idx * 120, y: 100}`); existing nodes keep their stored position. Forward sync (canvas → JSON) updates positions in the map.

2. **History snapshot granularity for code editor**
   - What we know: Current `Snapshot` type is `{ nodes: Node[], edges: Edge[] }`. The user wants unified undo that covers code edits.
   - What's unclear: Should every keystroke in the code editor add a history snapshot (100 snapshots in 5 seconds of typing), or only when the debounced sync successfully applies?
   - Recommendation: Only push a snapshot when the debounced parse succeeds and `applyFromJson` is called. This means Cmd+Z undoes to the last successfully applied JSON state, not every character. This is consistent with the existing snapshot-before-mutation pattern.

3. **PROP-03 controls section**
   - What we know: PROP-03 (controls on nodes/edges) is in the Phase 3 requirement list but CONTEXT.md says "controls and flows deferred to Phase 6+".
   - What's unclear: Does the planner need to implement PROP-03 in Phase 3 or just a placeholder?
   - Recommendation: The planner should implement a disabled "Controls" section in the properties panel with a "Coming in Phase 6" tooltip — same pattern as the calmscript tab. This satisfies the requirement's presence without Phase 6 work.

---

## Validation Architecture

> nyquist_validation is true in .planning/config.json — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.0.8 |
| Config file | `apps/studio/vite.config.ts` (inline `test:` block) |
| Quick run command | `pnpm --filter @calmstudio/studio test` |
| Full suite command | `pnpm --filter @calmstudio/studio test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-03 | Direction mutex prevents infinite loops | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| SYNC-04 | CALM JSON is single source of truth | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| SYNC-01 | Canvas changes update JSON (flowToCalm) | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/projection.test.ts` | ❌ Wave 0 |
| SYNC-02 | JSON edits update canvas (calmToFlow) | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/projection.test.ts` | ❌ Wave 0 |
| PROP-01 | Node metadata edit updates Node.data | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| PROP-02 | Interface add/edit/remove on node | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| PROP-04 | Custom metadata key-value on node/edge | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| PROP-05 | Edge relationship property edit | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ Wave 0 |
| CODE-01 | CodePanel renders with CodeMirror | component | manual-only — CM6 requires DOM; jsdom limitations for CM6 internals | N/A |
| CODE-02 | Tab bar: JSON active, calmscript disabled | component | manual-only — visual/interaction; Playwright in Phase 11 | N/A |
| CODE-03 | Syntax highlighting + error indicators | manual | visual — verify in browser | N/A |
| PROP-03 | Controls section placeholder present | manual | visual — verify in browser | N/A |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/studio test`
- **Per wave merge:** `pnpm --filter @calmstudio/studio test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/studio/src/tests/calmModel.test.ts` — covers SYNC-03, SYNC-04, PROP-01, PROP-02, PROP-04, PROP-05 (direction mutex, mutation functions, interface CRUD)
- [ ] `apps/studio/src/tests/projection.test.ts` — covers SYNC-01, SYNC-02 (flowToCalm, calmToFlow round-trip, position preservation)

---

## Sources

### Primary (HIGH confidence)
- Official CodeMirror 6 Reference Manual (https://codemirror.net/docs/ref/) — dispatch API, scroll-into-view, EditorState.create
- svelte-codemirror-editor v2 README (https://github.com/touchifyapp/svelte-codemirror-editor) — Svelte 5 compatibility confirmed, props/events
- Svelte 5 official docs (https://svelte.dev/docs/svelte/$effect) — cleanup pattern, $derived vs $effect guidance
- jsonpos README (https://github.com/grantila/jsonpos) — path-to-offset API confirmed
- paneforge docs (https://paneforge.com/docs) — PaneGroup/Pane/PaneResizer components; v1.0.0 Svelte 5 stable
- @codemirror/lang-json npm (https://www.npmjs.com/package/@codemirror/lang-json) — version 6.0.2
- @codemirror/lint npm (https://www.npmjs.com/package/@codemirror/lint) — version 6.9.4, jsonParseLinter

### Secondary (MEDIUM confidence)
- HackMD: CodeMirror 6 reactive Svelte binding (https://hackmd.io/@q/codemirror6) — timing constraints for programmatic updates; undo history preservation warning
- Valence docs: Stop Infinite Loops in Bidirectional Syncs (https://docs.valence.app/en/latest/guides/stop-infinite-loops.html) — confirms direction mutex / hash-based loop prevention patterns

### Tertiary (LOW confidence)
- svelte-codemirror-editor v2.1.0 version confirmation via web search (not verified against npm registry directly) — treat as correct but check version on install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs or README
- Architecture: HIGH — direction mutex, $derived/$effect patterns from Svelte 5 official docs; CM6 dispatch pattern from official reference
- Pitfalls: HIGH — infinite loop pitfall is confirmed pattern from production systems; CM6 history pitfall confirmed from CM6 architecture docs; position preservation is a logical deduction from the CALM spec (no positions in JSON)

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable ecosystem; CM6 and paneforge are not fast-moving)
