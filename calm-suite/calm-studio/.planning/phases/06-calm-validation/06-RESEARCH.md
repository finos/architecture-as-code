# Phase 6: CALM Validation - Research

**Researched:** 2026-03-12
**Domain:** In-browser JSON Schema validation (Ajv), Svelte 5 reactive stores, Svelte Flow node/edge augmentation, paneforge bottom drawer
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Inline error indicators:** Badge with issue count on top-right corner of nodes (red circle with number); edges change color — red for errors, amber for warnings — with a small icon on midpoint. Hover shows tooltip listing all issues. Clicking badge opens/scrolls validation panel. Two-way navigation: panel click also selects node on canvas.
- **Validation panel design:** Bottom drawer (collapsible), like VS Code's Problems panel — below the canvas, full width. Issues grouped by severity: errors first, then warnings, then info — sorted by node/edge name within each group. Clicking an issue selects AND centers the offending element on canvas. Panel auto-opens when the first error is detected; stays open until manually closed; does NOT re-open after manual dismiss.
- **Validation scope and engine:** Full CALM JSON Schema validation using Ajv (TypeScript, in-browser, no CLI dependency). Three severity levels: error, warning, info. No suppression/dismiss in v1. Shared validation engine between studio and MCP server — upgrade MCP server's `validate_architecture` to use the same Ajv-based validation.
- **Trigger and performance:** Debounced on every change (300-500ms idle). Main thread with debounce — no Web Worker for v1. Validation indicators on canvas + bottom panel only — no CodeMirror inline squiggles.

### Claude's Discretion
- Exact debounce timing (300ms vs 500ms)
- Ajv configuration and CALM schema file sourcing
- Tooltip styling and animation
- Badge positioning edge cases (small nodes, overlapping badges)
- Panel resize behavior and minimum height
- Info-level rule definitions (e.g., "node has no description")

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VALD-01 | Real-time CALM schema validation with inline error indicators on offending nodes/edges | Ajv compile-once pattern; Svelte 5 `$effect` debounce for reactivity; node badge overlay via absolute-positioned div in custom node components; edge color override via `style` prop |
| VALD-02 | Validation results displayed in dedicated panel with severity (error, warning, info) | paneforge bottom `Pane` in +page.svelte vertical `PaneGroup`; existing pattern from PropertiesPanel; severity grouping in validation store |
| VALD-03 | Validation runs on debounced changes (not blocking the UI) | Svelte 5 `$effect` with `setTimeout`/`clearTimeout` cleanup; getModel() reactive read in validation store |
</phase_requirements>

---

## Summary

Phase 6 adds real-time CALM schema validation that runs entirely in the browser using Ajv (v8), the industry-standard JSON Schema validator. The validation engine lives in `packages/calm-core` as a shared module consumed by both the studio and the MCP server, replacing the hand-rolled `validation.ts` in the MCP server. The studio wires a Svelte 5 reactive validation store that debounces off `getModel()` changes, decorates each canvas node with a badge overlay and each edge with a color/icon override, and renders a collapsible bottom drawer panel styled after VS Code's Problems panel.

The core challenge is plumbing validation results to two different rendering surfaces: (1) the custom Svelte node/edge components need to receive per-element issue counts/severity without coupling to the validation store directly, and (2) the bottom drawer must support two-way navigation — badge click opens panel entry; panel entry click selects and centers element on canvas. Both surfaces read from a single module-level validation store that follows the existing `history.svelte.ts` / `theme.svelte.ts` pattern.

The CALM JSON Schema lives in the FINOS GitHub repository at `calm/draft/2025-03/meta/`. The key file is `core.json` which defines required fields (unique-id, node-type, name, description for nodes; unique-id, relationship-type, source, destination for relationships). Ajv 8 supports JSON Schema Draft 2020-12 which these schemas use. The CALM schemas must be bundled as static assets or imported as JSON — they cannot be fetched at runtime in an offline-capable app.

