# Feature Research

**Domain:** Architecture diagramming tool (CALM-native visual editor)
**Researched:** 2026-03-11
**Confidence:** HIGH (competitive tools directly analyzed; CALM spec authoritative)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop canvas | Every diagramming tool since Visio (1991) has this; absence is jarring | MEDIUM | Svelte Flow provides this natively; need to add CALM-typed node palette |
| Node palette / shape library | Users browse available node types; freeform drawing is not architecture diagramming | LOW | Palette needs CALM node types (actor, system, service, database, network, webclient, ecosystem, ldap, data-asset) plus extension pack icons |
| Edge/connection drawing | Connecting nodes is the core act of architecture diagramming | LOW | Svelte Flow handles this; need CALM relationship types (connects, interacts, deployed-in, composed-of) as typed handles |
| Properties panel | Every node/edge needs metadata editing — labels, descriptions, URLs, ports | MEDIUM | Must expose CALM-specific fields: interfaces, controls, metadata, unique-id |
| Undo/redo (unlimited) | Users make mistakes; no undo = fear of experimenting | LOW | Standard browser history pattern; must work across visual AND code edits |
| Zoom and pan | Architectures are large; users navigate spatially | LOW | Svelte Flow built-in; need smooth trackpad/mouse wheel behavior |
| Save and load diagrams | Users expect to persist work to files | LOW | Tauri 2 provides native file system; CALM JSON is the save format |
| Export to image (PNG/SVG) | Sharing diagrams in documents, PRs, wikis | LOW | SVG preferred (vector, crisp); PNG for compatibility |
| Copy/paste nodes | Structural repetition is common in architectures | LOW | Must preserve CALM unique-ids (generate new IDs on paste) |
| Delete with confirmation | Accidentally deleting a cluster of nodes is catastrophic | LOW | Soft delete or confirmation dialog for multi-select deletes |
| Multi-select and group | Users select multiple nodes to move, delete, or reorganize | LOW | Svelte Flow supports multi-select; containment via sub-flows |
| Auto-layout | Hand-layout 50+ node diagrams is tedious; users expect "clean up" | MEDIUM | ELK.js hierarchical layout; must preserve manual layout overrides |
| Search / find node | Large diagrams require navigation by name | LOW | Filter nodes by label, type, ID |
| Keyboard shortcuts | Power users expect Cmd+Z, Cmd+S, Delete, arrow keys, spacebar-pan | LOW | Standard shortcut set matching Figma/Miro conventions |
| Dark and light mode | Modern tools support both | LOW | CSS variables; system preference detection |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CALM-typed nodes and edges | Draw.io, Miro, Excalidraw have no architecture semantics — every box is just a box. CALM types make diagrams machine-verifiable | HIGH | 9 built-in node types + custom via extension packs; 5 relationship types with typed handles in Svelte Flow |
| Bidirectional visual-to-code sync | Edit visually, get CALM JSON automatically; edit CALM JSON, see canvas update — no other tool does this for a structured AaC spec | HIGH | The core differentiator; requires disciplined state management — CALM JSON is canonical, visual state is derived |
| calmscript DSL | Mermaid-like text format that compiles losslessly to CALM JSON; ~20 lines for typical architectures vs 462 lines of raw JSON; AI-generatable | HIGH | Critical for AI adoption; must round-trip perfectly; Mermaid syntax inspiration but with architecture semantics |
| MCP server / AI-native integration | Makes CalmStudio the authoritative architecture tool for Claude Code and other AI assistants — first-class, not bolted on | HIGH | No competitor has an MCP server for architecture-as-code; Excalidraw, Miro, Draw.io MCPs are generic canvas tools, not semantics-aware |
| Real-time CALM schema validation | Instant feedback when a diagram violates CALM schema (missing required fields, invalid relationship types, bad interface specs) | MEDIUM | Use `calm validate` internally or port schema validation to TypeScript; show inline error indicators on offending nodes/edges |
| Extension pack system | AWS, GCP, Azure, Kubernetes, AI/Agentic icon packs with typed custom node vocabularies — makes CalmStudio universal without changing the CALM spec | HIGH | Custom node types in CALM use string literals; packs define icons + default metadata templates; critical for enterprise adoption |
| Pattern library / architecture templates | One-click: "microservices on K8s", "serverless API", "RAG pipeline" — populated as real CALM diagrams, not placeholder boxes | MEDIUM | Structurizr has workspace templates but they're C4-scoped; CalmStudio patterns are CALM-native and runnable through `calm validate` |
| CALM controls and compliance metadata | Expose security controls, compliance tags, performance requirements per node/edge — no visual tool does this | MEDIUM | Controls are CALM's killer feature for enterprise (Morgan Stanley validation); surface them in properties panel and as visual overlays |
| Flow visualization | Show data flows as animated or stepped overlays on the static architecture — IcePanel does this for C4; CalmStudio does it for CALM | HIGH | CALM supports flows natively; render as numbered sequence on existing diagram edges |
| Containment (deployment topology) | Nested nodes — services inside containers, containers inside VMs, VMs inside VPCs — reflects deployed-in and composed-of relationships visually | MEDIUM | Svelte Flow sub-flows support this natively; most general-purpose tools fake containment with overlapping boxes |
| GitHub Action for CI/CD validation | Architects paste a GitHub Action into their repo; PRs that break architecture compliance get blocked automatically | LOW | Wraps `calm validate`; renders diff-able diagram comment on PR; no competitor offers this for a structured AaC spec |
| VS Code extension with live preview | Architects edit calmscript in VS Code, see live canvas preview — same loop as Mermaid Preview extension | MEDIUM | Existing CALM VS Code extension exists; extend it with calmscript live preview rather than build from scratch |
| Web component `<calm-diagram>` | Embed architecture diagrams in any web page, documentation site, or internal portal without importing CalmStudio | MEDIUM | Svelte compiles to web components well; consumers need zero dependency on CalmStudio itself |
| Desktop app (offline-first, native FS) | Enterprises distrust SaaS with architecture data; Tauri 2 gives native file system, OS keychain, no server dependency | HIGH | Tauri 2 is lighter than Electron; architecture-as-code must live in the repo, not a SaaS cloud |
| Import CALM JSON with auto-layout | Onboard existing CALM users instantly; paste JSON, get a visual diagram — no competitor does this for CALM | LOW | CALM JSON parser + ELK.js layout; reference implementation exists in `calm-widgets` |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Freehand drawing / whiteboard mode | "Can I sketch a rough idea?" | Destroys the typed-node guarantee that makes CALM useful; freehand boxes have no CALM semantics — they corrupt the model | Let users start from a calmscript stub or a pattern template instead; rough ideas become CALM-typed from the start |
| Real-time multi-user collaboration (v1) | Everyone expects Google Docs co-editing | Requires CRDT or OT infrastructure (massive complexity); CALM JSON is a tree structure with unique-ids that makes merge conflicts non-trivial; building this in v1 is scope creep that delays shipping | Defer to v2+; enable async collaboration via git-native workflow (CALM JSON in version control, PR review, GitHub Action CI) |
| UML/ArchiMate/C4 import-export | "Can I import my existing Visio/Enterprise Architect diagrams?" | Each notation has a different metamodel; mapping them to CALM is lossy and requires ongoing maintenance as each spec evolves; half-correct imports erode trust | Provide clear migration guides; let users rebuild in CALM with pattern templates as starting points |
| Terraform/Pulumi/CloudFormation generation | "Generate IaC from my diagram" | Diagrammatic intent and IaC specifics diverge rapidly; generated Terraform without human review ships bad infrastructure; creates false confidence | Architecture describes intent; IaC describes provisioning. Keep them separate. Add links between CALM nodes and IaC resources as metadata, not generated code |
| AI auto-complete for every action | "Copilot for diagrams" | Continuous AI suggestions break flow on a canvas; most suggestions are wrong for the user's specific context; adds latency | Surface AI via explicit commands (calmscript generation, pattern suggestions, explain-this-node) rather than inline autocomplete |
| Infinite shape customization (CSS per node) | "Can I make my boxes look like our brand?" | Custom styling makes diagrams non-portable and breaks extension pack icon sets; architecture diagrams communicate structure, not brand | Provide a theme system (light/dark/high-contrast) with consistent node styling per type; extension packs own their icon aesthetic |
| "Everything in one panel" mega properties editor | Enterprise users request exhaustive metadata forms | Overwhelming UI causes abandonment; 90% of users only fill in 3-4 fields per node | Progressive disclosure: show essential fields (label, type, description) by default; expand to show interfaces/controls/flows only when relevant |
| Diagram versioning inside CalmStudio | "Show me what this looked like 3 months ago" | Reinventing git inside the app is never as good as git itself; adds storage, sync, and conflict complexity | CALM JSON lives in git; users get full history via their VCS; GitHub Action diffs diagrams per PR |

