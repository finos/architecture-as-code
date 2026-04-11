# Phase 2: CALM Canvas Core - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Typed drag-and-drop canvas with all 9 CALM node types, 5 relationship types, containment via Svelte Flow sub-flows, and professional diagramming UX (select, multi-select, move, resize, delete, undo/redo, zoom, pan, search, dark mode, keyboard shortcuts, copy/paste). Properties panel and bidirectional sync are Phase 3. Import/export is Phase 4. Extension packs are Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Node visual design
- Distinct shapes per CALM node type — each of the 9 types gets a unique shape (e.g., actor=person, database=cylinder, service=rounded rect, network=cloud)
- Monochrome color scheme — shape alone differentiates types, no per-type coloring
- Each node displays its name + a small type icon by default (no description on canvas)
- Custom node types (any string not in the 9 built-in types): Claude's discretion on rendering

### Palette & node creation
- Left sidebar panel, always visible, with search at the top
- Palette items show labeled entries with shape preview (mini shape icon + type name)
- Node placement supports both drag-and-drop AND click-to-place
- Palette includes the 9 core CALM types plus a "Custom..." entry for arbitrary type strings

### Containment rendering
- Containment (deployed-in, composed-of) renders as labeled boundary boxes — parent node becomes a larger box with name as header, children positioned inside
- Containers are collapsible — click toggle to collapse into compact node, expand to reveal children
- Containment creation supports both methods: drag a node into a container AND draw a deployed-in/composed-of edge (both create the parent-child relationship)
- Visual differentiation between deployed-in and composed-of containers: Claude's discretion

### Edge styles & labels
- 5 relationship types distinguished by line style variation:
  - connects: solid line + filled arrow
  - interacts: dashed line + filled arrow
  - deployed-in: solid line + diamond
  - composed-of: dashed line + filled diamond
  - options: dotted line + open arrow
- Protocol labels (HTTPS, JDBC, gRPC, etc.) display as inline text on connects edges, centered on the line
- Edge creation supports both handle-to-handle drag AND multi-select nodes + menu
- New edges default to 'connects' type — change via right-click or properties panel (Phase 3)

### Claude's Discretion
- Custom node type visual rendering
- Visual differentiation between deployed-in and composed-of container styles
- Dark mode implementation details
- Keyboard shortcut specifics beyond Cmd+Z / Cmd+Shift+Z / Delete
- Search/filter UI details
- Node resize handle style
- Selection highlight style (box select vs shift-click behavior)
- Exact spacing, typography, and sizing

</decisions>

<specifics>
## Specific Ideas

- Node shapes should be instantly recognizable like AWS architecture diagram icons — each shape immediately tells you the type without reading labels
- The line style variation for edges (solid/dashed/dotted + arrow/diamond) was specifically chosen to match the preview shown:
  ```
  connects:    ─────────▶  (solid + arrow)
  interacts:   ─ ─ ─ ─ ▶  (dashed + arrow)
  deployed-in: ─────────◇  (solid + diamond)
  composed-of: ─ ─ ─ ─ ◆  (dashed + filled diamond)
  options:     ·········▷  (dotted + open arrow)
  ```
- Container style should look like AWS VPC / Kubernetes namespace diagrams — labeled boundary box with children inside

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — codebase is a fresh monorepo skeleton from Phase 1 (governance/CI only)
- `apps/studio/src/index.ts` and `packages/calm-core/src/index.ts` are empty exports

### Established Patterns
- Monorepo structure: `apps/studio` (SvelteKit app), `packages/calm-core`, `packages/calmscript`, `packages/extensions`, `packages/mcp-server`
- Apache 2.0 SPDX headers on all source files
- pnpm workspace, TypeScript, Husky + commitlint

### Integration Points
- `apps/studio` — SvelteKit app where the canvas UI will live
- `packages/calm-core` — CALM data model types and utilities (nodes, edges, relationships)
- Svelte Flow (@xyflow/svelte) needs to be added as a dependency to `apps/studio`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-calm-canvas-core*
*Context gathered: 2026-03-11*
