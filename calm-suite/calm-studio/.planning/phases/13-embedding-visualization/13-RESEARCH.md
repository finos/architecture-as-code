# Phase 13: Embedding & Visualization - Research

**Researched:** 2026-03-23
**Domain:** Web Components (Svelte 5 custom elements, Shadow DOM), SVG path animation, Vite library bundling
**Confidence:** HIGH (stack well-established; architecture patterns verified from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `src` attribute to fetch CALM JSON from URL (`<calm-diagram src="arch.calm.json">`). Also supports `data` attribute for inline JSON embedding.
- Read-only with zoom and pan. No editing. Clicking a node shows a tooltip with its description.
- `theme` attribute for light/dark (`<calm-diagram theme="dark">`). Uses CSS custom properties inside Shadow DOM for host page overrides.
- Bundle all 10 extension packs (AWS, K8s, OpenGRIS, etc.) — any CALM JSON renders correctly with proper icons and colors. Zero config.
- `flow` attribute to activate flow overlay (`<calm-diagram src="arch.json" flow="order-flow">`).
- New package at `packages/web-component/` — separate from the studio app. Follows existing monorepo pattern.
- Published as `@calmstudio/diagram` to npm.
- npm + CDN script tag distribution — unpkg/jsdelivr for zero-build usage, npm import for framework users.
- Shadow DOM for style encapsulation. Expose CSS custom properties for theming.
- Animated dots moving along edges in sequence order. Each edge gets a numbered badge (1, 2, 3...) showing step order.
- Direction-aware: animated dot moves in the direction specified by CALM flow.json `direction` field (source-to-destination or destination-to-source). Arrow markers reinforce direction.
- Tooltip on hover: hovering a sequence badge or animated dot shows the transition `summary` text. No inline labels — keeps canvas clean.
- One flow at a time. Select from a dropdown — only that flow's overlays show.
- Dimming: edges and nodes not part of the active flow get 30% opacity. Focus effect makes the flow path stand out.
- Flows imported from CALM JSON's `flows` array (per flow.json schema). No visual flow editor — flows are authored in JSON or via MCP.
- Flow selector as a toolbar dropdown. Lists all flows by name. "None" option to hide flows.
- Flow overlay works in both CalmStudio editor AND the `<calm-diagram>` web component (via `flow` attribute).

### Claude's Discretion
- Canvas rendering library choice for the web component (Svelte Flow embedded, ELK.js static render, or custom SVG)
- Animation timing and easing for flow dots
- Bundle size optimization strategy (tree-shaking, code splitting)
- Flow overlay color palette (for the dots and badges)
- Auto-layout algorithm for the web component (ELK.js is already in the project)

### Deferred Ideas (OUT OF SCOPE)
- Visual flow builder (click edges to define flows) — future phase
- Multiple simultaneous flow overlays with color coding — future enhancement
- Flow step editing in properties panel — future phase
- Flow export as sequence diagram — separate tool
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WEBC-01 | `<calm-diagram>` web component renders any CALM JSON with a single HTML tag | Svelte 5 `customElement` compiler option + `<svelte:options customElement={{ tag: 'calm-diagram' }}>` + Vite IIFE build |
| WEBC-02 | Web component installable via npm and usable in any framework | `packages/web-component/` package with `main`/`module` exports + IIFE bundle for CDN; follows calm-core npm pattern |
| FLOW-01 | Flow visualization shows data flows as stepped overlays on architecture edges | CALM `flow.json` schema (transitions array), SVG `<animateMotion>` for dots, CSS opacity for dimming, sequence badges as `<foreignObject>` or SVG text, `$derived` reactive store for active flow |
</phase_requirements>

---

## Summary

Phase 13 has two deliverables: the `<calm-diagram>` web component and flow visualization overlays for both the studio and the web component.

**Web Component:** Svelte 5's built-in `customElement` compiler option compiles a `.svelte` file directly to a native Custom Element. With `<svelte:options css="injected" customElement={{ tag: 'calm-diagram' }}>`, all component CSS is inlined into JavaScript (no separate `.css` file) and injected into the Shadow DOM automatically. The big architectural question is rendering: re-embedding `@xyflow/svelte` (SvelteFlow) inside a custom element hits a hard wall — SvelteFlow's base.css is imported as a side-effect at the module level and goes to `document.head`, not the Shadow DOM. The verified alternative is rendering the diagram as a pure ELK.js + SVG pipeline (the same `renderArchitectureToSvg` function already in `packages/mcp-server`), upgraded with extension pack icons and CALM edge types. This approach has no Shadow DOM CSS conflict, produces a static SVG that works identically in all contexts, and keeps the bundle small. ELK.js is already in the project (`elkjs/lib/elk.bundled.js`) and the layout patterns are well-understood from `apps/studio/src/lib/layout/elkLayout.ts`.

**Flow Visualization:** The CALM `flow.json` schema (already in `packages/calm-core/src/schemas/flow.json`) defines flows with an `transitions` array each containing `relationship-unique-id`, `sequence-number`, `summary`, and `direction`. For the studio, flow overlays are Svelte overlay components that sit above existing edge components, using SVG `<animateMotion>` to move a dot along the edge path. The `getSmoothStepPath` path string from `@xyflow/svelte` is already computed by each edge component and can be reused. Dimming non-flow elements is a CSS `opacity: 0.3` applied via `$derived` stores. For the web component, the same overlay logic runs inside the SVG render output.

**Primary recommendation:** Use ELK.js + SVG for the web component (not SvelteFlow embedding), reuse `renderArchitectureToSvg` as the foundation, and implement flow overlays as SVG `<animateMotion>` elements layered over edge paths in both studio and web component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `svelte` | ^5.53.10 | Web component compilation via `customElement` option | Built-in support; `<svelte:options>` compiles to native Custom Element |
| `@sveltejs/vite-plugin-svelte` | ^5.0.0 | Vite plugin for Svelte compilation | Required for `customElement: true` compiler flag per-file |
| `vite` | ^6.4.1 | Library build (IIFE + ESM output) | Already in project; `lib` mode produces CDN-ready bundle |
| `elkjs` | ^0.11.1 | Auto-layout for web component canvas | Already in project; `elk.bundled.js` is browser-safe, no worker needed |
| `@calmstudio/calm-core` | workspace:* | Types, validation, schema | Already in project |
| `@calmstudio/extensions` | workspace:* | All 10 packs (icons, colors, node types) | Already in project; `initAllPacks()` must be called once |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xyflow/svelte` | ^1.5.1 | `getSmoothStepPath` path computation | Studio flow overlay only — import path utility, not rendering |
| `tsup` | ^8.5.1 | Alternative bundler for npm CJS+ESM | If Vite library mode proves awkward for dual-format output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ELK.js SVG render for web component | Embed SvelteFlow in Shadow DOM | SvelteFlow CSS goes to `document.head`, invisible inside Shadow DOM; no supported workaround without forking |
| SVG `<animateMotion>` for dot animation | CSS `offset-path` + Web Animations API | `animateMotion` is native SVG, requires no JS runtime state; both have full browser support (all major browsers since 2020); `animateMotion` is simpler to implement |
| Inline `<style>` injection in web component | `adoptedStyleSheets` | Svelte 5 `css="injected"` handles style injection automatically; `adoptedStyleSheets` is only needed when manually managing external library CSS in Shadow DOM |

**Installation (new package only):**
```bash
# From workspace root
mkdir packages/web-component
cd packages/web-component
pnpm init
# Dependencies added to packages/web-component/package.json
pnpm add --filter @calmstudio/web-component @calmstudio/calm-core @calmstudio/extensions elkjs
pnpm add -D --filter @calmstudio/web-component @sveltejs/vite-plugin-svelte vite svelte typescript
```

---

## Architecture Patterns

### Recommended Project Structure
```
packages/web-component/
├── src/
│   ├── CalmDiagram.svelte      # Root custom element with <svelte:options customElement>
│   ├── render/
│   │   ├── elkRender.ts        # ELK layout + SVG generation (extends mcp-server pattern)
│   │   ├── nodeRenderer.ts     # Node SVG with pack icons + colors
│   │   ├── edgeRenderer.ts     # Edge SVG + flow overlay paths
│   │   └── flowOverlay.ts      # animateMotion + sequence badges
│   ├── types.ts                # CalmDiagramProps, FlowState
│   └── index.ts                # Re-export + initAllPacks() call
├── package.json                # name: "@calmstudio/diagram"
├── vite.config.ts              # lib mode: IIFE + ESM
├── svelte.config.js
└── tsconfig.json
```

**Studio additions (flow visualization):**
```
apps/studio/src/lib/
├── canvas/edges/
│   └── FlowOverlay.svelte      # Animated dot + badge overlay component
├── stores/
│   └── flowState.svelte.ts     # Active flow, selected flow ID, per-edge flow data
└── toolbar/
    └── Toolbar.svelte          # Add flow selector dropdown (follows showScalerTomlExport pattern)
```

### Pattern 1: Svelte Custom Element Declaration
**What:** Compile a Svelte component as a native HTML custom element
**When to use:** This is the ONLY way to build the web component in this project
**Example:**
```svelte
<!-- Source: https://svelte.dev/docs/custom-elements-api -->
<svelte:options
  css="injected"
  customElement={{
    tag: 'calm-diagram',
    shadow: { mode: 'open' },
    props: {
      src: { type: 'String', attribute: 'src' },
      data: { type: 'String', attribute: 'data' },
      theme: { type: 'String', attribute: 'theme', reflect: true },
      flow: { type: 'String', attribute: 'flow' }
    }
  }}
/>

<script lang="ts">
  import { onMount } from 'svelte';
  import { initAllPacks } from '@calmstudio/extensions';
  import { renderELKDiagram } from './render/elkRender.js';

  let { src = '', data = '', theme = 'light', flow = '' } = $props();

  initAllPacks(); // Called once at module load

  let svgContent = $state('');

  $effect(() => {
    // Fetch from src or parse data attribute, then render
  });
</script>

<div class="diagram-host" data-theme={theme}>
  {@html svgContent}
</div>
```

### Pattern 2: Vite Library Mode for IIFE + ESM Output
**What:** Build the web component as both a CDN-ready IIFE bundle and an npm ESM module
**When to use:** Required to satisfy WEBC-02 (npm install + CDN script tag)
**Example:**
```typescript
// packages/web-component/vite.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: { customElement: true }
    })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CalmDiagram',   // Global for IIFE
      formats: ['es', 'iife'],
      fileName: (format) => `calm-diagram.${format}.js`
    },
    rollupOptions: {
      // No externals — bundle everything for zero-dependency CDN use
    }
  }
});
```
CDN usage: `<script src="https://unpkg.com/@calmstudio/diagram/dist/calm-diagram.iife.js"></script>`
npm usage: `import '@calmstudio/diagram';`

### Pattern 3: ELK.js SVG Render with Pack Icons
**What:** Extend the existing `renderArchitectureToSvg` pattern from `packages/mcp-server/src/tools/render.ts` to include extension pack icons/colors
**When to use:** Web component canvas rendering — avoids SvelteFlow Shadow DOM CSS problem entirely
**Example:**
```typescript
// Extends the existing render.ts pattern already in mcp-server
import { getAllPacks, resolvePackNode } from '@calmstudio/extensions';

