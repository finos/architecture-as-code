# Phase 13: Embedding & Visualization - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables: (1) a `<calm-diagram>` web component that renders any CALM JSON with a single HTML tag, installable via npm and usable in any framework, and (2) flow visualization showing data flows as animated overlays on canvas edges, driven by the CALM flow.json schema.

</domain>

<decisions>
## Implementation Decisions

### Web Component API
- `src` attribute to fetch CALM JSON from URL (`<calm-diagram src="arch.calm.json">`). Also supports `data` attribute for inline JSON embedding.
- Read-only with zoom and pan. No editing. Clicking a node shows a tooltip with its description.
- `theme` attribute for light/dark (`<calm-diagram theme="dark">`). Uses CSS custom properties inside Shadow DOM for host page overrides.
- Bundle all 10 extension packs (AWS, K8s, OpenGRIS, etc.) — any CALM JSON renders correctly with proper icons and colors. Zero config.
- `flow` attribute to activate flow overlay (`<calm-diagram src="arch.json" flow="order-flow">`).

### Web Component Packaging
- New package at `packages/web-component/` — separate from the studio app. Follows existing monorepo pattern.
- Published as `@calmstudio/diagram` to npm.
- npm + CDN script tag distribution — unpkg/jsdelivr for zero-build usage, npm import for framework users.
- Shadow DOM for style encapsulation. Expose CSS custom properties for theming.

### Flow Overlay Visuals
- Animated dots moving along edges in sequence order. Each edge gets a numbered badge (1, 2, 3...) showing step order.
- Direction-aware: animated dot moves in the direction specified by CALM flow.json `direction` field (source-to-destination or destination-to-source). Arrow markers reinforce direction.
- Tooltip on hover: hovering a sequence badge or animated dot shows the transition `summary` text. No inline labels — keeps canvas clean.
- One flow at a time. Select from a dropdown — only that flow's overlays show.
- Dimming: edges and nodes not part of the active flow get 30% opacity. Focus effect makes the flow path stand out.

### Flow Interaction Model
- Flows imported from CALM JSON's `flows` array (per flow.json schema). No visual flow editor — flows are authored in JSON or via MCP.
- Flow selector as a toolbar dropdown. Lists all flows by name. "None" option to hide flows.
- Flow overlay works in both CalmStudio editor AND the `<calm-diagram>` web component (via `flow` attribute).

### Claude's Discretion
- Canvas rendering library choice for the web component (Svelte Flow embedded, ELK.js static render, or custom SVG)
- Animation timing and easing for flow dots
- Bundle size optimization strategy (tree-shaking, code splitting)
- Flow overlay color palette (for the dots and badges)
- Auto-layout algorithm for the web component (ELK.js is already in the project)

</decisions>

<specifics>
## Specific Ideas

- The CALM flow.json schema defines flows with ordered `transitions`, each referencing a `relationship-unique-id` with `sequence-number`, `summary`, and `direction`. This is the data model for flow visualization.
- The web component should work as simply as: add a script tag, drop in `<calm-diagram src="file.json">`, done. No build tools, no framework, no config.
- Flow visualization should feel like a "sequence diagram on top of an architecture diagram" — showing the order of data flow across the system.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/calm-core/src/schemas/flow.json`: CALM flow schema with transition type (relationship-unique-id, sequence-number, summary, direction)
- `packages/extensions/`: All 10 extension packs with icons, colors, node types — must be bundled into web component
- `apps/studio/src/lib/canvas/edges/`: 5 edge types (ConnectsEdge, InteractsEdge, DeployedInEdge, ComposedOfEdge, OptionsEdge) — flow overlays layer on top of these
- `apps/studio/src/lib/canvas/edges/EdgeMarkers.svelte`: Existing edge marker/arrow infrastructure
- `apps/studio/src/lib/io/export.ts`: Export pattern (blob → downloadDataUrl) — web component build is separate but follows same patterns
- `apps/studio/src/lib/toolbar/Toolbar.svelte`: Toolbar dropdown pattern — flow selector follows same UX

### Established Patterns
- Extension pack registration: `initAllPacks()` in packages/extensions
- Template registration: `initAllTemplates()` in apps/studio
- Conditional toolbar items: `showScalerTomlExport` pattern from Phase 15

### Integration Points
- `packages/web-component/` — new package, imports from calm-core and extensions
- `apps/studio/src/lib/canvas/edges/` — flow overlay components layer on existing edges
- `apps/studio/src/lib/toolbar/Toolbar.svelte` — flow selector dropdown
- `apps/studio/src/routes/+page.svelte` — flow state management and reactive detection

</code_context>

<deferred>
## Deferred Ideas

- Visual flow builder (click edges to define flows) — future phase, significantly more UI work
- Multiple simultaneous flow overlays with color coding — future enhancement
- Flow step editing in properties panel — future phase
- Flow export as sequence diagram — separate tool

</deferred>

---

*Phase: 13-embedding-visualization*
*Context gathered: 2026-03-23*
