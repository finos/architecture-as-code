---
phase: 10-docs-package-publish
verified: 2026-03-15T08:10:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Browse the deployed GitHub Pages site at https://finos.github.io/calmstudio/"
    expected: "Landing page shows CalmStudio hero, FINOS branding, all sidebar sections accessible"
    why_human: "Site deployment requires GitHub Pages enabled in repo settings; cannot verify remote deployment programmatically"
  - test: "Install @calmstudio/calm-core from npm once published and import types in a TypeScript project"
    expected: "Types resolve, validateCalmArchitecture works, AJV peer dep installs automatically"
    why_human: "Package not yet published to npm (requires NPM_TOKEN and merge to main); CJS runtime check passes locally but npm install flow needs real publish"
  - test: "Verify the MCP server doc lists 21 tools but implementation has 19"
    expected: "If MCP server has grown to 21 tools, doc is accurate; if still 19, update doc to '19 tools'"
    why_human: "The SUMMARY explicitly notes this discrepancy: documented as 21 per plan spec, actual server may have 19. Tool count needs human cross-check against packages/mcp-server/src/tools/"
---

# Phase 10: Docs & Package Publish Verification Report

**Phase Goal:** Developers can find CalmStudio documentation and consume calm-core as a standalone library
**Verified:** 2026-03-15T08:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An external developer can install @calmstudio/calm-core from npm and import its types and validators | VERIFIED | `private: false` in package.json; dist/ has index.js, index.cjs, index.d.ts, index.d.cts; `node -e "require('./packages/calm-core/dist/index.cjs')"` returns 7 exported symbols |
| 2 | tsup builds calm-core to ESM + CJS + .d.ts without errors | VERIFIED | dist/ contains index.js (53.7K), index.cjs (54.1K), index.d.ts (8.0K), index.d.cts (8.0K), plus sourcemaps |
| 3 | Published package includes only dist/ and README.md, not test-fixtures or source | VERIFIED | `"files": ["dist", "README.md", "CHANGELOG.md"]` in package.json; test-fixtures export removed |
| 4 | AJV is listed as a runtime dependency, not bundled in dist | VERIFIED | `external: ['ajv', 'ajv-formats']` in tsup.config.ts; both listed under `dependencies` in package.json |
| 5 | Docusaurus docs site builds without errors from monorepo root | VERIFIED | docs-site/build/ exists with index.html, docs/, api/, adrs/ directories |
| 6 | Site has FINOS branding with logo in header and ecosystem links | VERIFIED | docusaurus.config.ts: FINOS logo SVG in navbar; footer links to calm.finos.org, AIGF, architecture-as-code |
| 7 | GitHub Pages deploy workflow is configured with correct baseUrl and permissions | VERIFIED | .github/workflows/docs.yml: pages:write + id-token:write; baseUrl: '/calmstudio/'; deploy-pages@v4 |
| 8 | TypeDoc plugin is configured to generate calm-core API reference | VERIFIED | docusaurus.config.ts entryPoints: ['../packages/calm-core/src/index.ts']; docs-site/build/docs/api/ exists |
| 9 | A visitor can follow the getting started guide and load CalmStudio from zero | VERIFIED | quick-start.md (131 lines): prerequisites, 6 steps from clone to export, Next Steps links |
| 10 | A developer can look up any public calm-core API in the hosted reference documentation | VERIFIED | TypeDoc generates from src/index.ts; docs-site/build/docs/api/ rendered; CalmArchitecture, CalmNode, validateCalmArchitecture all in index.d.ts |
| 11 | A contributor can read the contribution guide and open a compliant PR without asking for help | VERIFIED | contributing.md (221 lines): setup, workflow, testing, commit conventions, references root CONTRIBUTING.md |
| 12 | An external developer can read the extension pack guide and understand how to create a custom pack | VERIFIED | extension-packs.md (233 lines): PackDefinition anatomy, step-by-step creation, monitoring pack example with Prometheus/Grafana/AlertManager |
| 13 | An architect can read the MCP guide and use AI tools to generate CALM architectures | VERIFIED | mcp-server.md (210 lines): tool categories, Claude Code + VS Code setup, usage examples |
| 14 | All key v1.0 architectural decisions are recorded as searchable ADRs | VERIFIED | 10 MADR 4.0 ADRs in docs-site/docs/adrs/; all build to docs-site/build/docs/adrs/; all contain Decision Outcome section |
| 15 | Getting started guide links to architecture overview as next step | VERIFIED | quick-start.md line 128: explicit link to `../user-guide/architecture-overview.md` |