function getNodeSvgStyle(nodeType: string): { fill: string; stroke: string; icon?: string } {
  if (nodeType.includes(':')) {
    const meta = resolvePackNode(nodeType);
    return {
      fill: meta?.color.background ?? '#f1f5f9',
      stroke: meta?.color.stroke ?? '#94a3b8',
      icon: meta?.icon ?? undefined
    };
  }
  return CORE_NODE_STYLES[nodeType] ?? DEFAULT_STYLE;
}
```

### Pattern 4: Flow Overlay with `<animateMotion>`
**What:** Animate a dot along each active edge path in SVG
**When to use:** Both studio edges (overlaid on SvelteFlow edges) and web component SVG edges
**Example:**
```svelte
<!-- Source: https://reactflow.dev/examples/edges/animating-edges -->
<!-- Adapted for Svelte: dot moves along existing edge path -->
<script lang="ts">
  let { edgePath, sequenceNumber, summary, direction } = $props();
  // direction 'source-to-destination' = forward, 'destination-to-source' = reverse
  const keyPoints = direction === 'destination-to-source' ? '1;0' : '0;1';
</script>

<!-- Animated dot -->
<circle r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5">
  <animateMotion
    dur="1.8s"
    repeatCount="indefinite"
    keyPoints={keyPoints}
    keyTimes="0;1"
    calcMode="linear"
  >
    <mpath href="#{edgePathId}" />
  </animateMotion>
