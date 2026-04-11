---
phase: 13-embedding-visualization
verified: 2026-03-24T00:00:00Z
status: gaps_found
score: 8/10 must-haves verified
gaps:
  - truth: "A developer can install @calmstudio/diagram via npm and import it in any framework"
    status: failed
    reason: "packages/web-component/package.json has \"private\": true, which prevents npm publish. WEBC-02 and ROADMAP Success Criterion #2 require the package to be installable via npm."
    artifacts:
      - path: "packages/web-component/package.json"
        issue: "\"private\": true blocks npm publish; package cannot be installed from the npm registry"
    missing:
      - "Set \"private\": false in packages/web-component/package.json to unblock npm publish"
      - "Confirm version strategy (0.0.0 is a development placeholder — bump to 0.1.0 or 1.0.0 before publish)"
  - truth: "CalmFlow and CalmTransition types are exported from @calmstudio/calm-core (runtime value accessible)"
    status: partial
    reason: "CalmFlow and CalmTransition are TypeScript interfaces (type-only), not runtime values. They are correctly present in dist/index.d.ts declarations and exported as type exports. This is technically correct but the PLAN's 13-01 success criteria said 'CalmFlow and CalmTransition types are exported from @calmstudio/calm-core' — this is satisfied via the type declarations only. Marking partial because consumers relying on runtime reflection (e.g. JSON schema generation) would not find them. Pure TypeScript consumers are fine."
    artifacts:
      - path: "packages/calm-core/dist/index.d.ts"
        issue: "CalmFlow and CalmTransition are present as TypeScript type exports only — correct for interfaces, but not runtime values. This is expected behavior, not a bug."
    missing:
      - "No action needed if consumers are TypeScript-only. Document that these are type-only exports."
human_verification:
  - test: "Open packages/web-component/test.html in a browser after running pnpm --filter @calmstudio/diagram build"
    expected: "Two side-by-side calm-diagram instances render: (1) light theme with pack-colored nodes and zoom/pan working, (2) dark theme with flow='auth-flow' showing animated blue dots on flow edges, numbered sequence badges, and non-flow elements dimmed to ~30% opacity"
    why_human: "SVG animation (animateMotion), visual rendering quality, zoom/pan feel, and tooltip behavior on click/hover cannot be verified programmatically"
  - test: "Load a CALM JSON with a 'flows' array into the studio app (apps/studio)"
    expected: "Flow selector dropdown appears in the toolbar center. Selecting a flow causes animated dots to move along flow edges with numbered badges. Non-flow edges dim. Selecting 'None' restores full opacity."
    why_human: "SvelteFlow animation behavior, dropdown positioning, and opacity transitions require visual confirmation"
---

# Phase 13: Embedding & Visualization Verification Report

**Phase Goal:** Any developer can embed a CALM diagram in a webpage with a single HTML tag, and architects can visualize data flows as animated overlays on canvas edges
**Verified:** 2026-03-24T00:00:00Z
**Status:** gaps_found (1 blocker, 1 informational)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Developer adds `<calm-diagram src="arch.calm.json">` to any HTML page and sees a rendered diagram without build tools | VERIFIED | CalmDiagram.svelte registers `calm-diagram` custom element via `customElement` option; IIFE bundle (1.5MB) in dist/; fetch+render pipeline implemented with error/loading states |
| 2 | Developer can install @calmstudio/diagram via npm and import in any framework | FAILED | `packages/web-component/package.json` has `"private": true` — blocks npm publish; ESM bundle exists and is correct but cannot be registry-installed |
| 3 | Extension pack nodes (AWS, K8s, OpenGRIS, etc.) render with correct icons and colors | VERIFIED | `nodeRenderer.ts` calls `resolvePackNode()` for colon-prefixed types; `initAllPacks()` called at module load in `index.ts`; elkRender.test.ts Test 1 asserts AWS pack color `#fff3e0` |
| 4 | Web component supports light and dark themes via theme attribute | VERIFIED | `theme` prop on `<calm-diagram>` wired through to `renderELKDiagram({ theme })`; dark theme adjusts bgColor and edgeColor; `:host([theme="dark"])` CSS custom properties present |
| 5 | User can zoom and pan the diagram inside the web component | VERIFIED | `onWheel` (scale), `onPointerDown/Move/Up` (translate), keyboard ArrowKey/+/- handlers all implemented in `CalmDiagram.svelte`; transform applied via CSS |
| 6 | Clicking a node shows a tooltip with its description | VERIFIED | `onClick` handler reads `data-node-id` + `data-description` from SVG group; tooltip `$state` renders as fixed `<div>` with text |
| 7 | Architect selects a flow from toolbar dropdown and sees animated dots on flow edges | VERIFIED | `flows` derived from `getModel().flows` in `+page.svelte`; passed to Toolbar; `onflowchange={setActiveFlowId}` wired; `$effect` injects `flowTransition` into edges[]; all 5 edge types render `<FlowOverlay>` conditionally |
| 8 | Edges/nodes not in active flow are dimmed to 30% opacity | VERIFIED | Edge dimming: `<g style="opacity: 0.3">` wraps BaseEdge when `data.dimmed === true`; Node dimming: `$effect` in +page.svelte injects `opacity: 0.3` style; `isNodeInActiveFlow()` determines membership |
| 9 | Each flow edge displays a numbered badge showing sequence order | VERIFIED | `FlowOverlay.svelte` renders sequence number badge at `(labelX, labelY)`; `flowOverlay.ts` renders sequence badge for web component SVG path; flowOverlay.test.ts Tests 4+7 assert badge numbers |
| 10 | Selecting 'None' in flow dropdown restores full opacity | VERIFIED | `onflowchange` calls `setActiveFlowId(null)`; `$effect` branch for `!currentActiveFlowId` strips `flowTransition`/`dimmed` from edges and `opacity: 0.3` from node styles |