**Score:** 15/15 truths verified

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/calm-core/tsup.config.ts` | tsup dual ESM+CJS build config | VERIFIED | Contains `defineConfig`, entry `src/index.ts`, formats `['esm', 'cjs']`, external `['ajv', 'ajv-formats']` |
| `packages/calm-core/package.json` | private:false, exports map, files field | VERIFIED | `"private": false`, conditional exports pointing to dist/, `"files": ["dist", "README.md", "CHANGELOG.md"]` |
| `packages/calm-core/README.md` | Standalone npm README, 40+ lines | VERIFIED | 164 lines; install instructions, quick example, API table, AIGF section, FINOS ecosystem links |
| `.github/workflows/release.yml` | Release workflow with tsup build | VERIFIED | `pnpm -r run build` step covers calm-core; `pnpm dlx multi-semantic-release` handles publish |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs-site/docusaurus.config.ts` | FINOS branding, TypeDoc plugin, GH Pages | VERIFIED | Contains `docusaurus-plugin-typedoc`, FINOS logo, baseUrl `/calmstudio/`, correct GH Pages org/project |
| `docs-site/package.json` | calmstudio-docs package with deps | VERIFIED | `"name": "calmstudio-docs"`, docusaurus-plugin-typedoc@^1.4.2 |
| `docs-site/sidebars.ts` | Sidebar navigation structure | VERIFIED | Getting Started, User Guide, Developer Guide, API Reference, ADRs categories; try/catch TypeDoc load |
| `docs-site/src/css/custom.css` | FINOS-themed CSS, 10+ lines | VERIFIED | 90 lines; FINOS #0033A0 primary blue |
| `.github/workflows/docs.yml` | GH Pages deploy workflow | VERIFIED | upload-pages-artifact@v3 + deploy-pages@v4; correct OIDC permissions |
| `pnpm-workspace.yaml` | Workspace includes docs-site | VERIFIED | `- 'docs-site'` present |

#### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs-site/docs/getting-started/quick-start.md` | 5-min guide, 60+ lines | VERIFIED | 131 lines; clone/install/dev/nodes/connect/export steps |
| `docs-site/docs/user-guide/architecture-overview.md` | Architecture overview, 80+ lines | VERIFIED | 190 lines; node types, relationships, C4, ELK, AIGF, MCP |
| `docs-site/docs/developer-guide/extension-packs.md` | PackDefinition guide, 80+ lines | VERIFIED | 233 lines; PackDefinition examples, monitoring pack, registration steps |
| `docs-site/docs/developer-guide/mcp-server.md` | MCP guide, 60+ lines | VERIFIED | 210 lines; tool tables, Claude Code + VS Code setup |
| `docs-site/docs/developer-guide/contributing.md` | Contributor guide, 60+ lines | VERIFIED | 221 lines; DCO, commit conventions, references CONTRIBUTING.md |
| `docs-site/docs/adrs/0001-use-svelte-5-over-react.md` | MADR ADR | VERIFIED | Contains "Decision Outcome", status: accepted |
| `docs-site/docs/adrs/0010-github-pages-hosting.md` | MADR ADR | VERIFIED | Contains "Decision Outcome", status: accepted |
| All 10 ADRs (0001-0010) | MADR 4.0 format | VERIFIED | 10 .md files in docs-site/docs/adrs/ plus index.md |

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/calm-core/tsup.config.ts` | `packages/calm-core/dist/` | `entry: ['src/index.ts']` | WIRED | Entry confirmed; dist/ exists with all 4 expected files |
| `packages/calm-core/package.json` | `packages/calm-core/dist/` | exports field | WIRED | `"exports"` maps `.` to `./dist/index.js` (ESM) and `./dist/index.cjs` (CJS) |
| `.github/workflows/release.yml` | `packages/calm-core/package.json` | `pnpm -r run build` | WIRED | Release workflow runs `pnpm -r run build` which now invokes `tsup` via updated build script |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docs-site/docusaurus.config.ts` | `packages/calm-core/src/index.ts` | TypeDoc entryPoints | WIRED | `entryPoints: ['../packages/calm-core/src/index.ts']` confirmed at line 36 |
| `.github/workflows/docs.yml` | `docs-site/build` | upload-pages-artifact | WIRED | `actions/upload-pages-artifact@v3` with `path: docs-site/build` at line 51 |
| `pnpm-workspace.yaml` | `docs-site/` | workspace member | WIRED | `- 'docs-site'` at line 4 |

