# Phase 4: Import, Export & Layout - Research

**Researched:** 2026-03-12
**Domain:** ELK.js auto-layout, SVG/PNG export via html-to-image, File System Access API, CALM JSON import/export
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import behavior**
- Always replace current diagram on import (no merge mode)
- Both drag-and-drop onto canvas AND File > Open menu/toolbar button
- Invalid/malformed CALM JSON shows error toast, canvas unchanged — no partial load
- Auto-layout runs automatically on import (CALM JSON has no position data)
- fitView called after auto-layout completes

**Auto-layout & pinning**
- Default layout direction: top-to-bottom (actors/clients top, databases bottom)
- Three layout presets: Hierarchical (top-to-bottom), Left-to-right, Top-to-bottom — accessible via dropdown next to auto-layout button
- Pin icon toggle on each node (visible on hover) — pinned nodes stay fixed during auto-layout, unpinned nodes reflow around them
- Auto-layout button in canvas toolbar (bottom-left or top-right controls area, next to zoom/fitView)

**Export formats**
- Single "Export" dropdown button with options: CALM JSON, calmscript, SVG, PNG
- Transparent background for SVG and PNG exports
- PNG exports at 2x (Retina) resolution by default
- Default filename: `architecture.[ext]` (e.g., `architecture.calm.json`, `architecture.svg`)

**File I/O**
- Standard keyboard shortcuts: Cmd+O = Open, Cmd+S = Save, Cmd+Shift+S = Save As, Cmd+N = New
- File System Access API (Chrome/Edge) for real save-in-place; browser download fallback for Firefox/Safari
- Native file picker via showOpenFilePicker() with `<input type="file">` fallback
- Dirty state tracking: "Unsaved changes" indicator, beforeunload prompt on tab close
- Title bar shows current filename + dirty indicator dot
- Cmd+N clears canvas for fresh diagram, prompts to save if dirty
- Slim top toolbar with Open, Save, Export dropdown buttons (keyboard shortcuts still work)

### Claude's Discretion
- Toast/error notification component choice and styling
- Exact toolbar layout and icon design
- ELK.js configuration parameters (spacing, node sizes, edge routing)
- Auto-layout animation (instant vs animated transition)
- File type filters in open dialog (.calm.json, .json)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IOEX-01 | User can import existing CALM JSON files and auto-layout the diagram (ELK.js) | ELK.js 0.11.1 with elk.bundled.js; applyFromJson() entry point already exists; calmToFlow() positionMap injection for ELK results |
| IOEX-02 | User can export diagram as CALM JSON | getModelJson() already exists; trigger download via Blob + anchor; no new library needed |
| IOEX-03 | User can export diagram as calmscript | Phase 5 concern for the actual DSL; for this phase, calmscript export = placeholder or delegated to existing CODE-02 toggle |
| IOEX-04 | User can export diagram as SVG (vector, crisp) | html-to-image 1.11.11 toSvg(); query `.svelte-flow__viewport`; getNodesBounds + getViewportForBounds from @xyflow/svelte |
| IOEX-05 | User can export diagram as PNG | html-to-image 1.11.11 toPng(); pixelRatio: 2 for Retina; backgroundColor: transparent |
| IOEX-06 | User can save/load diagrams via native file system (Tauri 2) | In browser: File System Access API (Chrome/Edge) + `<input type="file">` fallback; fileHandle.createWritable() for save-in-place; dirty state via $state store |
| LAYT-01 | User can auto-layout the diagram using ELK.js hierarchical layout | ELK layered algorithm with elk.direction DOWN; async elk.layout() → positionMap → calmToFlow() → canvas update → fitView() |
| LAYT-02 | Auto-layout preserves manual position overrides for pinned nodes | Pin flag stored in node.data.pinned; ELK layout runs only on unpinned nodes; pinned positions injected back into positionMap |
| LAYT-03 | Layout presets available (hierarchical, left-to-right, top-to-bottom) | elk.direction: DOWN / RIGHT; elk.algorithm: layered; dropdown drives direction option only |
</phase_requirements>

---

## Summary