## Feature Dependencies

```
[CALM-Typed Nodes + Edges]
    └──required-by──> [Bidirectional Visual-to-Code Sync]
    └──required-by──> [CALM Schema Validation]
    └──required-by──> [Extension Pack System]
    └──required-by──> [Pattern Library]
    └──required-by──> [Flow Visualization]
    └──required-by──> [Containment (deployed-in / composed-of)]

[calmscript DSL]
    └──required-by──> [MCP Server / AI Integration]
    └──required-by──> [VS Code Extension]
    └──required-by──> [GitHub Action]

[CALM Schema Validation]
    └──required-by──> [GitHub Action CI/CD]

[Bidirectional Visual-to-Code Sync]
    └──enhances──> [MCP Server] (AI edits code, visual updates)
    └──enhances──> [VS Code Extension] (edit file, canvas reacts)

[Extension Pack System]
    └──enhances──> [Node Palette] (packs add new types to palette)
    └──enhances──> [Pattern Library] (patterns use pack-specific node types)

[Properties Panel]
    └──required-by──> [Controls / Compliance Metadata]
    └──required-by──> [Flow Visualization] (flows defined on edges)

[Export PNG/SVG]
    └──enhances──> [Web Component] (same renderer, different output target)

[Desktop App (Tauri)]
    └──required-by──> [Native File System Save/Load]
    └──conflicts-with──> [Real-time Collaboration] (offline-first vs always-connected)
```