</circle>

<!-- Sequence badge at midpoint -->
<text x={midX} y={midY}
  fill="white" font-size="9" font-weight="bold"
  text-anchor="middle" dominant-baseline="middle">
  {sequenceNumber}
</text>
```

### Pattern 5: Flow State Store (Studio)
**What:** Svelte 5 `$state` store tracking active flow selection
**When to use:** Studio-side flow selector + overlay rendering
**Example:**
```typescript
// apps/studio/src/lib/stores/flowState.svelte.ts
import type { CalmArchitecture } from '@calmstudio/calm-core';

let activeFlowId = $state<string | null>(null);

export function getActiveFlowId(): string | null { return activeFlowId; }
export function setActiveFlowId(id: string | null): void { activeFlowId = id; }

export function getActiveFlowEdgeIds(arch: CalmArchitecture): Set<string> {
  if (!activeFlowId) return new Set();
  const flow = arch.flows?.find(f => f['unique-id'] === activeFlowId);
  return new Set(flow?.transitions.map(t => t['relationship-unique-id']) ?? []);
}
```

### Pattern 6: Toolbar Flow Selector (Studio)
**What:** Add flow selector dropdown following the exact `showScalerTomlExport` conditional prop pattern
**When to use:** Toolbar gets `flows` prop + `onflowchange` callback
**Example:**
```typescript
// Toolbar.svelte props addition — follows existing showScalerTomlExport pattern
flows?: Array<{ id: string; name: string }>;
activeFlowId?: string | null;
onflowchange?: (id: string | null) => void;
```

### Anti-Patterns to Avoid
- **Embedding SvelteFlow inside the web component Shadow DOM:** SvelteFlow imports `@xyflow/svelte/dist/style.css` at module level — that CSS goes to `document.head`, outside the Shadow DOM boundary. The canvas renders blank or broken. Use ELK.js + SVG instead.
- **`new SvelteComponent()` syntax for web component lifecycle:** Svelte 5 components are no longer classes; use `mount()` from `svelte` if needed for non-standard initialization.
- **Deep `$state()` for SVG nodes/edges arrays passed to SvelteFlow:** Already documented in existing canvas — use `$state.raw` for SvelteFlow node/edge arrays to avoid double-render loops. Not applicable to web component (no SvelteFlow there), but critical in studio flow overlay state.
- **Calling `initAllPacks()` multiple times:** The registry is global; calling it twice produces duplicate pack registrations. Call once at module load in each entry point.
- **Animating with SMIL `<animate>` (not `<animateMotion>`):** SMIL `<animate>` is deprecated in modern browsers. Use `<animateMotion>` (which is NOT deprecated) for path-following animation.
- **Computing flow edge midpoints independently of the edge path:** Get the midpoint from the ELK layout result or from `getSmoothStepPath` return values, not by averaging source/target coordinates (paths are not straight lines).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph layout for web component | Custom coordinate calculation | `elkjs/lib/elk.bundled.js` | Already in project; handles containment, spacing, multiple algorithms |
| Node type → icon/color resolution | Custom switch statement | `resolvePackNode()` from `@calmstudio/extensions` | Already handles all 10 packs including opengris; extensible |
| JSON parse + type validation | Custom schema check | `@calmstudio/calm-core` types + AJV (already there) | Already validates CalmArchitecture shape |
| Edge path computation for flow dots (studio) | Trigonometry on source/target coords | `getSmoothStepPath` from `@xyflow/svelte` (already used in every edge component) | Returns cubic bezier path + midpoint coordinates |
| Custom element registration boilerplate | `customElements.define('calm-diagram', class extends HTMLElement {...})` | Svelte 5 `customElement` compiler option | Handles attribute observation, property reflection, lifecycle hooks automatically |
| CSS bundling for CDN | Separate CSS file that consumers must import | Vite `lib` mode + `css="injected"` in `<svelte:options>` | CSS inlined into JS; single script tag is truly zero-config |

**Key insight:** The project already has ELK layout, pack resolution, and SVG rendering. The web component is primarily a packaging exercise around existing capabilities, not a new rendering engine.

---

## Common Pitfalls

### Pitfall 1: SvelteFlow CSS Outside Shadow DOM
**What goes wrong:** Embedding `<SvelteFlow>` inside a Svelte custom element renders the interactive canvas but with no styles — nodes are invisible boxes, edges are unstyled lines. The browser DevTools show SvelteFlow's CSS in `document.head` but none inside the shadow root.
**Why it happens:** `@xyflow/svelte` imports its base CSS as a module-level side effect (`import '@xyflow/svelte/dist/style.css'`). Vite/Svelte inject this into `document.head`, which has no visibility into a Shadow DOM. Svelte's `css="injected"` only handles the component's own `<style>` blocks, not imported CSS files.
**How to avoid:** Do NOT use SvelteFlow inside the web component. Use ELK.js + custom SVG rendering instead. SvelteFlow remains only in the studio app (which runs in light DOM where `document.head` CSS works normally).
**Warning signs:** If you see the canvas container but blank/unstyled nodes in the web component, this is the cause.

### Pitfall 2: `src` Attribute Fetch and CORS
**What goes wrong:** `<calm-diagram src="https://other-domain.com/arch.json">` fails with a CORS error silently or shows a blank canvas.
**Why it happens:** `fetch()` from a web component respects the same CORS policy as any browser fetch. Cross-origin JSON files need `Access-Control-Allow-Origin` headers.
**How to avoid:** Document this limitation clearly. Fetch with `{ credentials: 'omit' }` as default. Provide the `data` attribute as the fallback for inline JSON that avoids fetch entirely.
**Warning signs:** Empty canvas, no error shown to user.

### Pitfall 3: ELK Web Worker in Browser (IIFE Bundle)
**What goes wrong:** The IIFE bundle for CDN use throws a `Worker is not defined` or similar error when ELK tries to spawn a web worker.
**Why it happens:** `elkjs` (not `elk.bundled.js`) uses a worker for layout. `elk.bundled.js` is the browser-safe variant that handles layout synchronously (or in an inline worker). The mcp-server already uses `elk.bundled.js` for this reason.
**How to avoid:** Always import `elkjs/lib/elk.bundled.js`, never `elkjs` directly, in browser-targeted code. Confirmed pattern in `packages/mcp-server/src/tools/render.ts` line 10.
**Warning signs:** `ReferenceError: Worker is not defined` in browser console when loading the CDN script.

### Pitfall 4: `initAllPacks()` Race with `resolvePackNode()`
**What goes wrong:** Extension nodes render as `generic` (grey boxes) instead of their pack-defined icons and colors.
**Why it happens:** `resolvePackNode()` looks up the global registry, which is empty until `initAllPacks()` is called. If the render path is called before the packs are registered, all custom types fall back to the default.
**How to avoid:** Call `initAllPacks()` at the top of `packages/web-component/src/index.ts` (module load time, before any render is triggered). Pattern mirrors `+page.svelte` line 13: `initAllPacks()` called before component renders.
**Warning signs:** All extension-pack nodes appear as grey generic boxes.

### Pitfall 5: Flow `direction` Reversal on Edge
**What goes wrong:** The animated dot moves right-to-left on an edge that visually goes left-to-right, or vice versa, because the CALM flow `direction` field is not applied to the animation.
**Why it happens:** `@xyflow/svelte` edge components use `sourceX/sourceY` → `targetX/targetY` for path direction. The CALM relationship has a `source` and `destination`. But a flow transition may specify `direction: "destination-to-source"` meaning the data actually flows backward along the drawn edge.
**How to avoid:** When `direction === 'destination-to-source'`, reverse the `<animateMotion>` by setting `keyPoints="1;0"` and `keyTimes="0;1"`. This is supported natively in `<animateMotion>`.
**Warning signs:** Dot animation visually contradicts the flow direction shown by arrow markers.

### Pitfall 6: Opacity Dimming Affects Animated Dot
**What goes wrong:** The flow overlay dot is also dimmed because the parent edge element has `opacity: 0.3`.
**Why it happens:** CSS `opacity` is inherited by all descendants including SVG children.
**How to avoid:** Render the flow overlay (dot + badge) in a sibling SVG layer above the dimmed edge layer, not as a child of the edge element. In the studio this means a separate `<FlowOverlay>` component rendered after all edges in the canvas, positioned absolutely over the canvas. In the web component, render overlay elements after all edge paths in the SVG.
**Warning signs:** Flow dots appear faded/translucent on active flow edges.

### Pitfall 7: CalmArchitecture `flows` Field Not in Current Type
**What goes wrong:** TypeScript errors when accessing `arch.flows` — the field doesn't exist on `CalmArchitecture` type.
**Why it happens:** `CalmArchitecture` in `packages/calm-core` may not yet include the `flows` field from the flow.json schema. The flow.json schema exists but may not be reflected in the TypeScript type definition.
**How to avoid:** Check `CalmArchitecture` type definition before implementing. May need to add `flows?: CalmFlow[]` to the type and export a `CalmFlow` / `CalmTransition` type from `calm-core`.
**Warning signs:** TypeScript error `Property 'flows' does not exist on type 'CalmArchitecture'`.

---

## Code Examples

Verified patterns from existing codebase:

### ELK Bundled Import (browser-safe, from mcp-server)
```typescript
// Source: packages/mcp-server/src/tools/render.ts line 10
import ELKImport from 'elkjs/lib/elk.bundled.js';
const ELK = (ELKImport as unknown as { default?: new () => ... }).default ?? ELKImport;
const elk = new ELK();
const layouted = await elk.layout(graph);
```

### Pack Node Resolution (from studio canvas)
```typescript
// Source: apps/studio/src/lib/canvas/nodes/ExtensionNode.svelte
import { resolvePackNode } from '@calmstudio/extensions';
const meta = resolvePackNode(calmType);  // { color: { background, stroke }, icon: '<svg>...' }
const scaledIcon = meta?.icon.replace(/width="16" height="16"/, 'width="40" height="40"');
```

### Edge Path Computation (from ConnectsEdge.svelte)
```typescript
// Source: apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte
import { getSmoothStepPath } from '@xyflow/svelte';
const [edgePath, labelX, labelY] = getSmoothStepPath({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition
});
// edgePath is an SVG path string — can be used directly in <animateMotion mpath>
```

### CALM Flow Schema (from calm-core)
```json
// Source: packages/calm-core/src/schemas/flow.json
{
  "transition": {
    "relationship-unique-id": "string",
    "sequence-number": "integer",
    "summary": "string",
    "direction": "source-to-destination" | "destination-to-source"
  },
  "flow": {
    "unique-id": "string",
    "name": "string",
    "description": "string",
    "transitions": [transition, ...]  // minItems: 1
  }
}
```

### Conditional Toolbar Prop Pattern (from Toolbar.svelte + page.svelte)
```svelte
<!-- Source: apps/studio/src/routes/+page.svelte (showScalerTomlExport pattern) -->
<!-- $derived rune ensures reactive re-evaluation when nodes change -->
const showScalerTomlExport = $derived(
  getModel().nodes.some(n => n['node-type'].startsWith('opengris:'))
);
<!-- Same pattern for flows: show selector only when arch has flows -->
const flows = $derived(getModel().flows ?? []);
```

### Svelte Custom Element Declaration (from official docs)
```svelte
<!-- Source: https://svelte.dev/docs/custom-elements-api -->
<svelte:options
  css="injected"
  customElement={{
    tag: 'calm-diagram',
    shadow: { mode: 'open' },
    props: {
      src:   { type: 'String', attribute: 'src' },
      data:  { type: 'String', attribute: 'data' },
      theme: { type: 'String', attribute: 'theme', reflect: true },
      flow:  { type: 'String', attribute: 'flow' }
    }
  }}