**Score:** 9/10 truths verified (1 failed: npm installability; 1 partial: type-only export is informational)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/web-component/src/render/elkRender.ts` | ELK layout + SVG generation with pack support, exports `renderELKDiagram` | VERIFIED | 243 lines, exports `renderELKDiagram(arch, options)` and `RenderOptions`; integrates `renderFlowOverlay`/`applyFlowDimming`/`getFlowNodeIds`; full ELK pipeline |
| `packages/web-component/src/CalmDiagram.svelte` | Custom element with src/data/theme/flow attributes | VERIFIED | `customElement` option set with `tag: 'calm-diagram'`, shadow DOM open; all 4 props declared; `$effect` load/render pipeline; zoom/pan/tooltip state |
| `packages/web-component/dist/calm-diagram.iife.js` | CDN-ready zero-dependency bundle | VERIFIED | Exists at 1.5MB |
| `packages/web-component/dist/calm-diagram.es.js` | ESM bundle for npm consumers | VERIFIED | Exists at 2.5MB |
| `packages/calm-core/src/types.ts` | CalmFlow and CalmTransition types on CalmArchitecture | VERIFIED | `CalmTransition` (lines 133-142), `CalmFlow` (lines 148-156), `flows?: CalmFlow[]` on `CalmArchitecture` (line 167) |
| `apps/studio/src/lib/stores/flowState.svelte.ts` | Active flow state management | VERIFIED | Exports `getActiveFlowId`, `setActiveFlowId`, `getActiveFlowEdgeIds`, `getFlowTransitionForEdge`, `isNodeInActiveFlow`; module-level `$state` |
| `apps/studio/src/lib/canvas/edges/FlowOverlay.svelte` | Animated dot + sequence badge overlay | VERIFIED | 135 lines; `animateMotion` with `mpath` href; direction-aware `keyPoints`; foreignObject tooltip on badge hover |
| `apps/studio/src/lib/toolbar/Toolbar.svelte` | Flow selector dropdown in toolbar | VERIFIED | `flows`, `activeFlowId`, `onflowchange` props added; `{#if flows.length > 0}` renders `<select>` with "None" option |
| `packages/web-component/src/render/flowOverlay.ts` | SVG flow overlay rendering | VERIFIED | Exports `renderFlowOverlay`, `applyFlowDimming`, `getFlowNodeIds`, `EdgeLayout`; full implementation |
| `packages/web-component/src/render/flowOverlay.test.ts` | Tests for flow overlay SVG generation | VERIFIED | 11 tests covering all 7 behavioral specs from plan; direction reversal, dimming, multi-edge, node IDs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CalmDiagram.svelte` | `elkRender.ts` | `import renderELKDiagram` + call with `{ theme, flow }` | WIRED | Line 15 import; line 69 call `renderELKDiagram(arch, { theme: currentTheme, flow: currentFlow \|\| undefined })` |
| `elkRender.ts` | `@calmstudio/extensions` | `resolvePackNode` via `nodeRenderer.ts` | WIRED | `nodeRenderer.ts` imports `resolvePackNode`; called in `getNodeStyle()` and `getNodeIcon()` for all colon-prefixed types |
| `packages/web-component/src/index.ts` | `@calmstudio/extensions` | `initAllPacks()` at module load | WIRED | Line 5-8: `import { initAllPacks } from '@calmstudio/extensions'; initAllPacks();` |
| `+page.svelte` | `flowState.svelte.ts` | `$derived` reactive flows from `getModel().flows` | WIRED | Lines 847-855: derived `flows`, `activeFlowId`, `activeFlowEdgeIds` from store functions; line 848: `getModel().flows` |
| `ConnectsEdge.svelte` | `FlowOverlay.svelte` | Conditional render when edge in active flow | WIRED | Line 12: `import FlowOverlay`; line 65-73: `{#if flowTransition}<FlowOverlay .../>` |
| `Toolbar.svelte` | `flowState.svelte.ts` | `onflowchange` callback sets active flow ID | WIRED | +page.svelte line 1081: `onflowchange={setActiveFlowId}`; Toolbar calls `onflowchange?.(val \|\| null)` on select change |
| `elkRender.ts` | `flowOverlay.ts` | `import renderFlowOverlay + applyFlowDimming` | WIRED | Line 12: imports `renderFlowOverlay`, `applyFlowDimming`, `getFlowNodeIds`, `EdgeLayout`; lines 182, 237 call sites |
| `CalmDiagram.svelte` | `elkRender.ts` | `flow` prop passed through to `renderELKDiagram` | WIRED | Line 69: `flow: currentFlow \|\| undefined` in options object |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WEBC-01 | 13-01-PLAN.md | `<calm-diagram>` web component renders any CALM JSON with a single HTML tag | SATISFIED | Custom element registered; IIFE bundle in dist/; fetch + ELK render pipeline complete |
| WEBC-02 | 13-01-PLAN.md | Web component installable via npm and usable in any framework | BLOCKED | `"private": true` in package.json prevents npm publish. ESM/IIFE bundles are built and correct, but registry install is not possible until `private` flag is removed |
| FLOW-01 | 13-02-PLAN.md, 13-03-PLAN.md | Flow visualization shows data flows as stepped overlays on architecture edges | SATISFIED | Studio: FlowOverlay.svelte + flowState store + 5 edge types wired + toolbar selector; Web component: flowOverlay.ts + elkRender.ts integration; animated dots + sequence badges + dimming all verified |

### Anti-Patterns Found

No anti-patterns detected in key phase files (no TODO/FIXME/placeholder comments, no stub implementations, no empty return values).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/web-component/package.json` | 4 | `"private": true` | Warning | Prevents `npm publish`; blocks WEBC-02 installability claim |

### Human Verification Required

#### 1. Web Component Visual Rendering

**Test:** Build the web component (`pnpm --filter @calmstudio/diagram build`) then open `packages/web-component/test.html` in a browser.
**Expected:** Two `<calm-diagram>` instances render side-by-side. Left: light theme with pack-colored nodes (distinct colors for AWS vs core types), visible edges, zoom on scroll, pan on drag, click shows node description tooltip. Right: dark theme with `flow="auth-flow"`, animated blue dots travel along flow edges, numbered circle badges at midpoints, non-flow elements visibly dimmed.
**Why human:** CSS animation (animateMotion), visual color correctness, interactive behaviors (scroll, drag, click) and tooltip appearance all require visual confirmation.

#### 2. Studio Flow Selector End-to-End

**Test:** Run `pnpm dev` in `apps/studio`, load any CALM JSON that contains a `flows` array (or use the test.html example data).
**Expected:** "Flow:" dropdown appears in the toolbar center between the filename and right buttons. Selecting a flow shows animated blue dots on flow edges with sequence number badges. Non-flow edges/nodes dim to ~30% opacity. Selecting "None" from the dropdown restores full canvas opacity.
**Why human:** SvelteFlow edge rendering, CSS opacity transitions, and dropdown positioning require visual confirmation in the running app.

### Gaps Summary

**1 blocking gap** prevents full phase goal achievement:

**WEBC-02 — npm installability blocked by `"private": true`**

The `packages/web-component/package.json` has `"private": true`, which prevents `npm publish` from being run. ROADMAP Success Criterion #2 explicitly requires "A developer can install the web component via npm." The package is functionally complete — ESM and IIFE bundles build correctly, the custom element works, and the package is usable within the monorepo — but it cannot be published to the npm registry in its current state. The fix is a one-line change: set `"private": false` and confirm the publish strategy.

**Informational note (not blocking):**

`CalmFlow` and `CalmTransition` are TypeScript interfaces and therefore appear as type-only exports in `dist/index.d.ts`. They are correctly exported and usable by all TypeScript consumers. The plan success criterion "CalmFlow and CalmTransition types are exported from @calmstudio/calm-core" is fully satisfied for TypeScript usage. This is not a gap.

---

_Verified: 2026-03-24T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
