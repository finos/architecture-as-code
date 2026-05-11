---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0007: MCP Server as Primary AI Integration Pattern

## Context and Problem Statement

CalmStudio's value proposition includes AI-assisted architecture generation — the ability for an architect to describe a system in natural language and have CALM architecture diagrams generated automatically. Several integration patterns exist for connecting AI tools to CalmStudio's architecture data model. The choice of integration pattern determines how AI tools discover available operations, call them, and handle errors.

## Considered Options

- **REST API** — expose a CalmStudio HTTP API. AI tools call it via `fetch` or Axios. Requires AI tools to know the API schema upfront.
- **CLI tool** — a `calmstudio` CLI that AI agents invoke as subprocess commands. Works with any AI agent that can run shell commands.
- **MCP server** — expose a Model Context Protocol server with typed tool schemas. Native integration with Claude Code, VS Code Copilot, and other MCP-capable AI clients.

## Decision Outcome

Chosen: **MCP server**, because it provides native integration with Claude Code and VS Code GitHub Copilot — the two AI tools most used by architects. MCP tools have typed JSON schemas that AI models can introspect, reducing hallucination rates compared to free-form CLI parsing. The MCP server is stateless (reads/writes files) and ships as a standalone npm package `@calmstudio/mcp-server`.

### Consequences

- **Good:** 21 tools covering full CALM CRUD, rendering, and validation. Works with Claude Code out of the box — no custom integration code needed. Tool schemas are typed (Zod + TypeScript), reducing AI errors. Stateless design makes the server easy to test and reason about.
- **Neutral:** Requires an MCP-capable AI client. Teams using AI tools without MCP support (e.g., some Copilot configurations, older Claude versions) cannot use the MCP server. They fall back to manual JSON editing.
- **Bad:** MCP is a relatively new standard (2024) and clients vary in their implementation quality and feature support. The MCP SDK is evolving and may have breaking changes in minor versions.