/>
```

### Vite Library Mode for Custom Element
```typescript
// packages/web-component/vite.config.ts pattern
// Source: https://vite.dev/config/build-options (lib mode docs)
export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: true } })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CalmDiagram',
      formats: ['es', 'iife'],
      fileName: (format) => `calm-diagram.${format}.js`
    }
    // No rollupOptions.external — bundle everything for CDN use
  }
});
```

### SVG animateMotion for Direction-Aware Dot
```svelte
<!-- Source: https://reactflow.dev/examples/edges/animating-edges (adapted) -->
<!-- MDN: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/animateMotion -->
<circle r="5" fill="var(--flow-dot-color, #3b82f6)" stroke="white" stroke-width="1.5">
  <animateMotion
    dur="1.8s"
    repeatCount="indefinite"
    keyPoints={direction === 'destination-to-source' ? '1;0' : '0;1'}
    keyTimes="0;1"
    calcMode="linear"
  >
    <mpath href="#{edgePathElementId}" />
  </animateMotion>
</circle>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SMIL `<animate>` for SVG animation | SVG `<animateMotion>` (non-deprecated) or CSS `offset-path` | Chrome removed SMIL intent reversed ~2017, but animateMotion was always separate | Use `<animateMotion>` — it is specifically NOT deprecated unlike other SMIL |
| `new SvelteComponent()` class syntax | `mount()` function from `svelte` | Svelte 5 | Components are no longer classes; use mount for programmatic mounting |
| Svelte `customElement: true` globally in SvelteKit | Per-file `<svelte:options customElement>` + separate Vite config | Svelte 4+ | SvelteKit apps can't have global customElement:true; use separate package |
| CSS-only theming via host page stylesheets | CSS custom properties (variables) that pierce Shadow DOM | Current best practice | `--calm-bg`, `--calm-accent` etc. declared on `:host` and overridable by host page |

