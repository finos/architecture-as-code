# Phase 7: Extension Packs - Research

**Researched:** 2026-03-12
**Domain:** Svelte 5 plugin/registry system, cloud provider SVG icon licensing, collapsible palette UI, sidecar file I/O
**Confidence:** HIGH (architecture patterns), MEDIUM (icon licensing details)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Palette organization:**
- Collapsible sections per pack (Core CALM, AWS, GCP, Azure, Kubernetes, AI/Agentic)
- All sections in one scrollable list — similar to VS Code sidebar sections
- Smart default expansion: expand packs used in the current diagram; empty diagrams show only Core CALM expanded
- Search filters across all packs — results show a pack badge (e.g., [AWS], [K8s]) for attribution
- Flat list within each pack (alphabetical) — no sub-categories
- Custom node input stays at bottom of palette

**Node visuals & icons:**
- Official cloud provider icon SVGs (AWS Architecture Icons, GCP icons, Azure icons, K8s community icons)
- AI/Agentic pack uses custom icons (no standard set exists)
- Per-pack color families matching provider branding (AWS orange, K8s blue, Azure blue, GCP multi-color, AI/Agentic custom)
- Core CALM nodes keep their current desaturated color styling — no changes
- Canvas node rendering: Claude's discretion on card vs icon-dominant layout

**Pack content scope:**
- AWS: 30+ services (Lambda, S3, DynamoDB, ECS, EKS, SQS, SNS, API Gateway, RDS, Aurora, CloudFront, Route 53, IAM, VPC, EC2, Fargate, EventBridge, Step Functions, Cognito, ElastiCache, Kinesis, Redshift, SageMaker, Glue, and more)
- GCP: Top 15 services per EXTK-06
- Azure: Top 15 services per EXTK-07
- Kubernetes: ~15 core workload + networking types (Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob, Service, Ingress, ConfigMap, Secret, PersistentVolume, PVC, Namespace, HPA)
- AI/Agentic: ~14 types (LLM, Agent, Orchestrator, Vector Store, Tool, Memory, Guardrail, Embedding Model, RAG Pipeline, Prompt Template, API Gateway (AI), Human-in-the-Loop, Knowledge Base, Eval/Monitor)

**Node type namespacing:**
- Colon-separated pack prefix in CALM JSON node-type field: `aws:lambda`, `k8s:pod`, `ai:agent`, `gcp:cloud-run`, `azure:functions`
- Parsing: split on ":" → pack name + type name
- Core CALM types remain unprefixed (actor, system, service, etc.)

**Sidecar file (.calmstudio.json):**
- Auto-created alongside the `.json` CALM file when user places the first extension pack node
- Contains: enabled pack list, schema version, pack versions
- Example: `{ "packs": ["aws", "k8s"], "version": "1.0", "packVersions": { "aws": "1.0.0", "k8s": "1.0.0" } }`
- Not created for pure CALM-only diagrams

**Missing sidecar handling:**
- When opening a `.json` CALM file with extension pack node types but no `.calmstudio.json`: render unknown types as GenericNode (existing behavior)
- Show info banner: "Extension pack types detected. [Enable packs] [Dismiss]"
- "Enable packs" auto-detects packs from node-type prefixes, creates sidecar, re-renders with proper icons

**Technical decisions:**
- CALM files use `.json` extension (not `.calm`) — per Phase 5 decision
- All packs ship bundled (no runtime download in v1) — community marketplace is v2 (out of scope)
- resolveNodeType() needs extension to look up pack-prefixed types instead of falling back to generic
- NodePalette.svelte needs major refactor from flat list to collapsible sections with pack awareness
- The existing `packages/extensions/` directory is empty and ready for pack implementations