**Primary recommendation:** Create `packages/calm-core/src/validation.ts` with an Ajv-powered `validateCalmArchitecture()` function that accepts `CalmArchitecture` and returns `ValidationIssue[]` (extended to include `'info'` severity). Move existing MCP server validation rules (orphans, dangling refs, duplicates, self-loops) into the new engine alongside Ajv schema validation. Wire debounced reactivity in `apps/studio/src/lib/stores/validation.svelte.ts` using `$effect` + `setTimeout`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ajv | ^8.18.0 | JSON Schema validation (Draft 2020-12) | Fastest JS validator; supports CALM's 2020-12 draft; used by FINOS CALM CLI itself |
| ajv-formats | ^3.0.1 | Format keywords (uri, email, date, etc.) | CALM schema uses `format` keywords; required alongside ajv |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| paneforge | ^1.0.2 (already installed) | Bottom drawer resizable panel | Use for validation drawer — consistent with PropertiesPanel pattern |
| @xyflow/svelte | ^1.5.1 (already installed) | Edge `style` prop for color override | Already in use; edge color override via `style` attribute on `<BaseEdge>` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ajv 8 (Draft 2020-12) | Ajv 6 (Draft 04) | Ajv 6 doesn't support 2020-12; CALM schemas use 2020-12 vocabulary |
| Static bundled schema JSON | Runtime fetch from FINOS CDN | Fetch fails offline; bundled is reliable and ~50KB |
| paneforge for drawer | CSS-only collapsible | paneforge already used for properties panel — consistent drag-resize behavior |
| Main-thread debounce | Web Worker | Ajv is fast (<5ms for typical 50-node diagrams); Web Worker adds setup complexity for minimal gain |

**Installation (calm-core):**
```bash
pnpm --filter @calmstudio/calm-core add ajv ajv-formats
```

**Installation (studio — Vite optimizeDeps):**
No new packages in studio; ajv is in calm-core. If Vite has trouble resolving CJS ajv internals, add to `optimizeDeps.include` in `vite.config.ts`:
```ts
optimizeDeps: {
  include: ['ajv', 'ajv-formats'],
  exclude: [ /* existing codemirror excludes */ ]
}
```

---

## Architecture Patterns

### Recommended Project Structure
```
packages/calm-core/src/
├── types.ts              # (existing) CalmArchitecture types
├── index.ts              # (existing) exports
└── validation.ts         # NEW — Ajv-based validateCalmArchitecture()

apps/studio/src/lib/
├── stores/
│   ├── calmModel.svelte.ts   # (existing) canonical model
│   └── validation.svelte.ts  # NEW — debounced validation store
├── canvas/
│   ├── nodes/
│   │   └── ValidationBadge.svelte  # NEW — reusable badge overlay
│   ├── edges/
│   │   └── ConnectsEdge.svelte     # MODIFIED — accept validationSeverity prop
│   └── CalmCanvas.svelte           # MODIFIED — pass validation props to nodes/edges
└── validation/
    └── ValidationPanel.svelte      # NEW — bottom drawer panel
```

### Pattern 1: Module-level Validation Store (Svelte 5 rune pattern)
**What:** A `.svelte.ts` module using `$state` rune for validation results, subscribing to `getModel()` via `$effect` with debounce.
**When to use:** Follows the established project pattern for history, clipboard, theme stores.

