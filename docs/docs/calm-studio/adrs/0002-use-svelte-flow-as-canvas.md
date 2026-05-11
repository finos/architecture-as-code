---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0002: Use Svelte Flow as Canvas Library

## Context and Problem Statement

CalmStudio's core interaction model requires a graph/diagram canvas that supports typed nodes with visual handles, drag-and-drop node creation, edge routing between nodes, containment (nodes inside nodes), zoom/pan, and multi-select. The canvas library is the most critical dependency in the entire project — it defines what interaction patterns are possible. The initial prototype used Excalidraw, but Excalidraw is a freehand whiteboard tool, not a typed graph editor.

## Considered Options

- **Excalidraw** — freehand whiteboard with hand-drawn aesthetic. Original prototype used this.
- **Svelte Flow** — typed graph editor with handles, containment groups, built-in zoom/pan. Port of React Flow.
- **Custom canvas (Canvas 2D / WebGL)** — full control, high performance, but months of upfront investment for basics.

## Decision Outcome

Chosen: **Svelte Flow**, because it provides first-class typed node editing with handles, containment support, pan/zoom, and a layout API — exactly the primitives CALM architecture diagrams require. Excalidraw's freehand whiteboard model is fundamentally incompatible with typed CALM node types and structured relationship edges.

### Consequences

- **Good:** Native handles for typed edge connections. Built-in containment groups for CALM `deployed-in` and `composed-of` relationships. Zoom/pan and multi-select work out of the box. Layout hooks allow ELK.js integration. Excellent performance with hundreds of nodes.
- **Neutral:** Svelte Flow (XyFlow's Svelte port) is a community port and may lag behind React Flow in features and bug fixes. API may change between minor versions.
- **Bad:** Dropping Excalidraw means losing the hand-drawn aesthetic that some users appreciated in the prototype. Freehand sketching and sticky notes are not available in Svelte Flow.
