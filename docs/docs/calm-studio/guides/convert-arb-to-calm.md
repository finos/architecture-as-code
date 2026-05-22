---
title: Convert ARB markdown to CALM
description: Convert FINOS Labs–style AI reference architecture markdown into CALM 1.2 architecture using the CALMStudio MCP server, no in-tree LLM dependency.
---

# Convert ARB markdown to CALM

How to convert a [FINOS Labs–style AI reference architecture](https://github.com/finos-labs/ai-reference-architecture-library) markdown document into a valid CALM 1.2 architecture using the CALMStudio MCP server.

The conversion is driven by the AI coding agent the operator is already using (Claude Code, Codex, Cursor, …). No LLM logic lives in CALMStudio itself — the agent reads the source markdown, performs extraction in its own session, and calls existing MCP tools to assemble the CALM artifact.

This guide is also available to AI agents through the `read_calm_guide` MCP tool with `topic="arb-conversion"`.

## When to use this guide

You have a markdown document describing an AI architecture (multi-agent, RAG, agentic, …) and you want a valid CALM 1.2 `.calm.json` with the FINOS AIGF governance overlay attached, ready to load into CALMStudio for visual review.

## Prerequisites

- CALMStudio MCP server configured in your runtime
- Working directory configured via `CALM_HOME` (or pass absolute file paths)
- Read access to the source URL or local file

## Step-by-step

1. **Read the source markdown directly.** Identify the layered structure. ARB documents typically follow: User Interaction → Gateway → Agents → Knowledge → LLM → MCP → Evaluation → Observability.

2. **Plan the node list before any MCP call.** Use the [layer-to-node-type mapping](#layer-to-node-type-mapping) below. Use kebab-case `unique-id`s.

3. **Call `create_architecture`** with the target file path.

4. **Call `batch_create_nodes`** with all components in one payload. AIGF governance decorators auto-attach when AI nodes are present — no manual step required.

5. **Call `add_relationship`** for each connection visible in the source. See the [relationship patterns](#relationship-patterns) below.

6. *(Optional)* For nodes whose source document mentions explicit governance posture, attach a domain-oriented control to that node using `update_node` with a `controls` field. See the [recommended control keys](#recommended-control-keys) below.

7. **Call `finalize_architecture`.** This validates the result, tops up the AIGF decorator, and renders an ELK SVG. Inspect the JSON summary; iterate via `update_node`, `update_relationship`, etc. until `validation.errors` is `0`.

8. **Open the resulting `.calm.json`** in CALMStudio ([calmstudio.vercel.app](https://calmstudio.vercel.app/) or local dev) to review the rendered architecture.

## Layer-to-node-type mapping

| ARB layer / concept           | CALM node type            |
|-------------------------------|---------------------------|
| End user                      | `actor`                   |
| Web / mobile front end        | `webclient`               |
| API gateway, request routing  | `ai:api-gateway`          |
| Input/output safety filters   | `ai:guardrail`            |
| Worker agents                 | `ai:agent`                |
| Coordinator / supervisor      | `ai:orchestrator`         |
| Vector / semantic store       | `ai:vector-store`         |
| Structured policy KB          | `ai:knowledge-base`       |
| Retrieval pipeline            | `ai:rag-pipeline`         |
| Foundation / inference model  | `ai:llm`                  |
| Embedding model               | `ai:embedding-model`      |
| Reusable prompt template      | `ai:prompt-template`      |
| Working / persistent memory   | `ai:memory`               |
| Callable function or API      | `ai:tool`                 |
| MCP server endpoint           | `ai:mcp-server`           |
| Evaluation, scoring           | `ai:eval-monitor`         |
| Telemetry, tracing, metrics   | `ai:observability`        |
| Human approval / review       | `ai:human-in-the-loop`    |
| Generic supporting service    | `service`                 |

## Relationship patterns

| Pattern                         | Type           | Example                          |
|---------------------------------|----------------|----------------------------------|
| API call between services       | `connects`     | `webclient` → `ai:api-gateway`   |
| Agent invokes tool / LLM        | `interacts`    | `ai:agent` → `ai:llm`            |
| Layer is sub-decomposable       | `composed-of`  | `ai:mcp-server` → `ai:tool`      |
| Component runs in environment   | `deployed-in`  | `ai:agent` → `ecosystem`         |
| Configuration alternative       | `options`      | A/B variants                     |

`connects` should carry a `protocol` field (`HTTPS`, `gRPC`, `JDBC`, …).

## Recommended control keys

CALM 1.2 control keys are **domain-oriented**, not framework-prefixed. Framework IDs go in `config-url`.

| Node type             | Control key              | When to apply                           |
|-----------------------|--------------------------|-----------------------------------------|
| `ai:mcp-server`       | `mcp-security`           | always — capability authz               |
| `ai:api-gateway`      | `edge-protection`        | always                                  |
| `ai:guardrail`        | `input-output-validation`| always                                  |
| `ai:tool`             | `tool-isolation`         | when the tool has side effects          |
| `ai:memory`           | `data-residency`         | when memory persists across sessions    |
| `ai:observability`    | `ai-telemetry`           | always                                  |

The `requirement-url` field of the control points at the AIGF mitigation page (mi-XX). `config-url` is optional — use to reference framework-specific guidance such as NIST-AI-600-1 §5.2.

## Worked example

The FINOS Labs multi-agent reference architecture
(`Library/reference-architecture/multi-agent/ma_ref_arch_jan_2026.md`) maps to **15 nodes** covering all 8 ARB layers. A canonical converted artifact ships in the `calm-core` test fixtures as `multi-agent-arb-jan-2026.calm.json` and is loadable directly in [calmstudio.vercel.app](https://calmstudio.vercel.app/).

## Troubleshooting

- **Validation error: dangling relationship reference** — every `source` and `destination` `unique-id` must exist as a node. Add nodes before relationships.
- **AIGF decorator not appearing** — confirm the node-type starts with `ai:`. Non-AI nodes do not generate the overlay.
- **SVG render fails** — try `direction: 'RIGHT'` for wide architectures; ELK has limits on dense layouts.