```typescript
// Source: established project pattern (history.svelte.ts, theme.svelte.ts)
// apps/studio/src/lib/stores/validation.svelte.ts

import { getModel } from './calmModel.svelte';
import { validateCalmArchitecture, type ValidationIssue } from '@calmstudio/calm-core';

let issues = $state<ValidationIssue[]>([]);
let panelDismissed = $state(false);
let panelWasAutoOpened = $state(false);

// Debounce validation on model changes
let debounceTimer: ReturnType<typeof setTimeout>;

$effect(() => {
  // Track model reactively
  const model = getModel();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const result = validateCalmArchitecture(model);
    issues = result;

    // Auto-open panel on first error — but only if not manually dismissed
    const hasErrors = result.some(i => i.severity === 'error');
    if (hasErrors && !panelDismissed) {
      panelWasAutoOpened = true;
    }
  }, 400);

  return () => clearTimeout(debounceTimer);
});

export function getIssues() { return issues; }
export function getIssuesByElementId(id: string) {
  return issues.filter(i => i.nodeId === id || i.relationshipId === id);
}
export function dismissPanel() { panelDismissed = true; }
export function resetDismiss() { panelDismissed = false; panelWasAutoOpened = false; }
```

**CRITICAL NOTE:** `$effect` at module level only works in `.svelte.ts` files (Svelte 5 module context). The validation store MUST be a `.svelte.ts` file, not `.ts`.

### Pattern 2: Ajv Validation Engine (calm-core)
**What:** Compile-once Ajv instance in calm-core, exported as a pure function.
**When to use:** For both studio (reactive) and MCP server (per-call) consumption.

```typescript
// Source: Ajv docs (https://ajv.js.org/guide/getting-started.html)
// packages/calm-core/src/validation.ts

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import calmCoreSchema from './schemas/core.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(calmCoreSchema);
const validateSchema = ajv.compile(calmCoreSchema);

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  relationshipId?: string;
  path?: string; // JSON path for Ajv errors
}

export function validateCalmArchitecture(arch: CalmArchitecture): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Ajv schema validation
  const valid = validateSchema(arch);
  if (!valid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      issues.push({
        severity: 'error',
        message: err.message ?? 'Schema validation error',
        path: err.instancePath,
        // Map instancePath to nodeId/relationshipId where possible
        nodeId: extractNodeId(err.instancePath, arch),
        relationshipId: extractRelationshipId(err.instancePath, arch),
      });
    }
  }

  // 2. Semantic rules (preserved from existing validation.ts)
  issues.push(...semanticValidation(arch));

  return issues;
}
```

**Key Ajv config:**
- `allErrors: true` — collect ALL errors, not just the first (essential for a problems panel)
- `strict: false` — CALM schemas use custom keywords; strict mode would reject them
- `addFormats` — required for any `format` keywords in CALM schema (uri, etc.)

### Pattern 3: Node Badge Overlay
**What:** Absolute-positioned overlay div placed inside each custom node component.
**When to use:** All 11 standard node components + GenericNode — each already renders a `<div class="node">` with relative/absolute positioning context.

```svelte
<!-- Source: project pattern from ServiceNode.svelte -->
<!-- Each node receives validation data through the node's `data` prop -->

<script lang="ts">
  import { type NodeProps } from '@xyflow/svelte';
  import ValidationBadge from './ValidationBadge.svelte';

  let { id, data, selected }: NodeProps = $props();

  // validation data injected via node.data in CalmCanvas.svelte
  const errorCount = $derived((data as any).validationErrors ?? 0);
  const warnCount = $derived((data as any).validationWarnings ?? 0);
</script>

<div class="node" class:selected>
  <!-- existing node content -->
  <ValidationBadge {errorCount} {warnCount} nodeId={data.calmId} />
</div>
```

**Injection point:** CalmCanvas.svelte enriches nodes before passing to SvelteFlow:
```typescript
// CalmCanvas or +page.svelte — after validation store updates
nodes = rawNodes.map(n => ({
  ...n,
  data: {
    ...n.data,
    validationErrors: issuesByElementId.get(n.data.calmId)?.errors ?? 0,
    validationWarnings: issuesByElementId.get(n.data.calmId)?.warnings ?? 0,
  }
}));
```

### Pattern 4: Edge Color Override
**What:** Pass computed `style` prop to `<BaseEdge>` based on validation severity.
**When to use:** All 5 edge type components.