### Claude's Discretion
- Canvas node component rendering style (card vs icon-dominant)
- Exact icon sizing and spacing within nodes
- Pack definition file format and loading mechanism
- How packs register with the nodeTypes map and resolveNodeType()
- MCP server integration with extension pack types
- Icon licensing compatibility research (Azure terms need verification)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTK-01 | Extension pack system loads node types, icons, colors, and default handles dynamically | Pack registry pattern, `nodeTypes` map extension, resolveNodeType() redesign |
| EXTK-02 | Core pack ships with all 9 CALM node types | Wrap existing CALM types in pack definition format |
| EXTK-03 | AWS pack ships with top 20 AWS service types | AWS icon sourcing, namespaced node-type strings, ExtensionNode component |
| EXTK-04 | Kubernetes pack ships with core K8s resources | K8s community icons (Apache-2.0), namespaced types |
| EXTK-05 | AI/Agentic pack ships with AI architecture types | Custom SVG icons (no standard exists), color family design |
| EXTK-06 | GCP pack ships with top 15 GCP service types | GCP icon sourcing, licensing constraints |
| EXTK-07 | Azure pack ships with top 15 Azure service types | Azure icon licensing (restrictive — bundled abstract icons required) |
| EXTK-08 | Node palette organizes types by extension pack with search/filter | Collapsible section refactor, pack badge in search results |
</phase_requirements>

---

## Summary

Phase 7 adds a bundled extension pack system to CalmStudio that overlays domain-specific node types (AWS, GCP, Azure, Kubernetes, AI/Agentic) on top of the existing CALM graph model without breaking CALM JSON validity. The architecture is clean: all extension pack node types use colon-prefixed strings (`aws:lambda`, `k8s:pod`) which are valid arbitrary strings in CALM's node-type field, so no schema changes are needed. The challenge is primarily around (1) how packs register their components into the `nodeTypes` map used by SvelteFlow, (2) rendering a single shared `ExtensionNode.svelte` component that accepts an icon and color family from the pack definition, (3) refactoring `NodePalette.svelte` into collapsible pack sections, and (4) managing the `.calmstudio.json` sidecar file alongside the diagram file.

Icon licensing is the most nuanced concern. Kubernetes icons are Apache 2.0/CC-BY-4.0 (compatible). AWS and GCP icons carry proprietary licenses that technically restrict redistribution; the safe approach for Apache-2.0 compliance is to bundle carefully attributed copies as static SVG assets and document the attribution in NOTICE, or use hand-crafted representative icons for packs with restrictive terms. Azure's icons are explicitly "not open source" with the most restrictive terms — bundled abstract placeholder icons matching Azure color branding are the safe choice until legal review confirms otherwise.

**Primary recommendation:** Build a `PackRegistry` singleton in `packages/extensions/` that holds pack definitions as plain TypeScript objects (type ID → `{ label, icon: string (SVG), color }` entries), extend `resolveNodeType()` to query the registry for prefixed types, and use a single `ExtensionNode.svelte` that reads its icon/color from `data.packMeta`. The palette refactor uses Svelte 5 `$state` for section expand/collapse state, derived from the active diagram's node types for smart defaults.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/svelte | already installed | SvelteFlow nodeTypes map receives pack components | Already the canvas foundation |
| Svelte 5 | already installed | `$state`, `$derived`, component rendering | Project baseline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | already installed | Unit tests for registry, resolveNodeType, sidecar logic | All pure TS modules |

### What NOT to Install
- No additional icon font packages — all icons are inline SVG strings embedded in pack definitions
- No accordion component library (shadcn-svelte, Flowbite) — pure Svelte `$state` bool per section is sufficient and avoids a dependency for a 6-section accordion
- No dynamic import() for pack loading — packs are statically bundled in v1; runtime plugin loading is v2

---

## Architecture Patterns

### Recommended Project Structure
```
packages/extensions/
├── src/
│   ├── index.ts              # Re-exports PackRegistry + all pack defs
│   ├── registry.ts           # PackRegistry singleton: register(), resolve()
│   ├── types.ts              # PackDefinition, NodeTypeEntry interfaces
│   ├── packs/
│   │   ├── core.ts           # Core CALM 9 types (wraps existing built-ins)
│   │   ├── aws.ts            # AWS 30+ types with SVG icon strings
│   │   ├── gcp.ts            # GCP 15 types
│   │   ├── azure.ts          # Azure 15 types
│   │   ├── kubernetes.ts     # K8s ~15 types
│   │   └── ai.ts             # AI/Agentic ~14 types
│   └── icons/
│       ├── aws/              # SVG string exports per service
│       ├── gcp/              # SVG string exports per service
│       ├── k8s/              # SVG string exports per resource
│       └── ai/               # Custom SVG strings
└── package.json

apps/studio/src/lib/canvas/nodes/
└── ExtensionNode.svelte      # Single shared component for all pack nodes

apps/studio/src/lib/io/
└── sidecar.ts                # Read/write .calmstudio.json alongside .json file
```

