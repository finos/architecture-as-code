---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0001: Use Svelte 5 over React

## Context and Problem Statement

CalmStudio required a modern, performant UI framework for a visual architecture editor. The editor must handle a reactive canvas with dozens to hundreds of nodes, a JSON code editor, bidirectional state sync between visual and code views, and a properties panel — all updating in real time without noticeable jank. The framework choice would affect the entire project long-term and drive the choice of graph/canvas library.

## Considered Options

- **React 18** — dominant ecosystem, extensive tooling, React Flow for graph editing
- **Svelte 5** — compiler-based framework, native reactivity via runes, Svelte Flow (React Flow port)
- **Vue 3** — composition API, good reactivity model, smaller graph library ecosystem

## Decision Outcome

Chosen: **Svelte 5**, because it delivers superior runtime performance for reactive canvas updates, significantly less boilerplate through its runes system (`$state`, `$derived`, `$effect`), and ships a smaller bundle than React equivalents. Svelte Flow (a port of React Flow) provides feature-parity with React Flow for graph editing.

### Consequences

- **Good:** Smallest possible bundle size — Svelte compiles away the framework at build time. Runes eliminate the mental model overhead of `useEffect` dependency arrays and `useMemo` caching. Native reactivity fits well with bidirectional sync between the canvas and JSON editor.
- **Neutral:** Svelte Flow is a community port and may lag behind React Flow in features. Some React component libraries (e.g., Radix UI) are not available, requiring alternative solutions.
- **Bad:** Svelte's ecosystem is significantly smaller than React's. Fewer off-the-shelf component libraries available. Some developers are less familiar with Svelte 5 runes versus React hooks.
