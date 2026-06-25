# Multi-Agent Reference Architecture — CALM document series

An AIGF-aligned reference architecture for governed multi-agent AI systems,
expressed as a **C4-style series of linked CALM 1.2 documents** rather than one
monolithic file. The split keeps three concerns separate and each document
deployable and independently valid.

## Tiers

| Tier | Purpose | Files |
|---|---|---|
| **1 — Context** | One-screen overview: the system and its eight layers. | `context.arch.json` |
| **2 — Layer elaboration** | IaC-grade decomposition of each layer: deployable components, `deployed-in` topology, `controls`. Each has a loose `*.pattern.json` contract. | `<layer>.arch.json` + `<layer>.pattern.json` (×8) |
| **3 — Instantiation** | A concrete loan-origination system that *conforms to* the Tier-2 layer patterns and fills in real services. | `loan/*.instance.arch.json` |

The eight layers: `user-interaction`, `agent-gateway`, `agent`, `knowledge`,
`llm`, `mcp`, `evaluation`, `observability`.

## How the tiers link (read this first)

The links are expressed with CALM's native `node.details`:
- each Tier-1 layer node carries `details.detailed-architecture` (→ its Tier-2
  arch) and `details.required-pattern` (→ its Tier-2 pattern).

**These links are convention-only — no CALM CLI command or Studio feature
resolves or walks them.** Conformance is enforced separately: a concrete
architecture declares `"$schema"` = its layer pattern's `$id`, and
`calm validate -a arch.json -p pattern.json` (plain JSON-Schema) checks it.
`url-mapping.json` maps the canonical `$schema`/ref URLs to the local files so
each document self-validates.

## Conventions (must hold — nothing enforces them)

- **Stable ids across tiers.** A layer's `unique-id` in Tier 1 is reused as the
  anchor (`system`) node in its Tier-2 arch and Tier-3 instance.
- **Loose patterns.** Each `*.pattern.json` only pins the layer anchor id and the
  layer's defining node-types (`contains`), so detailed archs may add nodes.
- **Externals are `system`, not `ai:mcp-server`.** Third-party SaaS (credit
  bureau, KYC, e-signature, disbursement) is connected, not deployed; only
  self-hosted MCP servers keep `ai:mcp-server`.
- **Deployment boundaries.** Each Tier-2 layer places its components in a
  `deployed-in` boundary node (e.g. `control-plane`, `agent-plane`, `data-plane`).
- **Each document declares its C4 level** in `metadata.c4-level`
  (`context`/`container`/`component`) so a viewer reads a stable level rather than
  inferring one from how the user navigated in.
- **Cross-document id reuse is deliberate and safe.** Anchor and boundary ids
  (`agent-layer`, `agent-runtime`, `agent-plane`, `control-plane`, …) recur across
  documents on purpose — that's how a node links to its detailed elaboration. Each
  document validates independently, so the reuse is fine today; it would only
  collide if a future tool flattened the tiers into one graph (no such tool
  exists).

## Validate

```bash
# build the CLI once: (from repo root) npm run build:cli
./validate.sh
```

Validates every pattern against the meta-schema and every architecture against
its declared pattern. Regenerate the series by running `generate.mjs` in this
directory (`node generate.mjs`).