```svelte
<!-- ConnectsEdge.svelte modification -->
<script lang="ts">
  // validationSeverity comes from edge.data.validationSeverity
  const edgeColor = $derived(
    data?.validationSeverity === 'error' ? 'var(--color-error, #dc2626)' :
    data?.validationSeverity === 'warning' ? 'var(--color-warning, #d97706)' :
    undefined
  );
</script>

<BaseEdge
  {id}
  path={edgePath}
  markerEnd="url(#marker-arrow-filled)"
  style={edgeColor ? `stroke: ${edgeColor};` : style}
/>
```

### Pattern 5: Bottom Drawer with paneforge
**What:** Add a third `Pane` to the existing vertical `PaneGroup` in `+page.svelte`, replacing or alongside the current code panel.
**When to use:** Consistent with existing paneforge usage for PropertiesPanel and code panel.

Current layout in `+page.svelte`:
```
PaneGroup (vertical)
  Pane (70%) — canvas area (horizontal PaneGroup inside)
  PaneResizer
  Pane (30%) — CodePanel
```

New layout:
```
PaneGroup (vertical)
  Pane (60%) — canvas area (horizontal PaneGroup inside)
  PaneResizer
  Pane (25%) — CodePanel
  PaneResizer
  Pane (15%, collapsible) — ValidationPanel
```

**Collapse implementation:** paneforge Pane has `collapsible`, `collapsedSize`, and `onCollapse`/`onExpand` callbacks. Use `bind:pane` to get a reference and call `pane.collapse()` / `pane.expand()` programmatically.

### Anti-Patterns to Avoid
- **Importing validation store in node components:** Svelte node components are instantiated many times. Import from store in the parent (+page.svelte) and inject via `node.data` — this keeps node components pure and testable.
- **Running Ajv validation synchronously on every keystroke:** Always use the debounce pattern; Ajv.compile() is fast (~1-3ms for small diagrams) but synchronous, and firing on every character in CodePanel would block the input.
- **Creating a new Ajv instance per validation call:** Ajv compiles schemas to functions and caches them. Create ONE instance at module level in calm-core.
- **Using `$state` for debounce timer:** Use plain `let` for the timer handle — no reactivity needed, matches the `syncing` mutex pattern in calmModel.svelte.ts.
- **Fetching CALM schema files at runtime:** Bundle them as static JSON imports. Runtime fetch will fail in offline/Tauri scenarios.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom rule engine | Ajv 8 | Handles `oneOf`, `$ref`, `allOf`, `required`, `format`, `pattern`, `enum` — hundreds of edge cases in the CALM 2020-12 schema |
| Format validation (URI, email) | Custom regex | ajv-formats | 22 built-in formats, spec-compliant implementations |
| Resizable drawer panel | CSS height + JS drag | paneforge | Already in codebase; handles drag, persist, keyboard, accessibility |
| Debounce | Custom class | `setTimeout`/`clearTimeout` in `$effect` cleanup | Standard Svelte 5 pattern; no extra dependency |

**Key insight:** The CALM JSON Schema uses `oneOf` for relationship-type discrimination (connects has different required fields than interacts, deployed-in, etc.). Hand-rolling this correctly requires understanding every combination — Ajv handles it automatically.

---

## Common Pitfalls

### Pitfall 1: Ajv `strict` Mode Rejects Custom CALM Keywords
**What goes wrong:** Ajv 8 defaults to `strict: true`. CALM schemas use custom vocabulary keywords (e.g., CALM core vocabulary extensions). Ajv throws during `compile()` because it doesn't recognize the keywords.
**Why it happens:** JSON Schema 2020-12 allows custom vocabularies; Ajv requires explicit registration or `strict: false`.
**How to avoid:** Set `strict: false` in Ajv constructor options. Alternatively, register custom CALM keywords via `ajv.addKeyword()`.
**Warning signs:** `Error: unknown keyword: "..."` during Ajv initialization.