### Pattern 1: PackDefinition Type
**What:** A pack is a plain TypeScript object that describes its node types, no dynamic loading required.
**When to use:** All packs — both built-in wrapping and extension packs.
**Example:**
```typescript
// packages/extensions/src/types.ts
export interface NodeTypeEntry {
  /** CALM node-type value (without pack prefix for display, full form like 'aws:lambda' for lookup) */
  typeId: string;        // e.g. 'aws:lambda' — the canonical CALM node-type string
  label: string;         // e.g. 'Lambda'
  icon: string;          // Inline SVG string
  color: PackColor;      // Color token set for this node
  description?: string;
}

export interface PackColor {
  bg: string;            // e.g. '#fff8f0'
  border: string;        // e.g. '#ff9900'
  stroke: string;        // e.g. '#e67e00'
  badge?: string;        // e.g. '[AWS]' text shown in search
}

export interface PackDefinition {
  id: string;            // 'aws', 'gcp', 'k8s', 'azure', 'ai', 'core'
  label: string;         // 'AWS', 'GCP', 'Azure', 'Kubernetes', 'AI/Agentic', 'Core CALM'
  version: string;       // '1.0.0'
  color: PackColor;      // Pack-level default color (overridden per node)
  nodes: NodeTypeEntry[];
}
```

### Pattern 2: PackRegistry Singleton
**What:** Module-level singleton that holds all registered packs and resolves prefixed types.
**When to use:** Always — `resolveNodeType()` delegates to this.
**Example:**
```typescript
// packages/extensions/src/registry.ts
const packs = new Map<string, PackDefinition>();

export function registerPack(pack: PackDefinition): void {
  packs.set(pack.id, pack);
}

export function resolvePackNode(calmType: string): NodeTypeEntry | null {
  if (!calmType.includes(':')) return null;
  const [packId, typeKey] = calmType.split(':', 2);
  const pack = packs.get(packId);
  if (!pack) return null;
  return pack.nodes.find(n => n.typeId === calmType) ?? null;
}

export function getAllPacks(): PackDefinition[] {
  return [...packs.values()];
}

export function getPacksForTypes(calmTypes: string[]): string[] {
  const packIds = new Set<string>();
  for (const t of calmTypes) {
    if (t.includes(':')) packIds.add(t.split(':')[0]);
  }
  return [...packIds];
}
```

### Pattern 3: Extending resolveNodeType()
**What:** Modify `nodeTypes.ts` so that pack-prefixed types resolve to `'extension'` (a new key in the `nodeTypes` map).
**When to use:** This is the integration point — projection.ts calls `resolveNodeType()`.
**Example:**
```typescript
// apps/studio/src/lib/canvas/nodeTypes.ts (extended)
import ExtensionNode from './nodes/ExtensionNode.svelte';
import { resolvePackNode } from '@calmstudio/extensions';

export const nodeTypes = {
  actor: ActorNode,
  // ... existing 9 types ...
  generic: GenericNode,
  container: ContainerNode,
  extension: ExtensionNode,   // NEW: all pack nodes use this single component
} as const;

export function resolveNodeType(calmType: string): keyof typeof nodeTypes {
  if (BUILT_IN_TYPES.has(calmType)) return calmType as keyof typeof nodeTypes;
  if (resolvePackNode(calmType) !== null) return 'extension';
  return 'generic';
}
```