**Deprecated/outdated:**
- SMIL `<animate>` / `<animateColor>` / `<animateTransform>`: Deprecated. `<animateMotion>` is the safe exception — it is NOT deprecated.
- `new Component()` Svelte syntax: Replaced by `mount()` in Svelte 5.
- ELK Worker API (non-bundled): Not for browser use; always use `elk.bundled.js`.

---

## Open Questions

1. **Does `CalmArchitecture` type include `flows`?**
   - What we know: `flow.json` schema exists in `packages/calm-core/src/schemas/flow.json`
   - What's unclear: Whether `CalmArchitecture` TypeScript type in `packages/calm-core/src/types.ts` (or similar) has a `flows?: CalmFlow[]` field
   - Recommendation: Wave 0 task must inspect the type and add `flows?: CalmFlow[]` if missing, plus export `CalmFlow` / `CalmTransition` types

2. **Flow animation performance with many edges**
   - What we know: `<animateMotion>` is GPU-accelerated in modern browsers; CSS `opacity` transitions are also GPU-accelerated
   - What's unclear: Whether 10+ simultaneous animated dots causes jank on lower-end hardware
   - Recommendation: Limit to 1 active flow at a time (already decided); dots only appear on active flow edges (not all edges). Should be fine.

3. **Web component zoom/pan interaction**
   - What we know: The web component uses ELK.js + SVG (no SvelteFlow); zoom/pan must be implemented
   - What's unclear: Whether to use the browser-native `<svg viewBox>` + pan/zoom via mouse events, or a lightweight library
   - Recommendation: Use `<svg>` with pointer events for drag-to-pan and wheel-to-zoom; the SVG `viewBox` attribute handles the math. A ~50-line implementation is sufficient and keeps bundle size small.

