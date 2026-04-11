# Phase 7: Extension Packs - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Dynamic extension pack system that adds AWS, GCP, Azure, Kubernetes, and AI/Agentic node types to the diagramming tool. Each pack provides domain-specific node types with official provider icons and colors, organized by pack in the palette. All extension pack nodes produce valid CALM JSON output using custom node-type strings. Extension pack metadata is stored in a `.calmstudio.json` sidecar file, never in the `.json` CALM file.

</domain>

<decisions>
## Implementation Decisions

### Palette organization
- Collapsible sections per pack (Core CALM, AWS, GCP, Azure, Kubernetes, AI/Agentic)
- All sections in one scrollable list — similar to VS Code sidebar sections
- Smart default expansion: expand packs used in the current diagram; empty diagrams show only Core CALM expanded
- Search filters across all packs — results show a pack badge (e.g., [AWS], [K8s]) for attribution
- Flat list within each pack (alphabetical) — no sub-categories
- Custom node input stays at bottom of palette

### Node visuals & icons
- Official cloud provider icon SVGs (AWS Architecture Icons, GCP icons, Azure icons, K8s community icons)
- AI/Agentic pack uses custom icons (no standard set exists)
- Per-pack color families matching provider branding (AWS orange, K8s blue, Azure blue, GCP multi-color, AI/Agentic custom)
- Core CALM nodes keep their current desaturated color styling — no changes
- Canvas node rendering: Claude's discretion on card vs icon-dominant layout

### Pack content scope
- **AWS**: 30+ services — comprehensive coverage including Lambda, S3, DynamoDB, ECS, EKS, SQS, SNS, API Gateway, RDS, Aurora, CloudFront, Route 53, IAM, VPC, EC2, Fargate, EventBridge, Step Functions, Cognito, ElastiCache, Kinesis, Redshift, SageMaker, Glue, and more
- **GCP**: Top 15 services per EXTK-06 requirement
- **Azure**: Top 15 services per EXTK-07 requirement
- **Kubernetes**: ~15 core workload + networking types (Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob, Service, Ingress, ConfigMap, Secret, PersistentVolume, PVC, Namespace, HPA)
- **AI/Agentic**: ~14 types — the 7 from requirements (LLM, Agent, Orchestrator, Vector Store, Tool, Memory, Guardrail) plus Embedding Model, RAG Pipeline, Prompt Template, API Gateway (AI), Human-in-the-Loop, Knowledge Base, Eval/Monitor

### Node type namespacing
- Colon-separated pack prefix in CALM JSON node-type field: `aws:lambda`, `k8s:pod`, `ai:agent`, `gcp:cloud-run`, `azure:functions`
- Parsing: split on ":" → pack name + type name
- Core CALM types remain unprefixed (actor, system, service, etc.)

### Sidecar file (.calmstudio.json)
- Auto-created alongside the `.json` CALM file when user places the first extension pack node
- Contains: enabled pack list, schema version, pack versions
- Example: `{ "packs": ["aws", "k8s"], "version": "1.0", "packVersions": { "aws": "1.0.0", "k8s": "1.0.0" } }`
- Not created for pure CALM-only diagrams

### Missing sidecar handling
- When opening a `.json` CALM file with extension pack node types but no `.calmstudio.json`: render unknown types as GenericNode (existing behavior)
- Show info banner: "Extension pack types detected. [Enable packs] [Dismiss]"
- "Enable packs" auto-detects packs from node-type prefixes, creates sidecar, re-renders with proper icons

### Claude's Discretion
- Canvas node component rendering style (card vs icon-dominant)
- Exact icon sizing and spacing within nodes
- Pack definition file format and loading mechanism
- How packs register with the nodeTypes map and resolveNodeType()
- MCP server integration with extension pack types
- Icon licensing compatibility research (Azure terms need verification)

</decisions>

<specifics>
## Specific Ideas

- CALM files use `.json` extension (not `.calm`) — per Phase 5 decision
- All packs ship bundled (no runtime download in v1) — community marketplace is v2 (out of scope)
- resolveNodeType() needs extension to look up pack-prefixed types instead of falling back to generic
- NodePalette.svelte needs major refactor from flat list to collapsible sections with pack awareness
- The existing `packages/extensions/` directory is empty and ready for pack implementations

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/extensions/` — Empty package directory ready for extension pack code
- `GenericNode.svelte` — Current fallback for unknown node types; extension pack nodes may use a new ExtensionNode component or GenericNode with icon injection
- `nodeTypes.ts` — Maps CALM type strings to Svelte components; needs extension for pack-prefixed types
- `resolveNodeType()` — Uses Set for O(1) built-in lookup, returns 'generic' for unknowns; needs pack-aware resolution
- `NodePalette.svelte` — Current flat list with search and DnD; needs collapsible sections refactor

### Established Patterns
- Custom Svelte Flow nodes receive data via `data` prop (e.g., `data.calmType`, `data.validationErrors`)
- `projection.ts` maps CALM JSON → Svelte Flow nodes using `resolveNodeType()`; extension types need same path
- Module-level `$state` runes for reactive stores (history, clipboard, theme, validation)
- `DnDProvider.svelte` provides drag context for palette → canvas

### Integration Points
- `CalmCanvas.svelte` line 411: `{nodeTypes}` prop — needs to include extension node components
- `projection.ts` line 38: `resolveNodeType(cn['node-type'])` — entry point for pack-aware resolution
- `CodePanel.svelte` — references "extension packs" in calmscript toggle; may need awareness of pack types
- `packages/mcp-server/` — MCP tools that create/modify nodes need to support pack-prefixed types
- Validation engine — extension pack node types must pass `calm validate` as custom types

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-extension-packs*
*Context gathered: 2026-03-12*