### Pattern 4: ExtensionNode.svelte — Single Component for All Pack Nodes
**What:** A single Svelte component for ALL extension pack nodes; it looks up pack metadata from the registry at render time.
**When to use:** All pack-prefixed node types render through this.
**Example:**
```typescript
// apps/studio/src/lib/canvas/nodes/ExtensionNode.svelte (sketch)
<script lang="ts">
  import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';
  import ValidationBadge from './ValidationBadge.svelte';
  import { resolvePackNode } from '@calmstudio/extensions';

  let { id, data, selected }: NodeProps = $props();

  // calmType is stored in data.calmType (existing projection pattern)
  const meta = $derived(resolvePackNode((data as Record<string,unknown>).calmType as string ?? ''));
  const icon = $derived(meta?.icon ?? '');
  const bg = $derived(meta?.color.bg ?? 'var(--node-generic-bg)');
  const border = $derived(meta?.color.border ?? 'var(--node-generic-border)');
  const errorCount = $derived((data as Record<string,unknown>).validationErrors as number ?? 0);
  const warnCount = $derived((data as Record<string,unknown>).validationWarnings as number ?? 0);
</script>
```

### Pattern 5: Sidecar File I/O
**What:** `.calmstudio.json` lives next to `diagram.json`. Read on open, write on first extension node placement.
**When to use:** Every save/open cycle when extension nodes are present.
**Example:**
```typescript
// apps/studio/src/lib/io/sidecar.ts
export interface SidecarData {
  packs: string[];           // ['aws', 'k8s']
  version: string;           // '1.0'
  packVersions: Record<string, string>;  // { aws: '1.0.0', k8s: '1.0.0' }
}

export function sidecarNameFor(diagramName: string): string {
  // diagram.json → .calmstudio.json (in same directory / same handle dir)
  // For browser File System Access API: user opens diagram.json,
  // sidecar is read/written via the same directory handle.
  const base = diagramName.replace(/\.json$/, '').replace(/\.calm$/, '');
  return `${base}.calmstudio.json`;
}

export function detectPacksFromArch(arch: CalmArchitecture): string[] {
  const packs = new Set<string>();
  for (const node of arch.nodes) {
    const t = node['node-type'];
    if (t.includes(':')) packs.add(t.split(':')[0]);
  }
  return [...packs];
}
```

**Browser File System Access API constraint:** The `FileSystemFileHandle` returned by `showOpenFilePicker` gives access to a single file, not a directory. To read/write a sibling sidecar, the implementation needs `showDirectoryPicker()` OR it must request a second file handle via a separate `showOpenFilePicker`/`showSaveFilePicker` call. For v1, the pragmatic approach is:
- **On open:** if sidecar text is not provided (user only opened one file), show the "Extension pack types detected" banner with "Enable packs" button which auto-detects and creates sidecar in memory (no sidecar read from disk)
- **On save:** `saveFile()` also triggers `saveFileSidecar()` which uses `showSaveFilePicker` for the sidecar if File System Access API is available, or Blob-downloads the sidecar alongside the CALM file
- **Simplest v1 path:** store sidecar state in memory derived from the current diagram; only write sidecar to disk on explicit save

### Pattern 6: Collapsible Palette Sections
**What:** Replace the flat `CALM_TYPES` array in `NodePalette.svelte` with pack-aware sections using `$state` booleans for expand/collapse.
**When to use:** NodePalette refactor — the primary UI change in this phase.
**Example:**
```typescript
// Inside NodePalette.svelte (pattern sketch)
import { getAllPacks } from '@calmstudio/extensions';
import { getModel } from '$lib/stores/calmModel.svelte';

const allPacks = getAllPacks();  // Called once at module level

// Smart defaults: expand packs present in current diagram
const activePackIds = $derived(
  new Set(
    getModel().nodes
      .map(n => n['node-type'])
      .filter(t => t.includes(':'))
      .map(t => t.split(':')[0])
  )
);

// Per-pack expand state; initialized from active packs
let expandedPacks = $state<Record<string, boolean>>({});
// ... initialize on mount with activePackIds
```