### Pitfall 2: `$effect` at Module Level Requires `.svelte.ts` Extension
**What goes wrong:** Placing `$effect` in a `.ts` file (not `.svelte.ts`) causes a compile error: "runes can only be used in Svelte files."
**Why it happens:** Svelte 5 runes are a compile-time transform applied only to files Svelte processes — `.svelte`, `.svelte.ts`, `.svelte.js`.
**How to avoid:** Validation store file MUST be named `validation.svelte.ts`.
**Warning signs:** TypeScript/Svelte compiler error mentioning runes outside Svelte context.

### Pitfall 3: Node Badge Causes Infinite Update Loop
**What goes wrong:** Validation store updates trigger node re-renders, which update canvas state, which triggers validation again.
**Why it happens:** If `applyFromCanvas` is called after injecting validation data into nodes, the model appears to change, retriggering validation.
**How to avoid:** Validation data injection into `node.data` must NOT flow through `applyFromCanvas`. Use a separate derived state for display-augmented nodes that is never written back to the CALM model. The validation store should READ `getModel()`, not write to it.
**Warning signs:** Validation running in a tight loop, growing issue count, or `getModel()` being called many times per second.

### Pitfall 4: Two-Way Navigation Creates Selection State Conflicts
**What goes wrong:** Clicking a validation panel entry to navigate to a node conflicts with Svelte Flow's internal selection state, causing flickering or deselection.
**Why it happens:** Svelte Flow manages selection internally; programmatically calling `setCenter()` + setting `node.selected` can race with SvelteFlow's own selection handlers.
**How to avoid:** Use `useSvelteFlow().fitView({ nodes: [{ id }] })` or `setCenter(x, y, { zoom, duration })` for navigation, and update the `selectedNodeId` state in `+page.svelte` (which already controls PropertiesPanel selection). Do NOT directly mutate `node.selected` from outside SvelteFlow.
**Warning signs:** Node appears selected briefly then deselects, or PropertiesPanel shows wrong node.

### Pitfall 5: CALM Schema `$ref` Resolution Requires Multi-Schema Ajv Setup
**What goes wrong:** `core.json` references `interface.json`, `flow.json`, etc. via `$ref`. Ajv cannot resolve these if only `core.json` is added.
**Why it happens:** JSON Schema `$ref` is resolved by URI; Ajv needs all referenced schemas registered.
**How to avoid:** Add ALL CALM meta-schema files to the Ajv instance via `ajv.addSchema()` before compiling. Bundle all 8 files from `calm/draft/2025-03/meta/`.
**Warning signs:** `Error: can't resolve reference` during validation of complex architectures.

### Pitfall 6: Vite/SvelteKit Cannot Resolve Ajv CJS Internals
**What goes wrong:** Vite fails to build because ajv uses CJS internals that conflict with ESM resolution in SvelteKit.
**Why it happens:** Ajv publishes CJS + ESM, but some internal imports are ambiguous under Vite's bundler mode.
**How to avoid:** Add `ajv` and `ajv-formats` to `optimizeDeps.include` in `vite.config.ts` (same fix previously applied for `@codemirror/*` packages per STATE.md).
**Warning signs:** `Failed to resolve "ajv/dist/..."` error during `vite dev` or build.

### Pitfall 7: Panel Auto-Open State Must Survive Navigation
**What goes wrong:** Panel dismissal state is lost on hot module reload or component re-mount.
**Why it happens:** Module-level `$state` is reset on HMR in dev mode.
**How to avoid:** This is acceptable behavior for dev mode. For production, module-level state persists for the session. Document that `panelDismissed` is session-level, not persisted.

---

## Code Examples

Verified patterns from project codebase and Ajv docs:

### Ajv Compile-Once, Validate-Many
```typescript
// Source: https://ajv.js.org/guide/getting-started.html
// packages/calm-core/src/validation.ts

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
// Import all CALM 2025-03 meta schemas as static JSON
import calmSchema from './schemas/calm.json' assert { type: 'json' };
import coreSchema from './schemas/core.json' assert { type: 'json' };
import interfaceSchema from './schemas/interface.json' assert { type: 'json' };
import flowSchema from './schemas/flow.json' assert { type: 'json' };
import controlSchema from './schemas/control.json' assert { type: 'json' };
import controlReqSchema from './schemas/control-requirement.json' assert { type: 'json' };
import evidenceSchema from './schemas/evidence.json' assert { type: 'json' };
import unitsSchema from './schemas/units.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Register all referenced schemas first (for $ref resolution)
[coreSchema, interfaceSchema, flowSchema, controlSchema,
 controlReqSchema, evidenceSchema, unitsSchema].forEach(s => ajv.addSchema(s));

// Compile the top-level validator once
const validate = ajv.compile(calmSchema);
```

### Svelte 5 Debounced Effect (module-level store)
```typescript
// Source: project pattern (history.svelte.ts) + Svelte docs
// apps/studio/src/lib/stores/validation.svelte.ts

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

$effect(() => {
  const currentModel = getModel(); // reactive dependency tracked here
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    issues = validateCalmArchitecture(currentModel);
  }, 400);

  // Cleanup: cancel pending validation when effect re-runs
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
  };
});
```

### paneforge Collapsible Pane
```svelte
<!-- Source: paneforge docs (https://paneforge.com/docs) -->
<!-- The validation drawer pane, added to +page.svelte vertical PaneGroup -->

<script>
  import { Pane, PaneResizer } from 'paneforge';
  let validationPane: ReturnType<typeof Pane>;
</script>

<Pane
  bind:pane={validationPane}
  defaultSize={15}
  minSize={5}
  collapsible
  collapsedSize={0}
  onCollapse={() => { /* update panelOpen state */ }}
  onExpand={() => { /* update panelOpen state */ }}
>
  <ValidationPanel />
</Pane>
```

### Edge Color Override via style prop
```svelte
<!-- Source: project pattern (ConnectsEdge.svelte) + @xyflow/svelte BaseEdge docs -->
<BaseEdge
  {id}
  path={edgePath}
  style={validationStyle ?? style}
/>
```

### Svelte Flow Navigate to Node (centers viewport on element)
```typescript
// Source: @xyflow/svelte useSvelteFlow hook
const { fitView, setCenter } = useSvelteFlow();

// Center on a specific node by ID
function navigateToNode(nodeId: string, nodes: Node[]) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const x = node.position.x + (node.measured?.width ?? 120) / 2;
  const y = node.position.y + (node.measured?.height ?? 60) / 2;
  setCenter(x, y, { zoom: 1.2, duration: 400 });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled validation in MCP server (`validation.ts`) | Shared Ajv-based engine in calm-core | Phase 6 | MCP and studio produce identical results |
| No `info` severity | Three levels: error, warning, info | Phase 6 | Richer feedback (e.g., "no description") |
| Validation as one-shot CLI call | Debounced reactive in-browser | Phase 6 | No user action required |

**CALM Schema version:** The 2025-03 draft is the current FINOS iteration. Schema files live at:
- `https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2025-03/meta/`
- Files: `calm.json`, `core.json`, `interface.json`, `flow.json`, `control.json`, `control-requirement.json`, `evidence.json`, `units.json`
- These must be copied into `packages/calm-core/src/schemas/` as static JSON (not fetched at runtime).

---

## Open Questions

1. **CALM Schema `$schema` URI resolution**
   - What we know: CALM schemas use `$schema: "https://calm.finos.org/draft/2025-03/meta/calm.json"` as their schema URI; Ajv resolves `$ref` by URI match.
   - What's unclear: Whether Ajv needs the schema registered under the exact CALM URI or whether bundled copies need ID remapping.
   - Recommendation: Register each bundled schema with `ajv.addSchema(schema, schema.$id)` to ensure URI-based `$ref` resolves to bundled copies. Test with a sample CALM architecture during Wave 0.

2. **Badge click → panel scroll coordination**
   - What we know: Panel is a Svelte component; badge click needs to trigger panel focus + scroll to the matching issue row.
   - What's unclear: Best mechanism — custom DOM event vs. a shared scroll-target store.
   - Recommendation: Export a `scrollToElementId = $state<string | null>(null)` from the validation store; ValidationPanel `$effect`-watches it and uses `element.scrollIntoView()`. Reset to null after scroll.

3. **Validation store initialization timing**
   - What we know: Module-level `$effect` in `.svelte.ts` runs after first import.
   - What's unclear: Does the validation store's `$effect` fire before the canvas is mounted on first load?
   - Recommendation: Validation results being empty on first frame is acceptable — the debounce means they appear after 400ms. No special initialization needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/studio/vite.config.ts` (test section) |
