# Phase 6: CALM Validation - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time CALM schema validation with inline error indicators on canvas nodes/edges and a severity panel listing all issues. Validation runs automatically on debounced changes without blocking UI interaction.

</domain>

<decisions>
## Implementation Decisions

### Inline error indicators
- Badge with issue count on top-right corner of nodes (red circle with number)
- Edges change color: red for errors, amber for warnings — small icon on midpoint
- Hover over badge/edge shows tooltip listing all issues for that element
- Clicking a validation badge on a node opens/scrolls the validation panel to that node's issues
- Two-way navigation: panel click also selects the node on canvas

### Validation panel design
- Bottom drawer (collapsible), like VS Code's Problems panel — below the canvas, full width
- Issues grouped by severity: errors first, then warnings, then info — within each group sorted by node/edge name
- Clicking an issue in the panel selects AND centers the offending node/edge on the canvas (zoom/pan to it)
- Panel auto-opens when the first error is detected; stays open until manually closed; doesn't re-open after manual dismiss

### Validation scope & rules
- Full CALM JSON Schema validation using Ajv (TypeScript reimplementation, not shelling out to `calm validate` CLI)
- Runs in-browser with no CLI dependency — validates against official CALM JSON Schema files
- Three severity levels: error, warning, info
- No suppression/dismiss mechanism in v1 — all issues always shown
- Shared validation engine between studio and MCP server — upgrade MCP server's validate_architecture to use the same Ajv-based validation

### Trigger & performance
- Debounced on every change (300-500ms idle before running validation)
- Main thread with debounce — no Web Worker for v1 (Ajv is fast for typical 5-50 node diagrams)
- Validation indicators on canvas + bottom panel only — no CodeMirror inline squiggles (code editor keeps existing JSON syntax linting)

### Claude's Discretion
- Exact debounce timing (300ms vs 500ms)
- Ajv configuration and CALM schema file sourcing
- Tooltip styling and animation
- Badge positioning edge cases (small nodes, overlapping badges)
- Panel resize behavior and minimum height
- Info-level rule definitions (e.g., "node has no description")

</decisions>

<specifics>
## Specific Ideas

- Validation panel should feel like VS Code's Problems panel — familiar to developers
- Two-way navigation is key: badge click opens panel, panel click navigates to canvas element
- MCP server and studio must produce identical validation results — single shared validation engine in calm-core or a shared package

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/mcp-server/src/validation.ts`: Existing `validateArchitecture()` function with `ValidationIssue` type — covers missing fields, duplicates, dangling refs, orphans, self-loops. Will be superseded by Ajv-based validation but rules should be preserved.
- `packages/calm-core/src/types.ts`: CALM type definitions (CalmArchitecture, CalmNode, CalmRelationship) — validation engine operates on these types
- `apps/studio/src/lib/stores/calmModel.svelte.ts`: Canonical CALM model store — validation reacts to changes here via `getModel()`

### Established Patterns
- Module-level `$state` runes for reactive stores (history, clipboard, theme) — validation store should follow same pattern
- Direction mutex in calmModel prevents sync loops — validation should read model state, not participate in sync
- Monochrome-only node styling decided in Phase 2 — validation badges add first use of color (red/amber) to nodes
- `paneforge` used for resizable panels (properties panel) — bottom drawer should use same library for consistency

### Integration Points
- Validation store subscribes to `getModel()` changes (reactive via $derived or $effect)
- Canvas nodes need a validation prop/slot for badge rendering — custom node components in `apps/studio/src/lib/canvas/nodes/`
- Canvas edges need color override capability — edge components in `apps/studio/src/lib/canvas/edges/`
- Bottom drawer integrates into `apps/studio/src/routes/+page.svelte` layout alongside existing paneforge panels
- MCP server's validation.ts should import from shared validation package

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-calm-validation*
*Context gathered: 2026-03-12*