### Anti-Patterns to Avoid
- **Separate Svelte components per pack node type:** Creates 80+ components all doing the same thing. Use single `ExtensionNode.svelte` that reads pack metadata from the registry.
- **Storing pack metadata in CALM JSON:** CONTEXT.md decision — metadata goes only in `.calmstudio.json` sidecar.
- **Dynamic import() for pack loading:** Bundler static analysis breaks with fully dynamic paths. All packs are statically imported in `packages/extensions/src/index.ts` in v1.
- **Pack prefix in CALM node-type validation schema:** The existing schema has `'node-type': { type: 'string', minLength: 1 }` with no enum restriction — `aws:lambda` passes validation as-is. Do NOT add enum validation.
- **Using colons in Svelte Flow `nodeTypes` map keys:** SvelteFlow `nodeTypes` keys must be plain strings used as React/Svelte component identifiers; colons may cause issues. Map ALL pack types to the single `'extension'` key.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion/collapsible sections | Custom expand/collapse component | Plain `$state` boolean per section + CSS `overflow: hidden` / `max-height` transition | 6 sections, no animation requirements, zero dependencies |
| Icon delivery | Icon font / CDN fetch at runtime | Inline SVG strings in pack definition TS files | Offline-capable, no CORS, tree-shakeable, no flash-of-missing-icon |
| Pack version negotiation | Complex semver resolver | Static version string in sidecar, no compatibility matrix in v1 | v2 marketplace handles versioning; v1 is all-bundled |
| "Which packs are active" detection | Complex state machine | `detectPacksFromArch()` that scans node-type prefixes — O(n) scan at open time | Simple, deterministic, testable |

---

## Common Pitfalls

### Pitfall 1: SvelteFlow `nodeTypes` Map Key Constraints
**What goes wrong:** Using `'aws:lambda'` as a key in the `nodeTypes` map passed to `<SvelteFlow nodeTypes={...} />` — colons in object keys may not be interpreted correctly as SvelteFlow component identifiers internally.
**Why it happens:** SvelteFlow maps node `type` strings to component constructors; the mapping is a plain JS object lookup but the strings may go through transformations.
**How to avoid:** Map ALL pack-prefixed types to a single `'extension'` key in `nodeTypes`. The `resolveNodeType()` function returns `'extension'` for any pack-prefixed type. The actual metadata is read from the PackRegistry inside `ExtensionNode.svelte` using `data.calmType`.
**Warning signs:** Nodes render as generic dashed boxes despite being in the nodeTypes map.

### Pitfall 2: projection.ts Purity Constraint
**What goes wrong:** Importing PackRegistry or `@calmstudio/extensions` from `projection.ts` if that package imports `.svelte.ts` files.
**Why it happens:** `projection.ts` must stay importable by vitest without Svelte transform. The established pattern (Phase 3 decision) is that `projection.ts` imports no `.svelte.ts` files.
**How to avoid:** `packages/extensions/src/registry.ts` must be pure TypeScript with no Svelte imports. `ExtensionNode.svelte` imports the registry, not the other way around.
**Warning signs:** `vitest` failures with "Failed to transform" or "svelte not found in test environment".

### Pitfall 3: Sidecar Handle — File System Access API Sibling File Problem
**What goes wrong:** Assuming you can read/write `.calmstudio.json` as a sibling of `diagram.json` using the same `FileSystemFileHandle` from `showOpenFilePicker`.
**Why it happens:** `FileSystemFileHandle` is scoped to a single file, not a directory. To access siblings you need `FileSystemDirectoryHandle` via `showDirectoryPicker()` or a separate file picker call.
**How to avoid:** In v1, keep sidecar state in memory derived from the diagram's node types. Write the sidecar as a separate Blob download or via a dedicated "Save Sidecar" path. Do not attempt to auto-read sidecar from disk alongside the CALM file.
**Warning signs:** `TypeError: handle.resolve is not a function` or access denied errors when attempting to get parent directory.

### Pitfall 4: Sidecar Not Created for Core-Only Diagrams
**What goes wrong:** Creating `.calmstudio.json` for every diagram, even pure CALM ones.
**Why it happens:** Auto-save logic that doesn't check whether any extension pack nodes exist.
**How to avoid:** Check `detectPacksFromArch(arch).length > 0` before writing sidecar. Only create/update sidecar when extension pack nodes are present.
**Warning signs:** Empty `{ "packs": [], "version": "1.0", "packVersions": {} }` sidecars being created for diagrams with only `actor`, `service`, etc. nodes.

