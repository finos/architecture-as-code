# Phase 10: Docs & Package Publish - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Docusaurus documentation site with getting started guide, API reference, contributor guide, extension pack development guide, and MCP usage guide. ADRs for all major v1.0 decisions. `@calmstudio/calm-core` published to npm as standalone package. No new features — documentation and packaging of existing v1.0 work.

</domain>

<decisions>
## Implementation Decisions

### Docs site structure
- Both audiences equally served: User Guide (architects) and Developer Guide (integrators)
- Quick start only — 5-minute guide: install, open, drag nodes, export JSON. One page.
- Key screenshots included: canvas, properties panel, governance panel, C4 view, template picker (5-8 annotated)
- FINOS ecosystem branding prominent — position CalmStudio as part of FINOS CALM ecosystem, link to calm.finos.org, AIGF, architecture-as-code repo. FINOS logo in header.

### ADR approach
- All major v1.0 decisions documented (~10 ADRs from PROJECT.md Key Decisions table)
- MADR format (Markdown Any Decision Record) — Title, Status, Context, Decision, Consequences
- Location: `docs/adrs/` — auto-indexed by Docusaurus, searchable on docs site

### calm-core publish
- Build with tsup — bundle to ESM + CJS with .d.ts declarations
- API surface: CALM types + Validation + AIGF catalogue (no test fixtures in public API)
- Semantic release for automated versioning from conventional commits
- Standalone README with install, quick example, API overview, link to full docs

### Hosting & deploy
- GitHub Pages — free, standard for FINOS projects
- Default GitHub Pages URL (no custom domain for now)
- Auto-deploy on merge to main via GitHub Action

### Claude's Discretion
- Docusaurus theme/color scheme
- Exact docs sidebar navigation structure
- TypeDoc vs hand-written API reference
- ADR numbering scheme

</decisions>

<specifics>
## Specific Ideas

- FINOS ecosystem positioning — link to calm.finos.org, AIGF, architecture-as-code repo
- calm-core README should have a quick code example showing type imports and validation
- Existing governance files (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, MAINTAINERS, LICENSE, NOTICE) already exist at repo root — reference from docs, don't duplicate

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/calm-core/` — existing package with types, validation, AIGF catalogue. Currently `private: true`, exports raw .ts
- `packages/calm-core/package.json` — has semantic-release config already
- Root governance files: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, MAINTAINERS.md, LICENSE, NOTICE
- `docs/` directory exists with AIGF_CATALOGUE.json, CALM_1.2_CONTROLS_SCHEMA.md, REQ_fluxnova_aigf_integration.md
- `docs/images/calmstudio01.png` — existing screenshot

### Established Patterns
- pnpm monorepo with workspace protocol
- Conventional commits + commitlint + husky (enforced)
- Semantic release configured per-package
- GitHub Actions CI pipeline exists (.github/workflows/)

### Integration Points
- `packages/calm-core/package.json` — needs `private: false`, tsup build, exports update
- `.github/workflows/` — add Docusaurus build + deploy job, npm publish job
- `docs/` — Docusaurus site root (or new `docs-site/` directory)
- PROJECT.md Key Decisions table — source for ADR content

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-docs-package-publish*
*Context gathered: 2026-03-15*
