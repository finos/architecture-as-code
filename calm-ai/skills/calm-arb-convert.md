---
name: calm-arb-convert
description: Use when converting a FINOS AI Reference Architecture (ARB) markdown document, URL, or diagram into CALM JSON using calmstudio-mcp tools. Triggered when user provides an architecture source and wants a .calm.json output file.
---

# CALM ARB Conversion Guide

> **Audience:** Windsurf, Cursor, Codex, VS Code Copilot, and any AI tool without the Claude Code `read_calm_guide` MCP tool.  
> **Claude Code users:** invoke the `calm-arb-convert` skill instead — it's pre-loaded with the same rules.

Converts a FINOS AI Reference Architecture (ARB) document into spec-compliant **CALM 1.2 JSON** with `ai:*` node types, threat-model decorators, and AIGF governance overlay via `calmstudio-mcp`.

---

## Workflow — STRICT ORDER, no skipping

```
1. Read this entire guide (you are doing this now)
2. Fetch the architecture document
3. Fetch the threat model (if URL provided — MANDATORY, parallel with step 2)
4. Write a node mapping plan — verify every type against the tables below
5. create_architecture  (all nodes + relationships, one call)
6. add_threat_decorator (one per layer group, all parallel)
7. finalize_architecture (validates + auto-attaches AIGF)
8. export_calm          (to destination path)
```

**Steps 4 must produce a written mapping before any MCP call.**  
**Step 3 is mandatory when a threat model URL is present — not optional.**

---

## CALM Core Node Types (9 total)

| Type | Use for |
|---|---|
| `actor` | End user, external system initiating requests |
| `system` | Architectural layer, logical bounded context |
| `service` | Registry, catalog, stateful internal service |
| `database` | Relational DB, NoSQL, cache |
| `network` | Load balancer, VPN, firewall, CDN |
| `webclient` | Web / mobile frontend |
| `ecosystem` | Execution runtime/sandbox (e.g. Unified Agent Runtime) |
| `ldap` | LDAP directory, identity provider |
| `data-asset` | Files, file system, datasets, S3 buckets |

**`container` and `component` do NOT exist in CALM. Using either = wrong.**

---

## AI / Agentic Node Types (`ai:*` prefix)

| ARB concept | CALM type |
|---|---|
| API gateway, request router | `ai:api-gateway` |
| Guardrails, safety filter, policy enforcer | `ai:guardrail` |
| Supervisor / coordinator agent | `ai:orchestrator` |
| Worker / specialist / tool-invoking agent | `ai:agent` |
| Vector / semantic store | `ai:vector-store` |
| Knowledge base, document store | `ai:knowledge-base` |
| RAG retrieval pipeline | `ai:rag-pipeline` |
| LLM / inference model | `ai:llm` |
| Embedding model | `ai:embedding-model` |
| Short-term or long-term memory | `ai:memory` |
| Callable tool (shell, I/O, web search, MCP client) | `ai:tool` |
| MCP server endpoint | `ai:mcp-server` |
| Eval monitor, feedback engine, adaptive learning | `ai:eval-monitor` |
| Logs, traces, metrics, correlation engine | `ai:observability` |
| Human approval / review checkpoint | `ai:human-in-the-loop` |

**AIGF governance overlay auto-attaches when `finalize_architecture` detects ≥1 `ai:*` node.**  
If `aigf.decoratorAttached: false` after finalize → you have no `ai:*` nodes → fix your types.

---

## ARB Layer → CALM Node Type Mapping