### Dependency Notes

- **CALM-Typed Nodes requires being built before everything else:** The typed node model is the foundation. Extension packs, patterns, validation, flows, and the bidirectional sync are all meaningless without semantically typed nodes and edges.
- **calmscript required before MCP server:** The MCP server's value is generating architecture descriptions that CalmStudio can consume. Without calmscript, the MCP server can only emit verbose CALM JSON which defeats the AI-native story.
- **Bidirectional sync complexity:** This is the hardest engineering challenge. CALM JSON must be canonical (canvas is derived, not the source of truth). Any edit — visual drag, property change, or calmscript edit — flows through CALM JSON as the single source of truth.
- **Extension packs conflict with freehand customization:** Packs own node aesthetics and type semantics; arbitrary CSS overrides break both.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Drag-and-drop canvas with CALM-typed node palette — the core editing experience
- [ ] All 9 CALM node types + 5 relationship types as typed edges — typed semantics from day one
- [ ] Properties panel with essential CALM fields (label, description, unique-id, interfaces, metadata) — needed to produce valid CALM output
- [ ] Bidirectional visual-to-CALM-JSON sync — the core value prop; must work before anything else
- [ ] Real-time CALM schema validation with inline error indicators — instant feedback loop
- [ ] calmscript DSL with parser and compiler to CALM JSON — prerequisite for MCP server and AI adoption
- [ ] CALM JSON import with auto-layout (ELK.js) and export — onboards existing CALM users, enables round-tripping
- [ ] Export PNG and SVG — enables sharing outside the tool
- [ ] Auto-layout (ELK.js hierarchical) — required for import to be useful; hand-layout is not acceptable
- [ ] Undo/redo, keyboard shortcuts, zoom/pan, multi-select — table stakes UX; missing these feels broken
- [ ] Desktop app (Tauri 2) with native file system — architecture-as-code must live in the repo, not a SaaS

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Extension packs (AWS, GCP, Azure, Kubernetes, AI/Agentic) — trigger: first paying enterprise customers asking "where are the AWS icons?"
- [ ] MCP server for Claude Code — trigger: calmscript is stable and round-trips correctly
- [ ] Pattern library with common architecture templates — trigger: users ask "how do I start a new diagram?"
- [ ] Containment visualization (deployed-in / composed-of as nested sub-flows) — trigger: users diagramming infrastructure topologies
- [ ] Flow visualization (data flows as stepped overlays) — trigger: users asking "how do I show request flows?"
- [ ] CALM controls and compliance metadata UI — trigger: enterprise architects using the tool; Morgan Stanley-style compliance use cases
- [ ] VS Code extension with live calmscript preview — trigger: calmscript adoption growing, developers want editor-native workflow
- [ ] GitHub Action for PR validation and diagram rendering — trigger: teams asking about CI/CD integration

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Real-time multi-user collaboration — defer: massive infrastructure complexity; async git-native workflow is sufficient for v1 enterprise use
- [ ] C4 / ArchiMate import/export — defer: lossy translation; focus on CALM-native onboarding first
- [ ] Terraform/Pulumi IaC generation — defer: dangerous if incorrect; need deep validation layer first
- [ ] Community extension pack marketplace — defer: need internal extension pack system proven stable first
- [ ] Web component `<calm-diagram>` — defer: needs stable rendering layer; useful for docs sites but not critical for initial adoption

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CALM-typed nodes + edges on canvas | HIGH | MEDIUM | P1 |
| Bidirectional visual-to-CALM-JSON sync | HIGH | HIGH | P1 |
| calmscript DSL (parser + compiler) | HIGH | HIGH | P1 |
| Real-time CALM schema validation | HIGH | MEDIUM | P1 |
| CALM JSON import with auto-layout | HIGH | MEDIUM | P1 |
| Properties panel (interfaces, controls, metadata) | HIGH | MEDIUM | P1 |
| Export PNG/SVG | HIGH | LOW | P1 |
| Undo/redo, shortcuts, zoom/pan | HIGH | LOW | P1 |
| Desktop app (Tauri 2) | HIGH | MEDIUM | P1 |
| Extension packs (AWS/GCP/Azure/K8s/AI) | HIGH | HIGH | P2 |
| MCP server for AI integration | HIGH | MEDIUM | P2 |
| Pattern library / templates | MEDIUM | MEDIUM | P2 |
| Containment visualization | MEDIUM | MEDIUM | P2 |
| Flow visualization | MEDIUM | HIGH | P2 |
| Controls / compliance metadata UI | MEDIUM | MEDIUM | P2 |
| VS Code extension | MEDIUM | MEDIUM | P2 |
| GitHub Action CI/CD | MEDIUM | LOW | P2 |
| Web component `<calm-diagram>` | MEDIUM | MEDIUM | P3 |
| Real-time collaboration | MEDIUM | HIGH | P3 |
| C4/ArchiMate import | LOW | HIGH | P3 |
| IaC generation | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | draw.io | Lucidchart | Structurizr | IcePanel | Eraser.io | Ilograph | Cloudcraft | Mermaid/PlantUML | CalmStudio approach |
|---------|---------|------------|-------------|----------|-----------|----------|------------|-----------------|---------------------|
| Architecture semantics (typed nodes) | None (freeform boxes) | None | C4 model (4 types) | C4 model (3 levels) | None | Model-based (custom) | AWS-only icons | None (text syntax only) | Full CALM spec: 9 types + 5 rel types + custom via packs |
| Diagram as code | No (XML file format, not human-writable) | No | Yes (Structurizr DSL) | No (GUI-only) | Yes (Eraser syntax) | Yes (YAML-like) | No | Yes (native) | Yes (calmscript + CALM JSON) |
| Visual-to-code bidirectional sync | No | No | No (code is source of truth) | No | Partial | No | No | No | Yes (CALM JSON canonical, canvas derived) |
| Schema validation | No | No | Partial (C4 constraint checking) | No | No | No | No | Partial (syntax only) | Full CALM JSON schema validation |
| AI generation | Template-level | Text-to-diagram (Mermaid) | No | No | Yes (AI-native) | No | No | AI generates Mermaid well | calmscript enables AI generation; MCP server for structured AI workflow |
| MCP server | Unofficial (Draw.io MCP) | No | No | No | No | No | No | Community MCPs | First-class MCP server with CALM-aware tools |
| Cloud provider packs | Yes (shape libraries) | Yes (shape libraries) | No | No | No | No | AWS/Azure only | No | Extension pack system: AWS, GCP, Azure, K8s, AI/Agentic |
| CI/CD integration | Limited (draw.io GitHub Action) | No | Structurizr CLI | No | No | No | No | GitHub Actions for rendering | GitHub Action: validate + render calmscript on PRs |
| Desktop app (offline) | Yes (offline web app) | No (SaaS) | Yes (self-host Docker) | No (SaaS) | No (SaaS) | No (SaaS) | No (SaaS) | CLI tools only | Tauri 2 native desktop; offline-first |
| Compliance / controls metadata | No | No | No | No | No | No | No | No | CALM controls: security, compliance, performance per node |
| Flow visualization | No | Basic arrows | No | Yes (on C4 diagrams) | No | Yes (sequence perspectives) | No | Sequence diagrams (separate) | CALM flows as stepped overlays on architecture diagram |
| Containment / deployment topology | Grouped shapes (visual only) | Swimlanes (visual only) | Deployment view (C4) | Implicit in C4 levels | No | Model-based | VPC groupings (visual) | No | deployed-in / composed-of as Svelte Flow sub-flows |
| Pattern library | Templates (generic) | Templates (generic) | Starter workspaces | No | No | No | No | No | CALM-native patterns that validate against schema |
| Export | SVG, PNG, PDF, XML | SVG, PNG, PDF | PNG, SVG, Mermaid | SVG, PNG | SVG, PNG | HTML (self-contained) | PNG, SVG | SVG, PNG | SVG, PNG + CALM JSON + calmscript |

