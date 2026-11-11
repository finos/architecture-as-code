# CalmStudio

The packages that remain from the retired CALM Studio app. TypeScript strict. The docs diagram
embed and the node packs are in `calm-diagram/` and `calm-docusaurus-plugin/` at the repo root.

## Structure
Each entry below is a root npm workspace, matched by `calm-studio/packages/*` in the root
`package.json`. Run npm commands from the repo root.

- `packages/calm-core/` (`@calmstudio/calm-core`) — CALM types, validation
- `packages/mcp-server/` (`@calmstudio/mcp`) — MCP server (20 tools)
- `packages/github-action/` (`@calmstudio/github-action`) — GitHub Action build target
- `packages/vscode-extension/` (`calmstudio`) — VSCode extension build target

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

The flat shape (`'relationship-type': 'connects'` + sibling `source`/`destination` strings) was a **local CalmStudio divergence** — it has **never** been valid in any published CALM release. The nested `relationship-type` object above is canonical across CALM 1.0/1.1/1.2 (identical in the 1.1 and 1.2 `core.json`, see the `calm-schema-1.1` and `calm-schema-1.2` npm aliases); CalmStudio was brought onto it in #2550/#2553. Use the variant accessors `getRelationshipVariant`, `getConnectsEndpoints`, `getContainerAndNodes`, `getActorAndNodes`, `getReferencedNodeIds` from `@calmstudio/calm-core` to traverse relationships generically.

**Protocols:** `HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

**Required:** Nodes need `unique-id`, `node-type`, `name`, `description`. Relationships need `unique-id`, `relationship-type`. Controls need `description`, `requirements[]`.

## Packs
`PackDefinition` in `calm-diagram/src/packs/definitions/`. Register via `initAllPacks()` from `@finos/calm-diagram/packs`.

## AIGF
Docs: `docs/AIGF_CATALOGUE.json`, `docs/CALM_1.2_CONTROLS_SCHEMA.md`, `docs/REQ_fluxnova_aigf_integration.md`. Follow control rules above.

## Conventions
- TS strict, no `any`. kebab-case files, PascalCase components/types.
- Conventional commits.

## Refs
- CALM: https://calm.finos.org/release/1.2/ | https://github.com/finos/architecture-as-code
- AIGF: https://air-governance-framework.finos.org/ | https://github.com/finos/ai-governance-framework
- Reference impl: https://github.com/karlmoll/codegen_sandbox/pull/7
