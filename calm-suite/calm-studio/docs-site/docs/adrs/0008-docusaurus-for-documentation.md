---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0008: Docusaurus for Documentation Site

## Context and Problem Statement

CalmStudio needed a documentation site to host user guides, API reference, ADRs, and developer documentation. The site must support MDX (Markdown + JSX for interactive components), TypeDoc integration for auto-generated API reference, versioning (for CALM spec version alignment), full-text search, and a navigation sidebar. As a FINOS project, alignment with the FINOS documentation ecosystem matters.

## Considered Options

- **Docusaurus 3.x** — React-based static site generator. Used by many FINOS projects. MDX support, TypeDoc plugin, versioning, Algolia search integration.
- **Nextra** — Next.js-based documentation framework. MDX support, clean design. Not yet mainstream in the FINOS ecosystem.
- **MkDocs + Material** — Python-based. Widely used in open-source. No TypeDoc plugin. Python toolchain adds a separate dependency.
- **Starlight (Astro)** — lightweight, fast, excellent DX. Not yet adopted in FINOS. TypeDoc integration less mature.

## Decision Outcome

Chosen: **Docusaurus 3.x**, because it is the standard documentation framework for FINOS projects, has mature TypeDoc plugin integration (`docusaurus-plugin-typedoc`), and supports versioning aligned with CALM spec versions. The React+MDX model allows interactive diagrams and code examples in documentation pages.

### Consequences

- **Good:** FINOS-aligned — familiar to contributors who have worked on other FINOS projects. TypeDoc plugin generates API reference from TypeScript source. Versioning allows documentation to be pinned to CALM spec versions. Algolia DocSearch available for full-text search. Actively maintained by Meta.
- **Neutral:** Heavier than lighter alternatives (Starlight, VitePress). React dependency adds to the documentation site's build complexity. pnpm workspace integration requires filter flags for doc-specific commands.
- **Bad:** Docusaurus uses React; CalmStudio's app uses Svelte. Contributors working on the documentation site need React familiarity even if they do not touch the app. Build times are slower than Starlight equivalents.