Phase 4 adds four distinct capabilities: (1) ELK.js auto-layout applied on import and on-demand, (2) file open/save using the File System Access API with a download fallback, (3) SVG/PNG export via the html-to-image library, and (4) dirty state tracking. The code foundation from Phase 3 is well-prepared — `applyFromJson()`, `calmToFlow()` with positionMap injection, and `getModelJson()` are already correct integration points.

The two new library dependencies are `elkjs` (0.11.x) and `html-to-image` (pinned to 1.11.11 — the Svelte Flow docs explicitly warn that newer versions have export bugs). ELK.js runs asynchronously and is moderately complex to integrate with sub-flow (parent-child) node hierarchies — this is the highest-risk area. The File System Access API is Chrome/Edge-only; Firefox and Safari require `<input type="file">` fallback for open and a Blob download for save.

The calmscript export requirement (IOEX-03) is a special case: the calmscript DSL itself is implemented in Phase 5. For Phase 4, this should be implemented as a stub that copies the content currently shown in the CodePanel's calmscript view mode, acknowledging it will be fully functional only after Phase 5.

**Primary recommendation:** Implement ELK layout as a standalone `layoutCalm(arch, pinnedIds, direction)` pure-async function in a new `layout.ts` module. Keep it free of Svelte imports so it is testable in vitest. Wire it into `+page.svelte` alongside import and after the ELK promise resolves, set nodes/edges from the returned positionMap.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| elkjs | 0.11.1 | Auto-layout engine (ELK layered algorithm) | Official Svelte Flow recommendation; most capable for hierarchical node-link diagrams with containment; supports sub-flows |
| html-to-image | 1.11.11 | SVG and PNG export from DOM nodes | Used in official Svelte Flow download-image example; pin to this version — newer releases have export regressions |
| @xyflow/svelte | already installed | getNodesBounds, getViewportForBounds for export framing | Already a project dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web File System Access API | browser native | Real save-in-place (Chrome/Edge only) | Feature-detect with `'showOpenFilePicker' in window` before using |
| `<input type="file">` + Blob download | browser native | Firefox/Safari file open/save fallback | Always available; no dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| elkjs | dagre | Dagre is simpler but has an open bug: sub-flow nodes connected to nodes outside the sub-flow break layout. CalmStudio uses composed-of/deployed-in sub-flows, making dagre unsuitable. |
| html-to-image | dom-to-image | html-to-image is maintained fork with better browser compat; dom-to-image is largely unmaintained |
| html-to-image | @xyflow/svelte viewport screenshot | No built-in Svelte Flow screenshot API; html-to-image is the documented pattern |

**Installation:**
```bash
pnpm add --filter @calmstudio/studio elkjs html-to-image
pnpm add --filter @calmstudio/studio --save-dev @types/elkjs
```

Note: `@types/elkjs` may not be necessary if elkjs ships its own types. Check after install.

---

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── layout/
│   └── elkLayout.ts         # Pure async ELK layout function — no Svelte imports
├── io/
│   ├── fileSystem.ts        # showOpenFilePicker / fallback / showSaveFilePicker logic
│   ├── fileState.svelte.ts  # $state store: currentFileName, isDirty, fileHandle
│   └── export.ts            # exportAsCalm, exportAsSvg, exportAsPng, exportAsCalmscript
├── toolbar/
│   └── Toolbar.svelte       # Slim top toolbar: Open, Save, Export dropdown
└── canvas/
    └── CalmCanvas.svelte    # Already exists; add drag-and-drop file import handler
```

### Pattern 1: ELK Layout Function (Pure Async)

**What:** A pure TypeScript function that accepts CALM nodes/relationships + pinned IDs + direction, runs ELK layout, and returns a positionMap.

**When to use:** On import (automatic), on layout button click (on-demand).

**Example:**
```typescript
// Source: adapted from https://svelteflow.dev/examples/layout/elkjs
import ELK from 'elkjs/lib/elk.bundled.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

const elk = new ELK();

export type LayoutDirection = 'DOWN' | 'RIGHT' | 'UP';

