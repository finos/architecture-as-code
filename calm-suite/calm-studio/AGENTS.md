# CalmStudio

Visual CALM architecture editor. SvelteKit (Svelte 5), TypeScript strict, npm workspaces monorepo.

## Structure
- `packages/calm-core/` — CALM types, validation
- `packages/extensions/` — Node type packs (core, fluxnova, ai, aws, gcp, azure, k8s)
- `packages/calmscript/` — DSL compiler
- `packages/mcp-server/` — MCP server (21 tools)
- `apps/studio/src/lib/` — canvas, editor, io, layout, palette, properties, stores, validation, governance, templates

## Commands
`npm run dev --workspace=@calmstudio/studio` | `npm run build --workspace=@calmstudio/studio` | `npm run test --workspace=@calmstudio/studio` | `npm run typecheck --workspace=@calmstudio/studio` (from repo root)

## CALM 1.2 Rules

All output must conform to CALM 1.2. These are non-negotiable:

**Controls:**
- Keys are **domain-oriented** (`edge-protection`, `mcp-security`), NOT framework-prefixed (`aigf-*`, `nist-*`). Framework IDs go in `config-url` only.
- Attach controls to **individual nodes/relationships directly**. Not at document level with `appliesTo`.
- **No risk/threat annotations on nodes.** Risks belong in control config files (`threats-mitigated`), not on architecture elements.
- Key regex: `^[a-zA-Z0-9-]+$]`. `requirement-url` required; `config-url`/`config` optional.
- Multiple mitigations = multiple entries in `requirements[]`.
- **Decorators** = cross-cutting overlays (scores, mappings). **Controls** = node-level enforcement.

**Node types:** `actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`. Extensions: `fluxnova:engine`, `ai:llm`, etc.

**Relationships** — nested form per CALM 1.2 meta-schema. `relationship-type` is an **object** keyed by variant. Exactly one variant key is present:

```json
{ "unique-id": "...", "relationship-type": { "connects": { "source": { "node": "..." }, "destination": { "node": "..." } } } }
{ "unique-id": "...", "relationship-type": { "composed-of": { "container": "...", "nodes": ["..."] } } }
{ "unique-id": "...", "relationship-type": { "interacts": { "actor": "...", "nodes": ["..."] } } }
{ "unique-id": "...", "relationship-type": { "deployed-in": { "container": "...", "nodes": ["..."] } } }
{ "unique-id": "...", "relationship-type": { "options": [ ... ] } }
```

The legacy flat shape (`'relationship-type': 'connects'` + sibling `source`/`destination` strings) is **not valid CALM 1.2** and was removed in #2550. Use the variant accessors `getRelationshipVariant`, `getConnectsEndpoints`, `getContainerAndNodes`, `getActorAndNodes`, `getReferencedNodeIds` from `@calmstudio/calm-core` to traverse relationships generically.

**Protocols:** `HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

**Required:** Nodes need `unique-id`, `node-type`, `name`, `description`. Relationships need `unique-id`, `relationship-type`. Controls need `description`, `requirements[]`.

## Decorators (#2551)

CALM 1.2 [decorators](https://calm.finos.org/core-concepts/decorators) attach cross-cutting overlays (governance, threat models, regulatory mappings) to architecture elements via `applies-to[]`. Studio supports them via:

- **Types** in `@calmstudio/calm-core/decorators`: `CalmThreatModelDecorator`, `CalmControlCatalogDecorator`, `CalmThreat`, `CalmControlEntry`.
- **Helpers**: `getDecoratorsByType`, `getDecoratorsForNode`, `getThreatsForNode`, `getControlById`, `isThreatModelDecorator`, `isControlCatalogDecorator`.
- **Reactive store**: `apps/studio/src/lib/stores/decorators.svelte.ts` (`threatsForNode`, `nodeHasThreats`, `controlById`, `buildNodeThreatIndex`).
- **UI**: per-node "Threats" tab in `PropertiesPanel.svelte` → `NodeThreats.svelte`; canvas red triangle badge via `ThreatBadge.svelte` on every node type.
- **MCP tools** (`packages/mcp-server/src/tools/decorators.ts`): `get_decorators`, `get_decorators_for_node`, `get_threats_for_node`, `get_control`, `add_threat_decorator`.
- **Sidecar I/O**: `<arch>.threats.calm.json` companion file for `type: "threat-model"` and `type: "control-catalog"` decorators. Loader merges on read; export splits back out. Keeps the architecture file compatible with strict CALM 1.2 validators (decorators field is not in upstream `core.json` root yet).

Other decorator types (`aigf-governance`, `deployment`, …) remain inline in the architecture file's `decorators[]` array.

## Packs
`PackDefinition` in `packages/extensions/src/packs/`. Register via `initAllPacks()` in `index.ts`.

## AIGF
Docs: `docs/AIGF_CATALOGUE.json`, `docs/CALM_1.2_CONTROLS_SCHEMA.md`, `docs/REQ_fluxnova_aigf_integration.md`. Follow control rules above.

## Conventions
- TS strict, no `any`. Svelte 5 runes only. kebab-case files, PascalCase components/types.
- `git commit -s` (DCO). Conventional commits.

## Refs
- CALM: https://calm.finos.org/release/1.2/ | https://github.com/finos/architecture-as-code
- AIGF: https://air-governance-framework.finos.org/ | https://github.com/finos/ai-governance-framework
- Reference impl: https://github.com/karlmoll/codegen_sandbox/pull/7
