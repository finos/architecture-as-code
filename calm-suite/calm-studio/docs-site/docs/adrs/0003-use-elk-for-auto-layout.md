---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0003: Use ELK.js for Automatic Layout

## Context and Problem Statement

CalmStudio needs automatic layout for two scenarios: importing CALM JSON (nodes have no positions), and triggering re-layout on an existing diagram. The layout algorithm must handle containment/nesting (ecosystem nodes containing service nodes, VPCs containing subnets) and support directional presets (left-to-right and top-to-bottom) that are standard for software architecture diagrams.

## Considered Options

- **ELK.js** — Eclipse Layout Kernel, WebAssembly port. Hierarchical and force-directed algorithms with nesting support.
- **dagre** — directed acyclic graph layout. Lightweight, popular with React Flow. No first-class nesting support.
- **d3-hierarchy** — tree layout from D3. Only handles tree structures, not general graphs with cycles.

## Decision Outcome

Chosen: **ELK.js**, because it handles nested containment correctly — a hard requirement for CALM architectures where ecosystem nodes contain services, and VPCs contain subnets. ELK's layered algorithm produces clean hierarchical diagrams with both LR and TB direction presets. The WebAssembly build (`elkjs`) works in the browser without a server.

### Consequences

- **Good:** Handles nested/contained nodes correctly. Multiple layout algorithms available (layered, force, box, stress). LR and TB presets work well for service-dependency and infrastructure diagrams. Actively maintained by the Eclipse Foundation.
- **Neutral:** WebAssembly binary is larger than pure JavaScript layout libraries — approximately 300 KB vs dagre's ~25 KB. First layout operation has a small startup cost for WASM initialisation.
- **Bad:** ELK's configuration API is verbose and complex. Tuning layout parameters for specific diagram types requires trial and error. The WASM bundle adds to initial page load time.
