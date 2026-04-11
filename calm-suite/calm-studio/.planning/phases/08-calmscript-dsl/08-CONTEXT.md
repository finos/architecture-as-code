# Phase 8: calmscript DSL - Context

**Gathered:** 2026-03-12
**Status:** Deferred (originally Phase 5, swapped with MCP Server)

<domain>
## Phase Boundary

A compact text DSL that compiles losslessly to CALM JSON and back. Enables readable architecture-as-text for code reviews, documentation, chat, and non-MCP AI generation. NOT the primary AI interface (MCP Server handles that via structured tool calls).

**Deferral rationale:** MCP Server (structured tool calls) solves the AI generation problem more reliably than text generation. Build MCP first, evaluate calmscript need based on real-world usage patterns. See ADR below.

</domain>

<decisions>
## Implementation Decisions

### Positioning
- calmscript is the **readable text representation** of CALM — like Markdown is to HTML
- AI-first, human-readable — not a language architects need to learn
- Humans mostly READ calmscript (code reviews, docs, PR diffs), not WRITE it
- AI uses MCP tools when available; calmscript only for text output contexts (docs, PRs, chat)
- Primary value: readable diffs, shareable text, documentation examples

### Syntax style
- Hybrid compact: one-liner node declarations, arrow operators for relationships, optional blocks for metadata
- Node format: `service api-gateway "API Gateway"` (type + id + name)
- Optional inline description: `service api "API Gateway" "Routes all inbound traffic"`
- Blocks only needed for rich metadata (interfaces, controls)
- Native calmscript syntax for ALL CALM concepts — no JSON fallback anywhere
- `//` line comments (C-style), dropped on compile (not preserved in round-trip)

### Relationship arrows
- `->` connects (directed)
- `<->` interacts (bidirectional)
- `=>` deployed-in (containment)
- `+>` composed-of (aggregation)
- `?>` options (alternative)
- Protocol after colon: `api -> db : JDBC`

### Metadata syntax
- Key-value shorthand inside blocks: `interface url = "https://api.example.com"`
- Keyword prefix per metadata type: `interface`, `control`, `metadata`, `description`
- Complex interfaces use nested blocks (still calmscript, not JSON):
  ```
  interface host-port {
    unique-id = "api-hp-01"
    host = "api.internal"
    port = 8443
  }
  ```

### Flows
- Chain syntax: `flow "Order Processing" { user -> api -> processor -> db }`

### Extension pack imports
- `@use aws` — one per line, no aliasing
- Dot-namespaced references: `aws.lambda processor "Order Processor"`
- Phase 8 validates pack name is recognized; actual pack resolution is Phase 7

### Round-trip fidelity
- Semantic grouping on decompile: nodes grouped by type, then relationships, then flows
- Canonical formatting (like gofmt) — "lossless" means data fidelity, not formatting
- Comments dropped on compile, not restored on decompile

### Editor experience
- Lezer grammar for CodeMirror syntax highlighting (decided pre-Phase 1)
- Chevrotain for runtime compilation (decided pre-Phase 1)
- Inline squiggles + gutter icons for errors (same pattern as JSON linter)
- Highlighting + errors only — no autocomplete, no snippets, no auto-format
- Debounced live compile (400ms) via Web Worker — same as JSON sync
- calmscript tab is editable (not read-only)

### Claude's Discretion
- Exact Lezer grammar token categories
- Chevrotain rule structure and error recovery strategy
- Web Worker message protocol design
- Canonical formatting rules (indentation width, blank lines between sections)

</decisions>

<specifics>
## Specific Ideas

- "calmscript = the agent's language for CALM" — but reframed: it's the readable text representation, not the primary AI interface
- ADR required documenting: why calmscript exists, why not Mermaid/HCL/YAML, the TypeScript-to-JavaScript analogy
- AI generation skills/prompts needed for Claude Code to produce valid calmscript in text contexts
- The CALM community already generates Mermaid from CALM (calm-widgets) — calmscript is the reverse direction with round-trip fidelity

### Full syntax example (decided during discussion)
```
@use aws
@use kubernetes

// Services
service api "API Gateway" "Routes all inbound traffic" {
  interface url = "https://api.example.com"
  control security = "OAuth 2.0"
}
aws.lambda processor "Order Processor"
database orders-db "Orders DB"
actor user "End User"
webclient frontend "Web App"

// Relationships
user -> frontend : HTTPS
frontend -> api : HTTPS
api -> processor : async
processor -> orders-db : JDBC
api => kubernetes.deployment

// Flows
flow "Order Processing" {
  user -> frontend -> api -> processor -> orders-db
}
```

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/calmscript/` — empty stub package, ready for implementation
- `packages/calm-core/src/types.ts` — all CALM types (9 node types, 5 relationship types, interfaces, controls)
- `apps/studio/src/lib/editor/CodePanel.svelte` — CodeMirror with disabled "calmscript" tab
- `apps/studio/src/lib/io/export.ts` — `exportAsCalmscript()` stub accepting string content

### Established Patterns
- Direction mutex in `calmModel.svelte.ts` — prevents infinite sync loops (reuse for calmscript sync)
- 400ms debounce on code editor changes — same pattern for calmscript compilation
- `jsonParseLinter` pattern — analogous calmscript linter needed
- Pure TypeScript for testability (projection.ts, elkLayout.ts) — calmscript compiler should follow same pattern

### Integration Points
- `CodePanel.svelte` tab bar — activate "calmscript" tab
- `calmModel.svelte.ts` — add `applyFromCalmscript()` method alongside `applyFromJson()`
- `export.ts` — replace stub with real calmscript decompiler output
- `+page.svelte` — wire calmscript tab to sync engine
- Web Worker — new infrastructure, no existing workers to reference

</code_context>

<deferred>
## Deferred Ideas

- Auto-complete for calmscript in CodeMirror — evaluate after basic editor works
- calmscript formatting on save — evaluate based on user feedback
- VS Code calmscript language extension — Phase 12 (Ecosystem)
- Standardizing calmscript as a FINOS-recognized format — v2+ community effort

</deferred>

---

*Phase: 08-calmscript-dsl (originally Phase 5, deferred 2026-03-12)*
*Context gathered: 2026-03-12*