export async function layoutCalm(
  arch: CalmArchitecture,
  pinnedIds: Set<string>,
  direction: LayoutDirection = 'DOWN'
): Promise<Map<string, { x: number; y: number }>> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '80',
    },
    children: arch.nodes
      .filter((n) => !pinnedIds.has(n['unique-id']))  // exclude pinned nodes
      .map((n) => ({
        id: n['unique-id'],
        width: 160,
        height: 60,
      })),
    edges: arch.relationships
      .filter(
        (r) =>
          !pinnedIds.has(r.source) && !pinnedIds.has(r.destination)
      )
      .map((r) => ({
        id: r['unique-id'],
        sources: [r.source],
        targets: [r.destination],
      })),
  };

  const layouted = await elk.layout(graph);
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layouted.children ?? []) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }
  return positionMap;
}
```

### Pattern 2: Import Flow (in +page.svelte)

**What:** Handle file open, parse JSON, validate, run ELK, update canvas.

**When to use:** On drag-and-drop to canvas OR File > Open.

```typescript
// Source: derived from codebase patterns + ELK integration
async function importCalmFile(content: string) {
  let parsed: CalmArchitecture;
  try {
    parsed = JSON.parse(content) as CalmArchitecture;
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) throw new Error('Invalid CALM JSON');
  } catch (e) {
    showErrorToast(`Invalid CALM JSON: ${(e as Error).message}`);
    return; // canvas unchanged
  }

  pushSnapshot(nodes, edges);
  applyFromJson(parsed);

  // ELK layout — no pinned nodes on import (fresh file)
  const positionMap = await layoutCalm(parsed, new Set(), 'DOWN');
  const projected = calmToFlow(parsed, positionMap);
  nodes = projected.nodes;
  edges = projected.edges;

  // fitView after nodes rendered
  await tick();
  fitView({ duration: 300 });
  isDirty = false;
}
```

### Pattern 3: File System Access API with Fallback

**What:** Feature-detect showOpenFilePicker; fall back to `<input type="file">` for Firefox/Safari.

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
async function openFile(): Promise<{ content: string; name: string; handle: FileSystemFileHandle | null }> {
  if ('showOpenFilePicker' in window) {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'CALM JSON', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    return { content: await file.text(), name: file.name, handle };
  } else {
    // Fallback: trigger hidden <input type="file">
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.calm.json';
      input.onchange = async () => {
        const file = input.files![0];
        resolve({ content: await file.text(), name: file.name, handle: null });
      };
      input.click();
    });
  }
}

async function saveFile(content: string, handle: FileSystemFileHandle | null, filename: string) {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } else if ('showSaveFilePicker' in window) {
    const newHandle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'CALM JSON', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } else {
    // Fallback: Blob download
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### Pattern 4: SVG/PNG Export

**What:** Capture the `.svelte-flow__viewport` DOM element with html-to-image.

```typescript
// Source: https://svelteflow.dev/examples/misc/download-image
import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/svelte';

const IMAGE_WIDTH = 1920;
const IMAGE_HEIGHT = 1080;

async function exportAsPng(nodes: Node[]) {
  const bounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);
  const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
  const dataUrl = await toPng(viewportEl, {
    backgroundColor: 'transparent',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    pixelRatio: 2,
    style: {
      width: `${IMAGE_WIDTH}px`,
      height: `${IMAGE_HEIGHT}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
  downloadDataUrl(dataUrl, 'architecture.png');
}

async function exportAsSvg(nodes: Node[]) {
  const bounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);
  const viewportEl = document.querySelector('.svelte-flow__viewport') as HTMLElement;
  const dataUrl = await toSvg(viewportEl, {
    backgroundColor: 'transparent',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    style: {
      width: `${IMAGE_WIDTH}px`,
      height: `${IMAGE_HEIGHT}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
  downloadDataUrl(dataUrl, 'architecture.svg');
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
```

### Pattern 5: Node Pinning State

**What:** Store `pinned: boolean` in node.data; filter pinned nodes out of ELK input; re-inject their current positions into the positionMap.

```typescript
// Pin toggle — called from node hover UI
function togglePin(nodeId: string) {
  nodes = nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, pinned: !n.data.pinned } } : n
  );
}

