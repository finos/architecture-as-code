# Phase 1: Foundation & Governance - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Project skeleton, Apache 2.0 licensing, FINOS governance files, and CI/CD pipeline — so every contribution from day one is FINOS-ready. No application code; this phase delivers the scaffolding and gates that all future phases build on.

</domain>

<decisions>
## Implementation Decisions

### Project scaffolding
- pnpm as package manager — fast, strict dependency resolution, workspace support
- Monorepo from day one using pnpm workspaces
- Layout: `apps/` (studio, desktop) + `packages/` (calm-core, calmscript, mcp-server, extensions) — clean separation of apps vs libraries
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- SvelteKit app lives in `apps/studio`; Tauri shell in `apps/desktop` (Phase 9)

### Commit & release conventions
- Conventional commits enforced by commitlint + husky
- Scopes are package-based: studio, desktop, calm-core, calmscript, mcp-server, extensions, ci, docs, deps
- Trunk-based development: all work merges to main via short-lived feature branches
- Independent semantic versioning per package (only changed packages get new versions)
- Per-package CHANGELOG.md files (no unified root changelog)

### CI pipeline design
- All checks block merge — build, lint, test, DCO, license scan, CVE scan, commitlint must pass
- Ubuntu-only runners; matrix builds deferred to Phase 9 (desktop packaging)
- REUSE by FSFE for SPDX license header scanning (`.reuse/dep5` for binary/config file exceptions)
- OWASP Dependency-Check for CVE scanning (per CICD-04 requirement)
- Semantic release runs on merge to main

### FINOS governance files
- CONTRIBUTING.md: Full contributor workflow — fork-and-PR process, DCO sign-off instructions (`git commit -s`), conventional commits guide, local dev setup, testing expectations, code review SLA
- CODE_OF_CONDUCT.md: Contributor Covenant v2.1
- SECURITY.md: GitHub Security Advisories for private vulnerability reporting, 90-day coordinated disclosure timeline
- MAINTAINERS.md: BDFL + committers model — project lead with committers list that grows as contributors earn trust
- NOTICE: Third-party attribution file
- All linked from README

### Claude's Discretion
- Exact SPDX header template format per file type
- Husky hook configuration details
- GitHub Actions workflow file structure and caching strategy
- PR template content
- README structure and content
- Initial package.json scripts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow FINOS best practices for all governance files.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project is a blank slate (only `.planning/` directory exists)

### Established Patterns
- None yet — this phase establishes all foundational patterns

### Integration Points
- Every future phase inherits: license headers, commit conventions, CI gates, monorepo structure
- Phase 2 (CALM Canvas Core) will be the first package to use the scaffolding: `apps/studio`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-governance*
*Context gathered: 2026-03-11*