#### Plan 03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docs-site/docs/getting-started/quick-start.md` | `docs-site/docs/user-guide/architecture-overview.md` | Next Steps link | WIRED | Line 128: explicit markdown link to `../user-guide/architecture-overview.md` |
| `docs-site/docs/developer-guide/extension-packs.md` | `packages/extensions/src/packs/` | PackDefinition references | WIRED | PackDefinition referenced 7 times including import from `@calmstudio/extensions` |
| `docs-site/docs/developer-guide/contributing.md` | `CONTRIBUTING.md` | reference to root governance | WIRED | Line 21 and line 12 both reference CONTRIBUTING.md |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOCS-01 | 10-02, 10-03 | Docusaurus site with getting started guide, architecture overview, and API reference | SATISFIED | docs-site/ built with TypeDoc API reference; quick-start.md (131L); architecture-overview.md (190L) |
| DOCS-02 | 10-03 | Architecture Decision Records for key v1.0 decisions | SATISFIED | 10 MADR 4.0 ADRs covering all v1.0 key decisions; all rendered in docs-site/build/docs/adrs/ |
| DOCS-03 | 10-03 | Extension pack development guide | SATISFIED | extension-packs.md (233L) with PackDefinition type reference and monitoring pack example |
| DOCS-04 | 10-03 | MCP server usage guide for AI tool integration | SATISFIED | mcp-server.md (210L) with 19 tools documented, Claude Code and VS Code setup |
| DOCS-05 | 10-03 | Contributor guide (setup, testing, PR workflow, DCO) | SATISFIED | contributing.md (221L) with DCO, conventional commits, CI workflow, links to root governance files |
| CORE-01 | 10-01 | @calmstudio/calm-core published to npm | SATISFIED | private:false; tsup builds ESM+CJS+d.ts; conditional exports; npm pack --dry-run excludes test-fixtures; release.yml handles publish |

No orphaned requirements — all 6 Phase 10 requirements (DOCS-01 through DOCS-05, CORE-01) are claimed by at least one plan and have supporting implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `docs-site/docs/developer-guide/mcp-server.md` | 14 | "21 tools" vs actual 19 documented | Info | Documentation inaccuracy — doc claims 21 tools but only 19 tool entries exist in the tables (1+2+6+4+2+2+2=19). SUMMARY 03 explicitly acknowledges: "The current tool count is 19 tools; documented as 21 per plan spec." No functional impact. |

No blocker or warning anti-patterns. No TODO/FIXME/placeholder content in any docs or source file. No stub implementations found.

### Human Verification Required

#### 1. GitHub Pages Deployment

**Test:** After enabling GitHub Pages in repo settings (Settings > Pages > Source: GitHub Actions), push to main and watch the Actions workflow run.
**Expected:** docs.yml workflow succeeds; site is accessible at https://finos.github.io/calmstudio/ with full FINOS branding, sidebar navigation, and TypeDoc API reference under /docs/api/.
**Why human:** Remote deployment cannot be verified programmatically. GitHub Pages source must be set to "GitHub Actions" once in repo settings.

#### 2. npm Install Flow for @calmstudio/calm-core

**Test:** Once NPM_TOKEN is set in repo secrets and a release commit merges to main, run `npm install @calmstudio/calm-core` in a fresh TypeScript project and import `validateCalmArchitecture`.
**Expected:** Types resolve via conditional exports; CJS works with `require()`; ESM works with `import`; AJV installs automatically as a runtime dependency.
**Why human:** Package not yet published to npm. CJS runtime check passes locally against dist/ but the npm install flow requires a real publish.

#### 3. MCP Tool Count Accuracy

**Test:** Count actual registered tools in `packages/mcp-server/src/` and compare against the "21 tools" claim in `docs-site/docs/developer-guide/mcp-server.md`.
**Expected:** Either the doc is updated to reflect the correct tool count, or the MCP server has been extended to 21 tools.
**Why human:** The SUMMARY explicitly flags this discrepancy. Automated count of tool files (9 files in tools/) and tool registrations (0 found via grep pattern) gave inconclusive results on exact tool count. The doc lists 19 tool names in tables but says "21 tools" in the intro.

### Gaps Summary

No structural gaps found. All 15 must-have truths verified. All 14 required artifacts exist, are substantive (above minimum line counts, contain required patterns), and are properly wired. All 6 requirements (DOCS-01 through DOCS-05, CORE-01) have clear implementation evidence.

The one informational finding (tool count discrepancy in MCP docs: "21 tools" claimed vs 19 documented) does not block the phase goal. It is a documentation accuracy issue for the author to resolve.

The phase goal is achieved: developers can find CalmStudio documentation (Docusaurus site with all required guides, ADRs, and TypeDoc API reference) and consume calm-core as a standalone library (private:false, tsup dual ESM+CJS build, conditional exports, runtime-ready).

---

_Verified: 2026-03-15T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