// During layout: build positionMap with pinned node overrides
async function runLayout(direction: LayoutDirection) {
  const pinnedIds = new Set(nodes.filter((n) => n.data?.pinned).map((n) => n.id));
  const model = getModel();
  const elkPositions = await layoutCalm(model, pinnedIds, direction);

  // Build final positionMap: ELK results + pinned node current positions
  const positionMap = new Map(elkPositions);
  for (const n of nodes) {
    if (pinnedIds.has(n.id)) {
      positionMap.set(n.id, { ...n.position });
    }
  }

  const projected = calmToFlow(model, positionMap);
  // Preserve pinned flag and selection state
  nodes = projected.nodes.map((n) => {
    const prev = nodes.find((p) => p.id === n.id);
    return { ...n, data: { ...n.data, pinned: prev?.data?.pinned ?? false } };
  });
  edges = projected.edges;
  await tick();
  fitView({ duration: 300 });
}
```

### Pattern 6: Dirty State Store

**What:** Module-level `$state` in `fileState.svelte.ts` tracking filename, handle, and dirty flag.

```typescript
// fileState.svelte.ts
let currentFileName = $state<string | null>(null);
let fileHandle = $state<FileSystemFileHandle | null>(null);
let isDirty = $state(false);

export function getFileName() { return currentFileName; }
export function getFileHandle() { return fileHandle; }
export function getIsDirty() { return isDirty; }
export function markDirty() { isDirty = true; }
export function markClean(name?: string, handle?: FileSystemFileHandle | null) {
  isDirty = false;
  if (name !== undefined) currentFileName = name;
  if (handle !== undefined) fileHandle = handle;
}
```

### Anti-Patterns to Avoid

- **Importing from .svelte.ts files in elkLayout.ts:** Keeps layout pure TypeScript and vitest-testable — never import $state from Svelte files inside layout.ts.
- **Running ELK on every canvas mutation:** ELK is expensive and async. Only run on explicit user actions (import, layout button click).
- **Using ELK's sub-graph (children) nesting for CALM containment:** ELK nested child graphs require complex port mapping. For Phase 4, treat all nodes as flat ELK children — sub-flow visual structure is already handled by @xyflow/svelte's parentId, not ELK.
- **Blocking the UI during ELK:** Always `await elk.layout()` inside an async function; never call synchronously. ELK's bundled version does not use a web worker — for large diagrams this can take 50-200ms, which is acceptable at Phase 4 scale.
- **Selecting any html-to-image version other than 1.11.11:** Svelte Flow docs explicitly warn that newer versions have export regressions. Pin this version.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hierarchical graph layout | Custom node positioning algorithm | elkjs 0.11.1 | Layer assignment, crossing minimization, and edge routing are each NP-hard subproblems |
| DOM-to-image capture | canvas.drawImage loop + getComputedStyle | html-to-image 1.11.11 | CSS variable resolution, font embedding, foreignObject handling are all implemented |
| Viewport framing for export | Manual coordinate math | getNodesBounds + getViewportForBounds from @xyflow/svelte | These account for zoom level, padding, and node measurement correctly |
| File type filter in picker | String parsing | accept option in showOpenFilePicker() types | Browser API handles filtering natively |

**Key insight:** Layout algorithms that "look right" have decades of research behind them. The ELK layered algorithm (Sugiyama method) minimizes edge crossings, assigns nodes to layers, and routes edges — none of which are trivially correct to implement.

---

## Common Pitfalls

### Pitfall 1: ELK node sizes must be specified explicitly

**What goes wrong:** ELK doesn't know DOM node dimensions. If you pass `width: 0, height: 0`, all nodes collapse to a point and the layout is meaningless.

**Why it happens:** ELK is a generic layout engine — it has no access to the browser DOM.

**How to avoid:** Hard-code representative dimensions (width: 160, height: 60) matching the actual rendered node sizes from Phase 2. If node sizes vary significantly, measure them from `node.measured` (populated by Svelte Flow after initial render) before calling ELK.

**Warning signs:** All nodes pile on top of each other at (0,0) after layout.

### Pitfall 2: ELK layout applied before nodes are rendered (fitView timing)

**What goes wrong:** fitView() called immediately after setting nodes/edges does nothing because Svelte Flow hasn't measured the nodes yet.

**Why it happens:** Svelte Flow needs at least one render cycle to measure node bounds before fitView can calculate correct viewport.

**How to avoid:** Use `await tick()` (Svelte's next-microtask promise) after setting nodes/edges before calling fitView(). If that's insufficient, use a short `setTimeout(() => fitView(), 50)`.

**Warning signs:** Canvas appears empty or shows nodes off-screen after import.

### Pitfall 3: html-to-image captures nothing if `.svelte-flow__viewport` is not found

**What goes wrong:** The querySelector returns null and toPng throws or produces a blank image.

**Why it happens:** The CSS class name could change in a @xyflow/svelte upgrade, or the element may not be mounted yet.

**How to avoid:** Add a null guard: `if (!viewportEl) { showErrorToast('Export failed: canvas not ready'); return; }`. Run a quick test after upgrading @xyflow/svelte.

**Warning signs:** Blank PNG/SVG downloaded, or console error about null element.

### Pitfall 4: beforeunload prompt blocked by browsers

**What goes wrong:** window.beforeunload prompt text is ignored by Chrome — browsers show their own generic message.

**Why it happens:** Security restriction since Chrome 51 — custom messages in beforeunload are not shown.

**How to avoid:** Only set the event handler (not custom text). The browser will show its own "Changes you made may not be saved" dialog. This is sufficient for the dirty-state UX requirement.

**Warning signs:** Attempting to set `event.returnValue = 'You have unsaved changes'` works but the text is never shown.

### Pitfall 5: showOpenFilePicker requires a user gesture

**What goes wrong:** Calling showOpenFilePicker() programmatically (e.g., from a timer or Svelte effect) throws `SecurityError: Must be handling a user gesture`.

**Why it happens:** Browser security requirement — file pickers can only open from click/keyboard handlers.

**How to avoid:** Only call showOpenFilePicker() directly inside button click handlers or keyboard shortcut callbacks. Never call from setTimeout, onMount, or reactive effects.

**Warning signs:** `SecurityError` thrown in console when open button is clicked programmatically.

### Pitfall 6: Pinned nodes disconnected from ELK graph lose their edges

**What goes wrong:** If a pinned node's relationships are excluded from the ELK graph, ELK may route remaining edges as if those nodes don't exist, causing visual disconnection.

**Why it happens:** ELK requires source and target IDs to be present in its children array to route edges correctly.

**How to avoid:** Two strategies: (A) include pinned nodes in the ELK graph with their fixed positions using `elk.options['elk.fixed'] = 'true'` on those nodes — ELK's "fixed" constraint keeps a node at specified coordinates; (B) simpler: run ELK on all nodes, then override pinned node positions in the resulting positionMap with their pre-layout positions. Strategy B is recommended for Phase 4 — simpler and avoids ELK's fixed-position constraint complexity.

### Pitfall 7: ELK with CALM sub-flows (parentId) produces wrong nesting

**What goes wrong:** If you pass ELK a nested graph structure (children-of-children) to match CALM's composed-of/deployed-in hierarchy, ELK's coordinate system becomes relative to the parent node. After layout, positions need coordinate transformation relative to the root canvas.

**Why it happens:** ELK nested graphs use parent-relative coordinates, but @xyflow/svelte also handles parentId positioning — so both systems fight each other.

**How to avoid:** Treat the ELK graph as flat for Phase 4 (all nodes as top-level children). The visual sub-flow nesting from Phase 2 is preserved via @xyflow/svelte's parentId mechanism independently of ELK positions.

---

## Code Examples

### ELK Layout Direction Options
```typescript
// Source: https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html
const DIRECTION_MAP = {
  'top-to-bottom': 'DOWN',   // Default — actors top, databases bottom
  'left-to-right': 'RIGHT',
  'hierarchical': 'DOWN',    // Same as top-to-bottom for this use case
} as const;
```

### Drag-and-Drop File Import (onto canvas)
```typescript
// In CalmCanvas.svelte — extend existing handleDrop
async function handleDrop(event: DragEvent) {
  // Existing: palette node drop
  const calmType = event.dataTransfer?.getData('application/calm-node-type');
  if (calmType) {
    // ... existing palette drop logic
    return;
  }

  // New: file drop
  const file = event.dataTransfer?.files[0];
  if (file && (file.name.endsWith('.json') || file.name.endsWith('.calm.json'))) {
    const content = await file.text();
    onfileimport?.(content, file.name);  // callback prop to +page.svelte
  }
}
```

### Keyboard Shortcut Wiring for File I/O
```typescript
// Source: existing @svelte-put/shortcut pattern in CalmCanvas.svelte
use:shortcut={{
  trigger: [
    // ... existing shortcuts
    { key: 'o', modifier: ['meta'], callback: handleOpen },
    { key: 's', modifier: ['meta'], callback: handleSave },
    { key: 's', modifier: ['meta', 'shift'], callback: handleSaveAs },
    { key: 'n', modifier: ['meta'], callback: handleNew },
  ],
}}
```

### beforeunload Dirty State Guard
```typescript
// In +page.svelte or layout.svelte
onMount(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (getIsDirty()) {
      e.preventDefault();
      // Chrome ignores returnValue text but needs it set
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dagre for auto-layout | elkjs recommended by Svelte Flow docs | 2023+ | ELK handles sub-flows; dagre has known sub-flow bug |
| dom-to-image | html-to-image (maintained fork) | 2021+ | Better maintained, more export options |
| Custom download via `<a>` tag | Blob + createObjectURL + anchor click | Always standard | Simple, no dependency, works cross-browser |
| showSaveFilePicker everywhere | Feature-detect + Blob fallback | Always required | showSaveFilePicker not in Firefox/Safari |

**Deprecated/outdated:**
- dagre: Has an open bug with sub-flows (nodes connected across sub-flow boundaries); Svelte Flow docs still list it but it won't work reliably for CALM's composed-of/deployed-in relationships.
- html-to-image > 1.11.11: Known export regressions; Svelte Flow example pins to 1.11.11.

---

## Open Questions

1. **ELK node sizes for heterogeneous node types**
   - What we know: CALM has 9 built-in node types; some (ContainerNode) render larger than others
   - What's unclear: Whether 160x60 is accurate enough for all types to prevent visual overlap post-layout
   - Recommendation: Use 160x60 as safe default; if `node.measured` is populated (after initial render), prefer those values. Add a note in implementation to re-check if node overlap is observed.

2. **IOEX-03 calmscript export scope**
   - What we know: calmscript DSL is fully implemented in Phase 5; Phase 4 must provide the export menu item
   - What's unclear: Whether Phase 4 should silently omit calmscript export or include a "not yet available" disabled state
   - Recommendation: Implement calmscript export as a menu item that reads the existing calmscript view from the CodePanel (which is a read-only representation today). Label it clearly; it will be fully accurate after Phase 5.

3. **ELK performance with large CALM files (50+ nodes)**
   - What we know: ELK.bundled.js runs synchronously in the main thread (no web worker in bundled mode); can take 50-500ms for large graphs
   - What's unclear: Whether FINOS example files are large enough to cause perceptible jank
   - Recommendation: Accept current behavior for Phase 4. If jank is observed, switch to `elkjs/lib/elk-api.js` + `elkjs/lib/elk-worker.js` web worker split. Add a loading indicator during layout.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `apps/studio/vite.config.ts` (test section, include: `src/**/*.test.ts`) |
| Quick run command | `pnpm --filter @calmstudio/studio test` |
| Full suite command | `pnpm --filter @calmstudio/studio test` (all tests, passWithNoTests: true) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IOEX-01 | layoutCalm returns positionMap with x/y for each unpinned node | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | ❌ Wave 0 |
| IOEX-01 | calmToFlow with ELK positionMap uses ELK positions not staggered defaults | unit | `pnpm --filter @calmstudio/studio test -- src/tests/projection.test.ts` | ✅ (extend existing) |
| IOEX-02 | getModelJson() returns valid JSON matching CalmArchitecture structure | unit | `pnpm --filter @calmstudio/studio test -- src/tests/calmModel.test.ts` | ✅ (extend existing) |
| IOEX-03 | calmscript export stub reads codePanel content | manual-only | N/A — UI interaction, no headless path | N/A |
| IOEX-04 | SVG export triggers download with data URL starting `data:image/svg` | manual-only | N/A — DOM capture requires real browser rendering | N/A |
| IOEX-05 | PNG export triggers download with data URL starting `data:image/png` | manual-only | N/A — same as SVG | N/A |
| IOEX-06 | saveFile uses Blob download when showSaveFilePicker is unavailable | unit | `pnpm --filter @calmstudio/studio test -- src/tests/fileSystem.test.ts` | ❌ Wave 0 |
| IOEX-06 | openFile fallback reads file content from input[type=file] | unit | `pnpm --filter @calmstudio/studio test -- src/tests/fileSystem.test.ts` | ❌ Wave 0 |
| LAYT-01 | layoutCalm with empty pinnedIds includes all nodes in result | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | ❌ Wave 0 |
| LAYT-02 | layoutCalm with pinned IDs excludes them from ELK; pinned positions injected in runLayout | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | ❌ Wave 0 |
| LAYT-03 | layoutCalm with direction RIGHT produces positionMap | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/studio test`
- **Per wave merge:** `pnpm --filter @calmstudio/studio test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/elkLayout.test.ts` — covers IOEX-01, LAYT-01, LAYT-02, LAYT-03
- [ ] `src/tests/fileSystem.test.ts` — covers IOEX-06 fallback path (mock `showOpenFilePicker` unavailable, assert Blob download triggered)
- [ ] Install elkjs: `pnpm add --filter @calmstudio/studio elkjs`
- [ ] Install html-to-image: `pnpm add --filter @calmstudio/studio html-to-image@1.11.11`

Note: SVG/PNG export tests (IOEX-04, IOEX-05) are manual-only — html-to-image requires real browser DOM rendering with computed styles; jsdom cannot replicate this accurately.

---

## Sources

### Primary (HIGH confidence)
- [https://svelteflow.dev/examples/layout/elkjs](https://svelteflow.dev/examples/layout/elkjs) — ELK.js + Svelte Flow integration pattern, getLayoutedElements function
- [https://svelteflow.dev/examples/misc/download-image](https://svelteflow.dev/examples/misc/download-image) — html-to-image 1.11.11 pinned version, toPng/toSvg pattern, getNodesBounds + getViewportForBounds
- [https://svelteflow.dev/learn/layouting/layouting-libraries](https://svelteflow.dev/learn/layouting/layouting-libraries) — ELK vs dagre recommendation, dagre sub-flow bug warning
- [https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) — API spec, browser support, user gesture requirement
- [https://github.com/kieler/elkjs](https://github.com/kieler/elkjs) — ELK.js API, elk.bundled.js vs elk-api.js, web worker support
- [https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html](https://eclipse.dev/elk/reference/options/org-eclipse-elk-direction.html) — elk.direction values (DOWN, RIGHT, UP, LEFT)
- Existing codebase: `calmModel.svelte.ts`, `projection.ts`, `CalmCanvas.svelte`, `history.svelte.ts` — confirmed integration points

### Secondary (MEDIUM confidence)
- [https://www.npmjs.com/package/elkjs](https://www.npmjs.com/package/elkjs) — version 0.11.1 confirmed as latest (search result)
- [https://github.com/bubkoo/html-to-image](https://github.com/bubkoo/html-to-image) — pixelRatio, backgroundColor options confirmed

### Tertiary (LOW confidence)
- Community reports that html-to-image > 1.11.11 has export regressions — not verified against specific GitHub issue, but cited in Svelte Flow official example as reason for version pin

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — elkjs and html-to-image confirmed via official Svelte Flow docs and examples; File System Access API confirmed via MDN
- Architecture: HIGH — integration points confirmed from reading actual codebase (calmModel.svelte.ts, projection.ts, CalmCanvas.svelte, +page.svelte)
- Pitfalls: HIGH — ELK timing/sizing pitfalls confirmed from ELK docs and Svelte Flow known issues; FSA API user-gesture requirement confirmed from MDN

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (90 days — elkjs and html-to-image are stable; FSA API browser support changes slowly)