4. **pnpm workspace entry for new package**
   - What we know: `pnpm-workspace.yaml` contains `packages:` (truncated in file read)
   - What's unclear: Whether it uses `packages/*` glob (likely) so new `packages/web-component/` is auto-included
   - Recommendation: Verify the glob pattern; likely no change needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.x (per extensions package) or ^4.x (per latest extensions devDeps) |
| Config file | `packages/web-component/vitest.config.ts` — Wave 0 gap |
| Quick run command | `pnpm --filter @calmstudio/web-component test` |
| Full suite command | `pnpm test` (workspace-wide) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEBC-01 | `renderELKDiagram()` returns valid SVG for a CALM architecture with extension pack nodes | unit | `pnpm --filter @calmstudio/web-component test -- src/render/elkRender.test.ts` | ❌ Wave 0 |
| WEBC-01 | `<calm-diagram>` custom element tag is defined in `customElements` registry after import | unit (jsdom) | `pnpm --filter @calmstudio/web-component test -- src/CalmDiagram.test.ts` | ❌ Wave 0 |
| WEBC-02 | Vite build produces `calm-diagram.iife.js` and `calm-diagram.es.js` | smoke (build output check) | `pnpm --filter @calmstudio/web-component build && ls dist/calm-diagram.*.js` | ❌ Wave 0 |
| FLOW-01 | `getActiveFlowEdgeIds()` returns correct Set of edge IDs for a given flow | unit | `pnpm --filter @calmstudio/studio test -- src/lib/stores/flowState.svelte.test.ts` | ❌ Wave 0 |
| FLOW-01 | `CalmArchitecture` type accepts `flows` field without TypeScript error | type-check | `pnpm --filter @calmstudio/calm-core typecheck` | depends on type gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/web-component test` (new package) or `pnpm --filter @calmstudio/studio test` (flow store)
- **Per wave merge:** `pnpm test` (full workspace)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/web-component/vitest.config.ts` — test config for new package
- [ ] `packages/web-component/src/render/elkRender.test.ts` — covers WEBC-01
- [ ] `packages/web-component/src/CalmDiagram.test.ts` — custom element registration covers WEBC-01
- [ ] `apps/studio/src/lib/stores/flowState.svelte.test.ts` — covers FLOW-01
- [ ] Possibly `packages/calm-core` type update — `flows?: CalmFlow[]` on `CalmArchitecture`

