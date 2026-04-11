# Phase 15: OpenGRIS Scaler.toml Exporter and Deployment Templates - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Export CALM architectures containing OpenGRIS nodes as Scaler.toml configuration files, and ship 4 starter templates for common OpenGRIS deployment patterns. The exporter is a new export format option in the existing export dropdown. Templates are registered in the template registry under a new "OpenGRIS" category.

</domain>

<decisions>
## Implementation Decisions

### TOML Export Trigger & UX
- Auto-detect: "Export as Scaler.toml" only appears in the export dropdown when the canvas contains `opengris:` nodes. Same pattern as AIGF decorator (only generates when AI nodes detected).
- Single unified Scaler.toml output — one file with all sections ([scheduler], [cluster], [object_storage_server], etc.). Matches OpenGRIS documentation convention.
- Annotated with inline comments explaining each section and key fields.
- Lives in the existing export dropdown alongside JSON, SVG, PNG. No new UI elements.

### Config Values Source
- Custom metadata on nodes — users set key-value pairs in the existing custom metadata panel. e.g., scheduler node gets `scheduler_address: tcp://127.0.0.1:8516`.
- Smart defaults — export fills in OpenGRIS defaults for missing values. Comments mark which values are defaults vs user-set.
- Auto-derive addresses from topology — if a worker connects to scheduler via edge, auto-assign matching addresses. Reduces manual metadata entry.
- Match TOML keys directly — metadata key `scheduler_address` maps to TOML `scheduler_address`. No translation layer. Users use the exact TOML field names.

### Worker Manager Type Mapping
- Custom metadata key `manager_type` on `opengris:worker-manager` nodes. Values: `native`, `ecs`, `symphony`, `aws_hpc`. Defaults to `native` if not set.
- Templates pre-fill `manager_type` on their worker-manager nodes.
- Support multiple worker managers in one TOML (waterfall scaling) — if canvas has multiple `opengris:worker-manager` nodes, generate multiple TOML sections plus waterfall policy in [scheduler].
- Waterfall priority order via `priority` metadata key (1, 2, 3...). Lower number = higher priority. Templates pre-fill this.

### Template Selection
- Ship all 4 templates: Local Dev Cluster, Market Risk (waterfall), Scientific Research (HPC Batch), Multi-Cloud (native + ECS + Symphony).
- New "OpenGRIS" category in Template Picker (alongside "FluxNova").
- Fully turnkey: templates include all metadata (addresses, ports, capabilities, manager_type, priority). Load template → Export Scaler.toml → working config.
- Add an `opengris-local-cluster.calm.json` demo file to `apps/studio/static/demos/` for welcome screen access.

### Claude's Discretion
- Exact default values for each TOML field (use OpenGRIS documentation defaults)
- Address auto-derivation algorithm (port assignment strategy for multi-component topologies)
- Template node layout positions (use ELK auto-layout or hand-position)
- TOML generation library choice (hand-craft strings or use a library)

</decisions>

<specifics>
## Specific Ideas

- The Scaler.toml format is flat sections — not deeply nested. Each CalmStudio node maps directly to a TOML section: `opengris:scheduler` → `[scheduler]`, `opengris:cluster` → `[cluster]`, etc.
- OpenGRIS Scaler uses Cap'n Proto over ZeroMQ — protocols in CALM edges should reflect this.
- Market Risk template should demonstrate the waterfall scaling pattern: native workers handle burst locally first, then overflow to cloud (ECS) — this is a signature OpenGRIS feature.
- Templates should be immediately exportable to Scaler.toml — the "load template, click export" workflow should produce a valid config file.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `export.ts`: Established `exportAsCalm`, `exportAsSvg`, `exportAsPng` pattern — `exportAsScalerToml` follows the same blob → `downloadDataUrl` approach
- `registry.ts`: Template registration via `registerTemplate()`, categories via `_template.category`, `initAllTemplates()` initialization
- `sidecar.ts`: `detectPacksFromArch()` — pack detection pattern can be reused to check for OpenGRIS nodes
- Custom metadata panel: Already supports arbitrary key-value pairs on any node

### Established Patterns
- Export functions are pure (take data, return void with side-effect download)
- Templates are static JSON imports registered at module init
- AIGF decorator conditional generation pattern — generate only when relevant nodes exist

### Integration Points
- `export.ts` — add `exportAsScalerToml` function
- `registry.ts` — add OpenGRIS template imports and registration in `initAllTemplates()`
- `apps/studio/src/lib/templates/` — new JSON template files
- `apps/studio/static/demos/` — new demo file
- Toolbar export dropdown — conditional "Scaler.toml" option

</code_context>

<deferred>
## Deferred Ideas

- Docker-compose.yml generation alongside Scaler.toml — future phase
- Kubernetes manifests generation — future phase
- Live cluster topology visualization (connect to running Scaler and render live state) — separate tool entirely

</deferred>

---

*Phase: 15-opengris-scaler-toml-exporter-and-deployment-templates*
*Context gathered: 2026-03-23*
