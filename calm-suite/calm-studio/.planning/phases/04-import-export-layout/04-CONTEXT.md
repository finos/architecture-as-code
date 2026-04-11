# Phase 4: Import, Export & Layout - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Architects can bring existing CALM JSON into the tool, arrange it automatically with ELK, and export diagrams in any format they need (CALM JSON, calmscript, SVG, PNG). Includes native file I/O (open, save, new) with dirty state tracking. FINOS `architecture-as-code` example files must import without data loss.

</domain>

<decisions>
## Implementation Decisions

### Import behavior
- Always replace current diagram on import (no merge mode)
- Both drag-and-drop onto canvas AND File > Open menu/toolbar button
- Invalid/malformed CALM JSON shows error toast, canvas unchanged — no partial load
- Auto-layout runs automatically on import (CALM JSON has no position data)
- fitView called after auto-layout completes

### Auto-layout & pinning
- Default layout direction: top-to-bottom (actors/clients top, databases bottom)
- Three layout presets available: Hierarchical (top-to-bottom), Left-to-right, Top-to-bottom — accessible via dropdown next to auto-layout button
- Pin icon toggle on each node (visible on hover) — pinned nodes stay fixed during auto-layout, unpinned nodes reflow around them
- Auto-layout button in canvas toolbar (bottom-left or top-right controls area, next to zoom/fitView)

### Export formats
- Single "Export" dropdown button with options: CALM JSON, calmscript, SVG, PNG
- Transparent background for SVG and PNG exports (embeds cleanly into docs/slides)
- PNG exports at 2x (Retina) resolution by default
- Default filename: `architecture.[ext]` (e.g., `architecture.calm.json`, `architecture.svg`)

### File I/O
- Standard keyboard shortcuts: Cmd+O = Open, Cmd+S = Save, Cmd+Shift+S = Save As, Cmd+N = New
- File System Access API (Chrome/Edge) for real save-in-place; browser download fallback for Firefox/Safari
- Native file picker via showOpenFilePicker() with <input type="file"> fallback
- Dirty state tracking: "Unsaved changes" indicator, beforeunload prompt on tab close
- Title bar shows current filename + dirty indicator dot (e.g., "architecture.calm.json" / "architecture.calm.json •")
- Cmd+N clears canvas for fresh diagram, prompts to save if dirty
- Slim top toolbar with Open, Save, Export dropdown buttons (keyboard shortcuts still work)

### Claude's Discretion
- Toast/error notification component choice and styling
- Exact toolbar layout and icon design
- ELK.js configuration parameters (spacing, node sizes, edge routing)
- Auto-layout animation (instant vs animated transition)
- File type filters in open dialog (.calm.json, .json)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. All decisions followed recommended patterns for professional editor UX.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calmModel.svelte.ts` — `applyFromJson()` is the import entry point; accepts CalmArchitecture and updates canonical model
- `projection.ts` — `calmToFlow()` accepts optional `positionMap` parameter; ELK layout positions can be injected here
- `projection.ts` — `flowToCalm()` converts canvas state back to CalmArchitecture for CALM JSON export
- `calmModel.svelte.ts` — `getModelJson()` returns pretty-printed CALM JSON string for export
- `history.svelte.ts` — Undo/redo store can track dirty state (compare current vs last-saved snapshot)
- `CalmCanvas.svelte` — Already has `fitView` call; canvas toolbar area exists for layout/export buttons

### Established Patterns
- Module-level `$state` runes for stores (history, clipboard, theme) — file I/O state should follow same pattern
- Direction mutex in calmModel prevents sync loops — import should use `applyFromJson()` which respects this
- Monochrome node styling — exported SVG/PNG will reflect this aesthetic consistently

### Integration Points
- `+page.svelte` — Top-level layout; toolbar would be added here or in a new Toolbar component
- `CalmCanvas.svelte` — Canvas controls area for layout button; drag-and-drop handler for file import
- `calmModel.svelte.ts` — `applyFromJson()` for import; `getModel()` for export
- `projection.ts` — `calmToFlow()` with positionMap for injecting ELK layout results

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-import-export-layout*
*Context gathered: 2026-03-12*
