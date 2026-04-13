# CalmStudio

Visual CALM architecture editor. SvelteKit (Svelte 5), TypeScript strict, pnpm monorepo.

## Structure
- `packages/calm-core/` — CALM types, validation
- `packages/extensions/` — Node type packs (core, fluxnova, ai, aws, gcp, azure, k8s)
- `packages/calmscript/` — DSL compiler
- `packages/mcp-server/` — MCP server (21 tools)
- `apps/studio/src/lib/` — canvas, editor, io, layout, palette, properties, stores, validation, governance, templates

## Commands
`pnpm dev` | `pnpm build` | `pnpm test` | `pnpm typecheck` | `pnpm lint`

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

**Relationships:** `connects`, `interacts`, `deployed-in`, `composed-of`, `options`

**Protocols:** `HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

**Required:** Nodes need `unique-id`, `node-type`, `name`, `description`. Relationships need `unique-id`, `relationship-type`. Controls need `description`, `requirements[]`.

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
