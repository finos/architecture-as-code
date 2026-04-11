---
phase: 13-embedding-visualization
plan: "01"
subsystem: web-component
tags: [svelte, vite, elk, web-component, visualization, calm-core, extensions]
dependency_graph:
  requires: []
  provides: [packages/web-component, calm-core/CalmFlow, calm-core/CalmTransition]
  affects: [packages/calm-core/src/types.ts, packages/calm-core/src/index.ts]
tech_stack:
  added:
    - "@calmstudio/diagram package (packages/web-component/)"
    - "Vite library mode build (IIFE + ESM outputs)"
    - "Svelte 5 custom element with shadow DOM"
    - "elkjs 0.11.1 for graph layout"
  patterns:
    - "ELK bundled CJS compat pattern (same as mcp-server render.ts)"
    - "Pack-aware rendering via resolvePackNode()"
    - "TDD: type-check RED → GREEN via TypeScript strict mode"
key_files:
  created:
    - packages/web-component/package.json
    - packages/web-component/tsconfig.json
    - packages/web-component/vite.config.ts
    - packages/web-component/vitest.config.ts
    - packages/web-component/svelte.config.js
    - packages/web-component/src/index.ts
    - packages/web-component/src/types.ts
    - packages/web-component/src/CalmDiagram.svelte
    - packages/web-component/src/render/elkRender.ts
    - packages/web-component/src/render/nodeRenderer.ts
    - packages/web-component/src/render/edgeRenderer.ts
    - packages/web-component/src/render/elkRender.test.ts
  modified:
    - packages/calm-core/src/types.ts (added CalmTransition, CalmFlow, flows field on CalmArchitecture)
    - packages/calm-core/src/types.test.ts (added 4 flow type tests)
    - commitlint.config.cjs (added web-component scope)
    - pnpm-lock.yaml
decisions:
  - "CalmTransition/CalmFlow added directly to types.ts alongside CalmArchitecture for co-location"
  - "Svelte 5 custom element with shadow DOM open mode for CSS isolation"
  - "role=application with tabindex=0 and keyboard handlers for a11y compliance"
  - "Bundle everything (no rollupOptions.external) for zero-dependency CDN use"
  - "vitest config uses customElement: false to avoid jsdom incompatibility with shadow DOM"
metrics:
  duration_seconds: 673
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 4
---

# Phase 13 Plan 01: Calm Diagram Web Component Summary

**One-liner:** Zero-dependency `<calm-diagram>` Svelte 5 custom element with ELK layout, pack-aware SVG rendering, zoom/pan/tooltip, and light/dark theme support.

## What Was Built

The `@calmstudio/diagram` package (`packages/web-component/`) creates a distributable web component that renders any CALM JSON architecture as an interactive SVG diagram. Key deliverables:

- **`dist/calm-diagram.es.js`** (2.6MB) — ESM bundle for npm consumers
- **`dist/calm-diagram.iife.js`** (1.5MB) — CDN-ready zero-dependency IIFE bundle
- **`<calm-diagram>` custom element** with `src`, `data`, `theme`, `flow` attributes
- **ELK layout pipeline** — same proven layered algorithm as mcp-server render.ts
- **Pack-aware rendering** — extension nodes (AWS, K8s, OpenGRIS, etc.) get correct colors from `resolvePackNode()`
- **CalmFlow/CalmTransition types** — added to `@calmstudio/calm-core` for CALM 1.2 flow sequence support

## Tasks

### Task 1: Add flow types to calm-core and scaffold web-component package
- Commit: `9f63416`
- Added `CalmTransition` (relationship-unique-id, sequence-number, summary, direction?) to types.ts
- Added `CalmFlow` (unique-id, name, description, transitions, controls?, metadata?) to types.ts
- Added optional `flows?: CalmFlow[]` field to `CalmArchitecture`
- Scaffolded `packages/web-component/` with full Vite library config
- Both IIFE and ESM bundles produced on first build

### Task 2: Implement ELK SVG renderer with pack support and CalmDiagram custom element
- Commit: `3d66f53`
- `nodeRenderer.ts` — `getNodeStyle()`, `getNodeIcon()`, `renderNodeSvg()` with pack colors/icons
- `edgeRenderer.ts` — `renderEdgeSvg()` with per-relationship-type stroke styles, `renderEdgeMarkers()`
- `elkRender.ts` — full ELK layout + SVG assembly with dark theme support
- `CalmDiagram.svelte` — custom element with zoom/pan/tooltip/theme, keyboard navigation
- 6 tests all passing

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| packages/web-component (elkRender.test.ts) | 6 | PASS |
| packages/calm-core (types.test.ts) | 43 | PASS |
| packages/extensions | 44 | PASS |
| packages/mcp-server | 57 | PASS |
| apps/studio | 409 | PASS |
| packages/vscode-extension | 21 | PASS |
| packages/github-action | 10 | PASS |
| **Total** | **634** | **PASS** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript version 5.9.5 does not exist**
- **Found during:** Task 1 (pnpm install)
- **Issue:** package.json specified `typescript@^5.9.5` but latest is 5.9.3
- **Fix:** Changed to `^5.9.3`
- **Files modified:** packages/web-component/package.json

**2. [Rule 3 - Blocking] `web-component` not in commitlint scope-enum**
- **Found during:** Task 1 commit
- **Issue:** commitlint.config.cjs rejects `(web-component)` scope
- **Fix:** Added `'web-component'` to scope-enum array
- **Files modified:** commitlint.config.cjs

**3. [Rule 2 - A11y] `<div role="img">` with mouse handlers violates Svelte a11y rules**
- **Found during:** Task 2 build
- **Issue:** Non-interactive element with click/pointer handlers fails a11y lint
- **Fix:** Changed to `role="application"` with `tabindex="0"` and keyboard handler for zoom/pan
- **Files modified:** packages/web-component/src/CalmDiagram.svelte

## Self-Check: PASSED

All 14 created/modified files found on disk. Both task commits (`9f63416`, `3d66f53`) verified in git log.