### Pitfall 5: Icon Licensing — Azure Cannot Be Bundled As-Is
**What goes wrong:** Bundling Microsoft Azure SVG icons from the official download into an Apache 2.0 open source project.
**Why it happens:** Microsoft's terms state icons may be used for "architectural diagrams, training materials, or documentation" but "Microsoft reserves all other rights" and they are "not open source."
**How to avoid:** For Azure pack, use hand-crafted abstract SVG icons that follow Azure's color palette (blue #0078D4, purple, etc.) but are not reproductions of Microsoft's official icons. Document that Azure node labels (e.g., "Azure Functions") are descriptive, not trademark claims.
**Warning signs:** Legal review flags CC-BY-ND or proprietary-licensed SVG files in `packages/extensions/`.

### Pitfall 6: AWS Icons Are CC-BY-ND (No Derivatives)
**What goes wrong:** Modifying AWS official icons (resizing viewBox, changing colors) before bundling.
**Why it happens:** AWS Architecture Icons are licensed under CC-BY-ND 2.0 — the "ND" (No Derivatives) clause prohibits modifications.
**How to avoid:** Either bundle official AWS SVGs unmodified with proper attribution in NOTICE file, OR use the `awsicons.dev` library (MIT licensed community redraw). The MIT-licensed community versions are the safer path for a FINOS project.
**Warning signs:** Any SVG that has had its viewBox, colors, or paths modified from the official download.

### Pitfall 7: Pack Registration at Module Load vs. Lazy
**What goes wrong:** Trying to use `resolvePackNode()` before packs have been registered via `registerPack()`.
**Why it happens:** If pack registration happens in a Svelte component's `onMount`, the registry is empty during SSR or during vitest execution.
**How to avoid:** Register all packs at module import time in `packages/extensions/src/index.ts`. When the module is imported, all packs self-register immediately (side effects on import). Do NOT use lazy/dynamic registration.
**Warning signs:** `resolvePackNode('aws:lambda')` returns `null` in tests.

### Pitfall 8: Search UX — Pack Badge Attribution
**What goes wrong:** Search results that show types from multiple packs without attribution, making "Lambda" ambiguous if GCP or Azure have similarly named services.
**Why it happens:** Current palette search just filters a flat array; with 100+ types across 6 packs, collisions are likely.
**How to avoid:** Search results must show a pack badge: `Lambda [AWS]`, `Cloud Run [GCP]`. The badge string comes from the pack's `id` field uppercased.

---

## Code Examples

Verified patterns from the existing codebase:

### Extending nodeTypes Map (nodeTypes.ts pattern)
```typescript
// Existing pattern (nodeTypes.ts):
export const nodeTypes = {
  actor: ActorNode,
  // ... 8 more built-ins ...
  generic: GenericNode,
  container: ContainerNode,
} as const;

// Extended pattern for Phase 7:
import ExtensionNode from './nodes/ExtensionNode.svelte';

export const nodeTypes = {
  actor: ActorNode,
  // ... 8 more built-ins ...
  generic: GenericNode,
  container: ContainerNode,
  extension: ExtensionNode,   // single entry for ALL pack nodes
} as const;
```

### resolveNodeType() Extension
```typescript
// Phase 7 extension (nodeTypes.ts):
export function resolveNodeType(calmType: string): keyof typeof nodeTypes {
  if (BUILT_IN_TYPES.has(calmType)) return calmType as keyof typeof nodeTypes;
  if (calmType.includes(':')) return 'extension';   // pack-prefixed → ExtensionNode
  return 'generic';
}
```

### Existing Node Component Pattern (ServiceNode.svelte)
```typescript
// All existing node components follow this pattern:
let { id, data, selected }: NodeProps = $props();
const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
// data.calmType, data.label, data.calmId all available from projection.ts
```

### DnD Drag Transfer Pattern (DnDProvider + palette)
```typescript
// Existing pattern in NodePalette.svelte:
function handleDragStart(event: DragEvent, type: string) {
  event.dataTransfer.setData('application/calm-node-type', type);
  dnd.setDragType(type);  // store full type string including pack prefix
}
// 'aws:lambda' as the type string flows through DnD → canvas → projection.ts
```

### Module-level $state for Pack Expand State
```typescript
// Consistent with Phase 2 established pattern (theme/history/clipboard stores):
// Pack section expand state lives as $state in NodePalette.svelte (local, not shared store)
let sectionExpanded = $state<Record<string, boolean>>({
  core: true,
  aws: false,
  gcp: false,
  azure: false,
  k8s: false,
  ai: false,
});
```