| ARB Layer | Layer node type | Component node types |
|---|---|---|
| User Interaction | `system` | `webclient`, `actor`, `ai:human-in-the-loop` |
| Agent Gateway | `system` | `ai:api-gateway`, `ai:guardrail`, `network` |
| Agent | `system` | `ai:orchestrator`, `ai:agent`, `ai:tool`, `ai:mcp-server` |
| Knowledge | `system` | `ai:knowledge-base`, `ai:vector-store`, `ai:rag-pipeline`, `database`, `ai:embedding-model` |
| LLM | `system` | `ai:llm` |
| MCP | `system` | `ai:mcp-server`, `ai:tool`, `service` |
| Evaluation | `system` | `ai:eval-monitor` |
| Observability | `system` | `ai:observability`, `database`, `service` |
| Unified Agent Runtime | `ecosystem` | (components deploy into it via `deployed-in`) |
| Enterprise IDP | `ldap` | — |
| Human reviewers | `actor` | — |

---

## Relationship Types

| Pattern | Type | Notes |
|---|---|---|
| Layer contains components | `composed-of` | Structural nesting |
| Agent invokes LLM or tool | `interacts` | Actor-to-node |
| API call between services | `connects` | Add `protocol` field |
| Component runs in runtime | `deployed-in` | Inside ecosystem |
| User interacts with app | `interacts` | Human actor |

---

## Threat Model Decorator Pattern

One `add_threat_decorator` call per architectural layer. Run all calls in parallel.

```json
{
  "unique-id": "tm-<layer>",
  "type": "threat-model",
  "applies-to": ["layer-node-id", "component-a", "component-b"],
  "data": {
    "framework": "FINOS Multi-Agent Reference Architecture Threat Model",
    "version": "Apr 2026",
    "layer": "Layer Name",
    "threats": [
      {
        "id": "T-XX-01",
        "name": "Threat Name",
        "description": "...",
        "mitigations": "...",
        "controls": ["C1", "C2"],
        "affected-nodes": ["specific-node-id"],
        "section": "Layer Name"
      }
    ]
  }
}
```

---

## Fetching GitHub Documents

```bash
# GitHub markdown — use gh CLI (avoids auth/truncation issues)
gh api repos/<owner>/<repo>/contents/<path> --jq '.download_url' | xargs curl -sL > /tmp/doc.md
```

---

## Pre-export Checklist

Before calling `export_calm`:

- [ ] `finalize_architecture` returns `errors: 0, warnings: 0`
- [ ] `aigf.decoratorAttached: true`
- [ ] Threat decorators attached (one per layer when TM provided)
- [ ] No `container` or `component` node types in the output
- [ ] Export destination path confirmed with user

---

## Red Flags — STOP immediately

| Situation | Action |
|---|---|
| About to call `create_architecture` without reading this guide | STOP — read it first |
| Using `node-type: "container"` or `"component"` | STOP — use mapping table above |
| Threat model URL given, not yet fetched | STOP — fetch it now (parallel with arch doc) |
| `aigf.decoratorAttached: false` after finalize | Fix node types — no `ai:*` nodes found |
| About to `export_calm` before `finalize_architecture` | STOP — finalize first |
| Node mapping plan not written before any MCP call | STOP — write the plan first |

---

## MCP Server Setup

This repo ships `calmstudio-mcp` at `calm-suite/calm-studio/packages/mcp-server/`.

**Build (if not already built):**
```bash
cd calm-suite/calm-studio
npm install
npm run build --workspace packages/mcp-server
```

**Claude Code CLI (user scope):**
```bash
claude mcp add --scope user calmstudio-mcp node \
  /path/to/architecture-as-code/calm-suite/calm-studio/packages/mcp-server/dist/index.js
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "calmstudio-mcp": {
      "command": "node",
      "args": ["/path/to/architecture-as-code/calm-suite/calm-studio/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**Windsurf / Cursor** (`~/.codeium/windsurf/mcp_config.json` or Cursor Settings → MCP):
```json
{
  "mcpServers": {
    "calmstudio-mcp": {
      "command": "node",
      "args": ["/path/to/architecture-as-code/calm-suite/calm-studio/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**VS Code Copilot** (`.vscode/mcp.json` in repo root):
```json
{
  "servers": {
    "calmstudio-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/calm-suite/calm-studio/packages/mcp-server/dist/index.js"]
    }
  }
}
```