| Quick run command | `pnpm --filter @calmstudio/studio test` |
| Full suite command | `pnpm --filter @calmstudio/studio test && pnpm --filter @calmstudio/calm-core test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALD-01 | Badge shows error/warning counts per node | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ Wave 0 |
| VALD-01 | Edge changes color for error/warning severity | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ Wave 0 |
| VALD-02 | Issues grouped by severity in panel | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ Wave 0 |
| VALD-02 | Panel click selects and centers element | manual | — manual only | N/A |
| VALD-03 | Validation runs after debounce, not on every change | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ Wave 0 |
| VALD-03 | validateCalmArchitecture returns correct issues | unit | `pnpm --filter @calmstudio/calm-core test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/calm-core test`
- **Per wave merge:** `pnpm --filter @calmstudio/studio test && pnpm --filter @calmstudio/calm-core test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/calm-core/src/validation.test.ts` — covers validateCalmArchitecture() with error/warning/info cases, Ajv schema validation, semantic rules
- [ ] `apps/studio/src/tests/validation.test.ts` — covers validation store debounce behavior, issue grouping by elementId
- [ ] `packages/calm-core/src/schemas/` — directory with all 8 bundled CALM 2025-03 meta JSON files
- [ ] Add `ajv` and `ajv-formats` to `packages/calm-core/package.json` dependencies

---

## Sources

### Primary (HIGH confidence)
- Ajv documentation (ajv.js.org) — API, `allErrors`, `strict`, `addFormats`, browser environment guidance
- FINOS CALM schema files (github.com/finos/architecture-as-code/tree/main/calm/draft/2025-03/meta) — 8 schema files identified: calm.json, core.json, interface.json, flow.json, control.json, control-requirement.json, evidence.json, units.json
- Project codebase read directly — CalmCanvas.svelte, +page.svelte, history.svelte.ts, validation.ts (MCP), ServiceNode.svelte, ConnectsEdge.svelte, vite.config.ts

### Secondary (MEDIUM confidence)
- Svelte 5 `$effect` debounce pattern — verified against svelte.dev docs, consistent with project's existing `$state`/`$effect` usage
- paneforge collapsible Pane — confirmed from paneforge.com docs; `collapsible` + `collapsedSize` props verified

### Tertiary (LOW confidence)
- CALM schema `$ref` resolution behavior with bundled copies vs. URI — documented as open question; needs empirical validation in Wave 0
- ajv-formats version ^3.0.1 — inferred from npm; verify compatibility with ajv 8.18.0 during install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Ajv 8 is the de facto JSON Schema validator; confirmed support for Draft 2020-12; paneforge already in use
- Architecture: HIGH — all integration points verified from existing codebase; follows established project patterns
- Pitfalls: HIGH — pitfalls 1-6 derived from direct code inspection + Ajv docs + existing STATE.md decisions

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (stable — Ajv 8 API is stable; CALM schema may have minor updates but 2025-03 draft is current)