---

## Icon Licensing Summary

| Pack | Icon Source | License | Apache 2.0 Compatible | Action |
|------|------------|---------|----------------------|--------|
| AWS | awsicons.dev community redraws | MIT | YES | Use MIT community set, attribute in NOTICE |
| GCP | Official download (cloud.google.com/icons) | Proprietary (Google) | NOT CONFIRMED | Use community redraws or hand-craft abstract icons; attribute in NOTICE |
| Azure | Official download (Microsoft) | Proprietary, not open source | NO | Hand-craft abstract SVGs in Azure blue (#0078D4 palette); do not bundle official icons |
| Kubernetes | kubernetes/community repo | Apache-2.0 OR CC-BY-4.0 | YES | Bundle from kubernetes/community/icons/svg, attribute in NOTICE |
| AI/Agentic | Custom-designed | Project Apache-2.0 | YES | Design and own |
| Core CALM | Existing inline SVGs in NodePalette | Project Apache-2.0 | YES | Re-use existing |

**Safest v1 approach:** Use hand-crafted abstract SVG icons for AWS, GCP, and Azure that convey provider identity through color (AWS orange, GCP multi-color, Azure blue) without reproducing trademark artwork. Kubernetes icons are safe to bundle as-is from the official repo. This avoids any licensing risk for FINOS Apache 2.0 submission.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dynamic import() for plugins | Static bundled packs in v1 | Design decision | Simpler bundler story, no lazy loading needed |
| Per-node-type Svelte component for each pack service | Single ExtensionNode.svelte + registry metadata | This phase design | 80+ services → 1 component |
| GenericNode fallback for unknown types | Pack-aware resolveNodeType() + ExtensionNode | This phase | Proper icons/colors for all pack types |

---

## Open Questions

1. **Icon Licensing for GCP**
   - What we know: Official GCP icons are Google-owned; no explicit Apache-compatible license found
   - What's unclear: Whether Google's terms permit redistribution in open source software
   - Recommendation: Default to hand-crafted abstract GCP-branded icons; note in NOTICE. Can upgrade to official icons if FINOS legal review approves.

2. **Sidecar on Round-Trip Import**
   - What we know: On import of a `.json` file with pack-prefixed node types but no sidecar data, the banner flow handles re-detection
   - What's unclear: When exporting CALM JSON, should the sidecar be automatically saved as a companion download?
   - Recommendation: Yes — when `exportAsCalm()` is called and pack nodes exist, also download the `.calmstudio.json` sidecar as a second file. User gets both files.

3. **Pack Registration in `@calmstudio/extensions` vs. App Startup**
   - What we know: Module-level side effects (registerPack calls on import) work but are unconventional
   - What's unclear: Whether the studio app or the extensions package should own the "register all packs" call
   - Recommendation: `packages/extensions/src/index.ts` exports a single `initAllPacks()` function that the studio calls in its startup (e.g., top of `+page.svelte` module). This makes registration explicit and testable.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via vite.config.ts `test` block) |