## Sources

- [CALM FINOS Key Features](https://calm.finos.org/introduction/key-features/) — official CALM documentation (HIGH confidence)
- [CALM GitHub Repository](https://github.com/finos/architecture-as-code) — source of truth for CALM spec (HIGH confidence)
- [IcePanel vs Structurizr Comparison](https://icepanel.medium.com/comparison-icepanel-vs-structurizr-7036c8762147) — IcePanel's own comparison (MEDIUM confidence; vendor-authored)
- [Architecture Diagramming Tools and the AI Gap](https://generativeprogrammer.com/p/architecture-diagramming-tools-and) — independent analysis of AI gap (MEDIUM confidence)
- [Ilograph Features](https://www.ilograph.com/features.html) — official Ilograph feature list (HIGH confidence)
- [Cloudcraft](https://www.cloudcraft.co/) — official product (HIGH confidence)
- [Structurizr](https://structurizr.com/) — official Structurizr docs (HIGH confidence)
- [IcePanel C4 Model support](https://icepanel.io/c4-model) — official IcePanel docs (HIGH confidence)
- [Mermaid Architecture Diagrams](https://mermaid.ai/open-source/syntax/architecture.html) — official Mermaid docs (HIGH confidence)
- [Eraser.io AI Architecture Generator](https://www.eraser.io/ai/architecture-diagram-generator) — official Eraser product (HIGH confidence)
- [MCP server for visual architecture (blog)](https://blog.whiteprompt.com/how-i-built-an-mcp-server-that-turns-claude-desktop-into-a-visual-architect-0e404744509a) — practitioner writeup (MEDIUM confidence)
- [draw.io vs Lucidchart comparison 2026](https://www.lucidchart.com/pages/lucidchart-vs-draw-io) — Lucidchart official comparison (MEDIUM confidence; vendor-authored)

---
*Feature research for: CALM-native visual architecture editor (CalmStudio)*
*Researched: 2026-03-11*
