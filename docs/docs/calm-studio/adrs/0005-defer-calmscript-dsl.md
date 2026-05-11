---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0005: Defer CalmScript DSL

## Context and Problem Statement

The original CalmStudio roadmap included a CalmScript DSL — a human-friendly, text-based language for defining CALM architectures. The goal was to let architects write architecture definitions in a readable DSL syntax and compile them to CALM JSON, similar to how HCL works for Terraform. The `packages/calmscript/` package was created for this purpose. However, building a language parser, compiler, and IDE integration is a significant investment that would delay shipping the core visual editor.

## Considered Options

- **Build CalmScript DSL now** — design grammar, implement parser (e.g., ANTLR or hand-written), write compiler to CALM JSON, add syntax highlighting.
- **Defer CalmScript DSL** — ship the MCP server instead. AI tools (Claude Code, GitHub Copilot) generate CALM JSON through structured tool calls, achieving the same "write architecture in natural language" goal.

## Decision Outcome

Chosen: **Defer CalmScript DSL**. The MCP server (21 tools) solves the "AI-assisted architecture generation" problem more reliably and immediately than a custom DSL. Natural language via MCP is more accessible to architects than learning a new DSL syntax. The `packages/calmscript/` package is retained as a placeholder for future work.

This decision should be revisited after real-world MCP usage data is available — if users are expressing frustration with JSON verbosity and want a concise text format, CalmScript becomes worthwhile.

### Consequences

- **Good:** Avoids premature abstraction. MCP server is proven working and deployed. Faster time-to-v1.0. No maintenance burden for a DSL parser/compiler/tooling chain.
- **Neutral:** `packages/calmscript/` exists but contains no implementation. This is clearly communicated in documentation as "deferred, not abandoned".
- **Bad:** No human-friendly text format for CALM architectures in v1.0. Engineers who prefer writing code to clicking UIs or prompting AI have limited options. DSL re-introduction later may conflict with patterns that emerge from MCP usage.