| Config file | `apps/studio/vite.config.ts` — `test: { include: ['src/**/*.test.ts'], environment: 'jsdom' }` |
| Quick run command | `pnpm --filter studio vitest run` |
| Full suite command | `pnpm --filter studio vitest run && pnpm --filter @calmstudio/calm-core vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTK-01 | `resolvePackNode('aws:lambda')` returns NodeTypeEntry | unit | `pnpm --filter studio vitest run src/tests/extensions.test.ts` | Wave 0 |
| EXTK-01 | `resolveNodeType('aws:lambda')` returns `'extension'` | unit | `pnpm --filter studio vitest run src/tests/nodeTypes.test.ts` | Wave 0 |
| EXTK-01 | `resolveNodeType('actor')` still returns `'actor'` | unit | same | Wave 0 |
| EXTK-01 | `resolveNodeType('custom-thing')` returns `'generic'` | unit | same | Wave 0 |
| EXTK-02 | Core pack registration returns 9 node types | unit | `pnpm --filter @calmstudio/extensions vitest run` | Wave 0 |
| EXTK-03 | AWS pack registration returns >= 20 node types | unit | same | Wave 0 |
| EXTK-04 | K8s pack registration returns >= 14 node types | unit | same | Wave 0 |
| EXTK-05 | AI pack registration returns >= 7 node types | unit | same | Wave 0 |
| EXTK-06 | GCP pack registration returns >= 15 node types | unit | same | Wave 0 |
| EXTK-07 | Azure pack registration returns >= 15 node types | unit | same | Wave 0 |
| EXTK-01 | `calmToFlow` with `aws:lambda` node produces `type: 'extension'` Svelte node | unit | `pnpm --filter studio vitest run src/tests/projection.test.ts` | ✅ (extend existing) |
| EXTK-01 | `flowToCalm` preserves `aws:lambda` as node-type string | unit | same | ✅ (extend existing) |
| EXTK-01 | `detectPacksFromArch` returns correct pack IDs from node-type prefixes | unit | `pnpm --filter studio vitest run src/tests/sidecar.test.ts` | Wave 0 |
| EXTK-01 | `sidecarNameFor('architecture.json')` returns `'architecture.calmstudio.json'` | unit | same | Wave 0 |
| EXTK-08 | Pack badge appears in search results for cross-pack search | manual | n/a — Svelte component test | Wave 0 (if Svelte testing infra added) |

### Sampling Rate
- **Per task commit:** `pnpm --filter studio vitest run`
- **Per wave merge:** `pnpm --filter studio vitest run && pnpm --filter @calmstudio/calm-core vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/extensions/src/registry.test.ts` — covers EXTK-01 through EXTK-07 (registry API + all pack node counts)
- [ ] `apps/studio/src/tests/nodeTypes.test.ts` — covers `resolveNodeType()` with pack-prefixed types
- [ ] `apps/studio/src/tests/sidecar.test.ts` — covers `detectPacksFromArch()`, `sidecarNameFor()`
- [ ] `packages/extensions/` needs vitest in devDependencies and a test script (currently no-op `"test": "echo \"no-op\" && exit 0"`)
- [ ] Framework for extensions package: `pnpm --filter @calmstudio/extensions add -D vitest`

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading: `nodeTypes.ts`, `projection.ts`, `GenericNode.svelte`, `ServiceNode.svelte`, `NodePalette.svelte`, `fileSystem.ts`, `calmModel.svelte.ts`, `validation.ts`, `types.ts`
- `packages/extensions/package.json` — confirmed empty placeholder, ready for implementation
- `apps/studio/vite.config.ts` — confirmed vitest config: `environment: 'jsdom'`, `include: ['src/**/*.test.ts']`
- `.planning/phases/07-extension-packs/07-CONTEXT.md` — all user decisions

### Secondary (MEDIUM confidence)
- [kubernetes/community icons README](https://github.com/kubernetes/community/tree/master/icons) — Apache-2.0 OR CC-BY-4.0 dual license confirmed via WebSearch
- [awsicons.dev](https://awsicons.dev/) — MIT-licensed community AWS icon library confirmed via WebSearch
- [Azure Architecture Icons terms](https://learn.microsoft.com/en-us/azure/architecture/icons/) — "not open source", proprietary terms confirmed via WebFetch
- [AWS Architecture Icons page](https://aws.amazon.com/architecture/icons/) — CC-BY-ND 2.0 referenced in awslabs/aws-icons-for-plantuml LICENSE via WebSearch

### Tertiary (LOW confidence)
- GCP icon licensing — official Google terms not confirmed; treat as proprietary until verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technology is already in use; no new dependencies for core feature
- Architecture: HIGH — patterns derived directly from existing codebase; registry and single-component approach verified against Svelte 5 dynamic component capabilities
- Icon licensing: MEDIUM for K8s (Apache-2.0 confirmed), LOW for GCP (unconfirmed), HIGH for Azure (confirmed not open source), MEDIUM for AWS (CC-BY-ND confirmed for official; MIT alternative confirmed for awsicons.dev)
- Pitfalls: HIGH — derived from established Phase decisions and codebase constraints

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (stable tech stack; icon licensing terms change rarely)
