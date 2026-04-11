# Phase 3: Properties & Bidirectional Sync - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Editing properties in the panel or CALM JSON in the code editor both update the diagram, with no infinite loops. Delivers: properties panel, CALM JSON code editor (CodeMirror), and bidirectional sync engine. calmscript editing is Phase 5 — this phase only shows the disabled tab placeholder.

</domain>

<decisions>
## Implementation Decisions

### Properties panel layout
- Right sidebar, mirrors the left NodePalette — classic IDE three-column layout (palette | canvas | properties)
- Collapses to a thin strip (~40px) with a hint icon when nothing is selected; expands when a node/edge is selected
- Resizable by dragging the left edge divider between canvas and panel
- Context-sensitive sections: node selected shows node fields, edge selected shows edge fields — header reflects what's selected

### Code editor behavior
- Bottom split panel below the canvas — horizontal split, resizable divider, full width
- Visible by default on app launch (collapsed to ~30% height) — bidirectional sync is the key differentiator, show it immediately
- CALM JSON only in Phase 3; calmscript tab exists but is grayed out with "Coming in Phase 5" tooltip
- Selecting a node/edge on canvas scrolls the code editor to and highlights the corresponding JSON fragment

### Sync engine guardrails
- Debounced live sync (300-500ms) — canvas updates as user types in code editor, with debounce; invalid JSON mid-edit holds last valid canvas state
- Invalid JSON handling: canvas keeps showing last valid diagram; CodeMirror shows red squiggles on invalid lines; small status indicator (red dot or "Invalid JSON" warning)
- Unified undo/redo history — one stack for the whole app (canvas + code + properties); Cmd+Z undoes the last action regardless of surface; extends existing snapshot-based history store
- Last-write-wins conflict resolution — both surfaces write to the same CALM model; direction mutex prevents infinite loops; rare edge case in single-user tool

### CALM metadata depth
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

</decisions>

<specifics>
## Specific Ideas

- The bidirectional sync should be the first thing users see — code panel visible by default communicates the value proposition immediately
- Selection sync between canvas and code editor is key: clicking a node highlights its JSON block, making the visual-to-code connection obvious
- "Coming in Phase 5" tooltip on calmscript tab — signals the roadmap without confusing users

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `history.svelte.ts`: Snapshot-based undo/redo store — extend for unified history across all three editing surfaces
- `resolveNodeType()` in `nodeTypes.ts`: Resolves CALM type string to Svelte Flow component — reuse for live shape swap when node-type changes in properties
- `CalmNode`, `CalmRelationship`, `CalmArchitecture` types in `calm-core/src/types.ts`: Foundation for the CALM model; needs extension for controls and custom metadata
- 11 custom node components: All accept `NodeProps` with `data.label`, `data.calmId`, `data.calmType` — properties panel writes to these fields
- Edge context menu pattern in `CalmCanvas.svelte`: Existing pattern for contextual UI overlays on the canvas

### Established Patterns
- `$state.raw()` for nodes/edges arrays — MUST continue for Svelte Flow compatibility (avoids double-render loops)
- Module-level Svelte 5 `$state` runes for stores — follow this pattern for any new sync/model stores
- Snapshot-before-mutation: `pushSnapshot()` called before every mutation — sync engine must honor this
- Monochrome-only node styling — shape alone differentiates CALM types, no per-type coloring

### Integration Points
- `+page.svelte`: Currently has palette + canvas layout — needs to add properties panel (right) and code editor (bottom)
- `CalmCanvas.svelte`: Exposes `bind:nodes` and `bind:edges` — sync engine will mediate between canvas state and CALM JSON model
- Node `data` object: Currently `{ label, calmId, calmType, interfaces? }` — properties panel reads/writes here; needs to carry full CALM metadata

</code_context>

<deferred>
## Deferred Ideas

- **AI Chat Panel** — In-app chat interface for generating diagrams from natural language, modifying architectures via prompts, generating architecture summaries/descriptions for onboarding newcomers to CALM/architecture. Pairs with MCP server (Phase 8).

</deferred>

---

*Phase: 03-properties-bidirectional-sync*
*Context gathered: 2026-03-11*