---

## Sources

### Primary (HIGH confidence)
- Svelte docs (https://svelte.dev/docs/custom-elements-api) — `customElement` API, Shadow DOM config, `css="injected"`, props config
- `packages/mcp-server/src/tools/render.ts` — existing ELK.js SVG render pattern (verified from codebase)
- `packages/calm-core/src/schemas/flow.json` — CALM flow schema (verified from codebase)
- `apps/studio/src/lib/canvas/edges/ConnectsEdge.svelte` — `getSmoothStepPath` usage (verified from codebase)
- `apps/studio/src/lib/layout/elkLayout.ts` — ELK layout patterns (verified from codebase)
- `apps/studio/src/routes/+page.svelte` — `showScalerTomlExport` conditional prop pattern (verified from codebase)
- Vite docs (https://vite.dev/config/build-options) — library mode IIFE/ESM output
- MDN (https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/animateMotion) — animateMotion element (not deprecated)

### Secondary (MEDIUM confidence)
- React Flow animated edges example (https://reactflow.dev/examples/edges/animating-edges) — `<animateMotion>` + `keyPoints` direction reversal technique; verified by reading official XYFlow docs
- Svelte GitHub issue #10837 (adoptedStyleSheets discussion) — confirms Svelte appends styles to `document.head`, not shadow root; explains why SvelteFlow CSS fails in Shadow DOM
- Vite lib mode discussion (https://github.com/vitejs/vite/issues/1579) — CSS injection in iife/umd mode is automatic in current Vite versions

### Tertiary (LOW confidence)
- Mainmatter blog (https://mainmatter.com/blog/2025/06/25/web-components-with-svelte/) — confirms `css="injected"` approach, but date is June 2025 (future from research date; treat as directionally correct but verify)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already in project; Svelte custom element docs are authoritative
- Architecture (web component): HIGH — ELK.js SVG path is proven in mcp-server; Shadow DOM CSS limitation is verified
- Architecture (flow overlay): HIGH — animateMotion technique is standard; flow schema is in codebase
- Pitfalls: HIGH for items 1-4 (verified from codebase patterns); MEDIUM for items 5-7 (derived from schema/type analysis)

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (90 days — Svelte 5 and Vite are stable; low churn risk)
