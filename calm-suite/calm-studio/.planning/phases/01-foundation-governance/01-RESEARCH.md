# Phase 1: Foundation & Governance - Research

**Researched:** 2026-03-11
**Domain:** FINOS governance, Apache 2.0 SPDX licensing, pnpm monorepo scaffolding, GitHub Actions CI/CD, semantic release
**Confidence:** HIGH (most findings verified against official docs and FINOS project blueprint)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project scaffolding:**
- pnpm as package manager — fast, strict dependency resolution, workspace support
- Monorepo from day one using pnpm workspaces
- Layout: `apps/` (studio, desktop) + `packages/` (calm-core, calmscript, mcp-server, extensions) — clean separation of apps vs libraries
- TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- SvelteKit app lives in `apps/studio`; Tauri shell in `apps/desktop` (Phase 9)

**Commit & release conventions:**
- Conventional commits enforced by commitlint + husky
- Scopes are package-based: studio, desktop, calm-core, calmscript, mcp-server, extensions, ci, docs, deps
- Trunk-based development: all work merges to main via short-lived feature branches
- Independent semantic versioning per package (only changed packages get new versions)
- Per-package CHANGELOG.md files (no unified root changelog)

**CI pipeline design:**
- All checks block merge — build, lint, test, DCO, license scan, CVE scan, commitlint must pass
- Ubuntu-only runners; matrix builds deferred to Phase 9
- REUSE by FSFE for SPDX license header scanning (`.reuse/dep5` for binary/config file exceptions)
- OWASP Dependency-Check for CVE scanning (per CICD-04 requirement)
- Semantic release runs on merge to main

**FINOS governance files:**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GOVN-01 | Apache 2.0 license with SPDX headers on all source files | REUSE tool `annotate` command + `fsfe/reuse-action@v6` in CI |
| GOVN-02 | DCO sign-off on every commit, enforced by CI | `dcoapp/app` GitHub App + `git commit -s` instructions in CONTRIBUTING.md |
| GOVN-03 | CONTRIBUTING.md with DCO process, conventional commits guide, contributor workflow | FINOS project-blueprint template as reference; content fully defined in CONTEXT.md |
| GOVN-04 | CODE_OF_CONDUCT.md referencing FINOS community standard | Contributor Covenant v2.1 (standard FINOS approach) |
| GOVN-05 | SECURITY.md with vulnerability disclosure policy | GitHub Security Advisories flow; 90-day disclosure timeline defined |
| GOVN-06 | NOTICE file with third-party attribution | Apache 2.0 NOTICE format from FINOS compliance requirements |
| GOVN-07 | MAINTAINERS.md with project governance | BDFL + committers model; no prescribed format — adopt FINOS convention |
| GOVN-08 | All dependencies OSS-compatible with Apache 2.0 | FINOS license category A/B/X framework; OWASP Dependency-Check covers CVE+license overlap |
| CICD-01 | GitHub Actions: build, lint, test on every PR | Standard GHA workflow with pnpm cache + `pnpm -r run build/lint/test` |
| CICD-02 | DCO verification check on all PRs | `dcoapp/app` GitHub App (installed on repo, not a workflow file) |
| CICD-03 | License scanning for Apache 2.0 compatibility | `fsfe/reuse-action@v6` in CI workflow |
| CICD-04 | CVE scanning with OWASP Dependency-Check | `dependency-check/Dependency-Check_Action@main` with `--failOnCVSS 7` |
| CICD-05 | Conventional commits enforcement (commitlint + husky) | `@commitlint/cli` + `@commitlint/config-conventional` + husky v9 `commit-msg` hook |
| CICD-06 | Semantic release for automated versioning and changelog | `multi-semantic-release` for independent per-package releases in pnpm monorepo |
</phase_requirements>

---

## Summary

This phase delivers the complete project skeleton: a pnpm workspace monorepo, Apache 2.0 SPDX licensing on every source file enforced by CI, all five FINOS governance documents, DCO sign-off enforcement, and a GitHub Actions pipeline that gates every PR on build, lint, test, license scan, CVE scan, and commitlint. Semantic release on merge to main provides automated per-package versioning.

The two areas requiring the most care are (1) REUSE tool integration — it needs a `.reuse/dep5` file to cover binary and config files that cannot carry inline SPDX headers, and (2) monorepo semantic release — the standard `semantic-release` package does not natively support independent per-package versioning; `multi-semantic-release` is the standard community solution for pnpm workspaces.

Critically, FINOS projects use **DCO** (not CLA) enforced by the `dcoapp/app` GitHub App. Evidence: the official FINOS `project-blueprint` repository explicitly states DCO is required and the App is what enforces it. FINOS formally documents DCO as the lightweight contributor mechanism preferred by its newer projects.

**Primary recommendation:** Scaffold the pnpm workspace first, then layer governance files, then wire CI — in that order, so each CI check has something real to run against from the first commit.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| pnpm | 9.x / 10.x | Package manager + workspace orchestrator | Strict hoisting, disk-efficient, `workspace:*` protocol |
| TypeScript | 5.x | Language | Strict mode superset of JS; project-wide requirement |
| husky | v9.x | Git hooks runner | De-facto standard; v9 simplified hook file model |
| @commitlint/cli | 19.x | Commit message linter | Pairs with husky; enforces conventional commits |
| @commitlint/config-conventional | 19.x | Conventional commits ruleset | Industry standard Angular-derived preset |
| reuse (Python CLI) | 4.x / 5.x | SPDX header annotation + lint | FSFE tool — accepted by FINOS, FSF, many OSS foundations |
| fsfe/reuse-action | v6 | GitHub Actions REUSE compliance check | Official action; aligns major version with reuse CLI |
| dcoapp/app | GitHub App | DCO enforcement on PRs | Used by FINOS project-blueprint; no workflow YAML needed |
| dependency-check/Dependency-Check_Action | main | OWASP CVE scanning | Locked in CONTEXT.md; CICD-04 requirement |
| multi-semantic-release | 3.x | Per-package semantic versioning in monorepo | Only mature solution for independent pnpm workspace releases |
| @semantic-release/changelog | 6.x | CHANGELOG.md generation per package | Standard semantic-release plugin |
| @semantic-release/git | 10.x | Commit back version bumps + changelogs | Standard semantic-release plugin |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| @semantic-release/npm | 12.x | Publish packages to npm registry | Per-package in release.config.js when publishing to npm |
| @semantic-release/github | 10.x | Create GitHub Releases | Root-level workflow only (one GH release per push) |
| lint-staged | 15.x | Run linters only on staged files | Optional but reduces pre-commit time in large repos |
| pipx | system | Install reuse CLI without polluting global node env | Recommended installation method for reuse tool |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| multi-semantic-release | semantic-release-monorepo | `semantic-release-monorepo` last updated March 2022, unmaintained; `multi-semantic-release` handles pnpm catalogs |
| multi-semantic-release | @changesets/cli | Changesets is simpler but requires manual changelog entries — conflicts with fully automated release requirement |
| dcoapp/app (GitHub App) | christophebedard/dco-check (Action) | GitHub App provides better UX (override button for admins); Action works but has no admin override |
| fsfe/reuse-action | enarx/spdx Action | REUSE is the FSFE-blessed tool used by FINOS; enarx/spdx is a simpler header checker only |
| OWASP Dependency-Check | npm audit / Snyk | CICD-04 explicitly requires OWASP Dependency-Check |

**Installation (dev dependencies at workspace root):**
```bash
pnpm add -D -w husky @commitlint/cli @commitlint/config-conventional \
  multi-semantic-release @semantic-release/changelog @semantic-release/git \
  @semantic-release/npm @semantic-release/github
# reuse CLI via pipx (Python tool, not npm):
pipx install reuse
```

---

## Architecture Patterns

### Recommended Project Structure

```
calmstudio/                         # workspace root
├── apps/
│   ├── studio/                     # SvelteKit app (Phase 2+)
│   └── desktop/                    # Tauri shell (Phase 9)
├── packages/
│   ├── calm-core/                  # CALM model + schema
│   ├── calmscript/                 # DSL parser + compiler
│   ├── mcp-server/                 # MCP stdio server
│   └── extensions/                 # Extension pack system
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # PR: build, lint, test, REUSE, OWASP, commitlint
│   │   └── release.yml             # main push: multi-semantic-release
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── .husky/
│   ├── commit-msg                  # commitlint check
│   └── pre-commit                  # (optional: lint-staged)
├── .reuse/
│   └── dep5                        # SPDX coverage for binary/config files
├── LICENSES/
│   └── Apache-2.0.txt              # Full license text (required by REUSE)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── MAINTAINERS.md
├── NOTICE
├── LICENSE                         # Apache 2.0 (symlink or copy)
├── README.md
├── commitlint.config.cjs
├── pnpm-workspace.yaml
├── package.json                    # root — private: true, workspaces scripts
└── tsconfig.base.json              # shared TypeScript base config
```

### Pattern 1: REUSE SPDX Headers

**What:** Every source file carries two SPDX comment lines. REUSE tool enforces this in CI via `reuse lint`.

**When to use:** Required on all `.ts`, `.svelte`, `.js`, `.cjs`, `.mjs`, `.css`, `.html` files. Binary and config files (JSON, YAML, images) covered by `.reuse/dep5`.

**Example (TypeScript/JavaScript):**
```typescript
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
```

**Example (.reuse/dep5 for config/binary files):**
```
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: calmstudio
Upstream-Contact: maintainers@calmstudio.dev
Source: https://github.com/finos/calmstudio

Files: *.json *.yaml *.yml *.png *.svg *.ico pnpm-lock.yaml
Copyright: 2024 CalmStudio contributors - see NOTICE file
License: Apache-2.0
```

**Adding headers via CLI:**
```bash
# Annotate a single file
reuse annotate --copyright "2024 CalmStudio contributors - see NOTICE file" \
  --license "Apache-2.0" src/index.ts

# Lint compliance
reuse lint
```

### Pattern 2: pnpm Workspace Configuration

**What:** Single `pnpm-workspace.yaml` at root declares all packages; `workspace:*` protocol for cross-package deps.

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Root package.json (private workspace root):**
```json
{
  "private": true,
  "name": "calmstudio-workspace",
  "scripts": {
    "prepare": "husky",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": { "node": ">=20", "pnpm": ">=9" }
}
```

### Pattern 3: Commitlint + Husky v9

**What:** Husky v9 uses simple shell script files in `.husky/`. No `husky.config.js`. The `prepare` script installs hooks on `pnpm install`.

**commitlint.config.cjs:**
```javascript
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['studio', 'desktop', 'calm-core', 'calmscript', 'mcp-server', 'extensions', 'ci', 'docs', 'deps']
    ]
  }
};
```

**.husky/commit-msg:**
```sh
npx --no -- commitlint --edit $1
```

**Setup commands:**
```bash
pnpm dlx husky-init  # creates .husky/, adds prepare script
echo "npx --no -- commitlint --edit \$1" > .husky/commit-msg
chmod +x .husky/commit-msg
```

### Pattern 4: GitHub Actions CI Workflow

**What:** One workflow runs on every PR and push to main. Jobs: build, lint, test, reuse-compliance, cve-scan.

**.github/workflows/ci.yml structure:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  build-lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r run build
      - run: pnpm -r run lint
      - run: pnpm -r run test

  reuse-compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: fsfe/reuse-action@v6

  cve-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install --frozen-lockfile
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'calmstudio'
          path: '.'
          format: 'HTML'
          args: >
            --failOnCVSS 7
            --enableRetired
      - uses: actions/upload-artifact@v4
        with:
          name: owasp-report
          path: ${{ github.workspace }}/reports
```

### Pattern 5: multi-semantic-release for Independent Package Versioning

**What:** `multi-semantic-release` runs `semantic-release` per package, assigns commits to packages by touched file paths, coordinates inter-package version bumps before publishing.

**Each package needs a `.releaserc.json`:**
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    "@semantic-release/npm",
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
    }]
  ]
}
```

**.github/workflows/release.yml:**
```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm dlx multi-semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Pattern 6: TypeScript Strict Base Config

**tsconfig.base.json (workspace root):**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Each package's `tsconfig.json` extends this:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Anti-Patterns to Avoid

- **Putting `@semantic-release/github` in per-package config:** Creates a GitHub Release per package per push. Instead, use it only at the workspace root if needed, or accept only per-package npm releases.
- **Using `husky install` in prepare (v8 syntax):** Husky v9 prepare script is just `"prepare": "husky"` — the `install` sub-command is gone.
- **Inline SPDX in JSON/YAML files:** JSON has no comment syntax; YAML comments are not portable. Cover these via `.reuse/dep5` instead.
- **Relying on `npm audit` for CICD-04:** CICD-04 explicitly requires OWASP Dependency-Check, not `npm audit`.
- **Missing `fetch-depth: 0` in release workflow:** semantic-release needs full git history to determine previous tags. Without it, every run appears as the first release.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SPDX header enforcement | Custom grep-based license check script | `reuse lint` + `fsfe/reuse-action@v6` | Handles all file types, `.license` sidecar files, dep5, and produces SPDX SBOM |
| DCO enforcement | Custom commit message parser | `dcoapp/app` GitHub App | Handles remediation commits, admin override, bot exclusions — edge cases are non-trivial |
| CVE scanning | `npm audit` piped to a script | `dependency-check/Dependency-Check_Action@main` | CICD-04 specifies OWASP; covers transitive deps, has CVSS threshold flag |
| Conventional commit linting | Regex in a pre-commit hook | `@commitlint/cli` + `@commitlint/config-conventional` | Handles scope enum validation, breaking change footers, multi-line bodies |
| Per-package changelog | Manual CHANGELOG.md maintenance | `multi-semantic-release` + `@semantic-release/changelog` | Automatically correlates commits to packages via file path matching |
| Git hook management | Shell scripts in repo root | `husky` v9 | Portable, install-time activation, no global git config needed |

**Key insight:** Every tool here solves an entire problem category — not just the happy path. The edge cases (merge commits, bot accounts, binary files without comment syntax, inter-package version coordination) are exactly what makes hand-rolled solutions fail in production.

---

## Common Pitfalls

### Pitfall 1: DCO vs CLA Confusion

**What goes wrong:** Developer adds CLA bot (`cla-assistant`) instead of DCO bot, or assumes FINOS uses CLA.
**Why it happens:** FINOS documentation is ambiguous — the governance overview mentions CLAs as the formal policy, but actual FINOS projects (including the official `finos-labs/project-blueprint`) use DCO exclusively.
**How to avoid:** Install `dcoapp/app` GitHub App on the repository. Do NOT add `cla-assistant`. The project-blueprint README explicitly requires `Signed-off-by` DCO signatures.
**Warning signs:** Contributors being redirected to sign a CLA form; GitHub check named "CLA" rather than "DCO".

### Pitfall 2: REUSE Missing LICENSES/ Directory

**What goes wrong:** `reuse lint` fails with "Missing license file for Apache-2.0".
**Why it happens:** REUSE requires the full license text to be present at `LICENSES/Apache-2.0.txt` (not just a `LICENSE` file at root).
**How to avoid:** Run `reuse download Apache-2.0` after installing the reuse tool — it creates `LICENSES/Apache-2.0.txt` automatically. Also keep a symlink or copy of `LICENSE` at root for GitHub's license detection.
**Warning signs:** `reuse lint` passes locally but `fsfe/reuse-action@v6` fails in CI.

### Pitfall 3: Missing `fetch-depth: 0` Breaks Semantic Release

**What goes wrong:** Every merge to main triggers a new release from `v0.0.0` or the wrong base version.
**Why it happens:** GitHub Actions `checkout@v4` does a shallow clone (depth=1) by default. `semantic-release` and `multi-semantic-release` require full git history to find the most recent version tag.
**How to avoid:** Always add `fetch-depth: 0` to the `actions/checkout@v4` step in the release workflow.
**Warning signs:** Release produces `v1.0.0` on every merge; CHANGELOG shows all commits since repo creation.

### Pitfall 4: Husky v9 `prepare` Script Breaks CI

**What goes wrong:** `pnpm install --frozen-lockfile` fails in CI with `husky: command not found` or similar.
**Why it happens:** Husky v9 adds `"prepare": "husky"` to `package.json`. CI runners don't always have husky in PATH at `pnpm install` time.
**How to avoid:** Add `"prepare": "husky || true"` or check for CI environment: `"prepare": "[ -z \"$CI\" ] && husky || true"`.
**Warning signs:** CI `pnpm install` step fails with hook-related error; local installs work fine.

### Pitfall 5: dep5 Glob Patterns Failing

**What goes wrong:** Binary or config files (images, lock files, JSON configs) fail REUSE compliance because dep5 patterns don't match.
**Why it happens:** `.reuse/dep5` uses Debian copyright format glob patterns (e.g., `*.json` matches only root-level; `**/*.json` for recursive). The spec requires full relative paths from repo root.
**How to avoid:** Test with `reuse lint` locally before CI. Use `*` for single directory and `**/*` for recursive. Explicitly list `pnpm-lock.yaml`, `package.json`, `tsconfig*.json` files.
**Warning signs:** CI REUSE check fails only for config/binary files that have no comment syntax.

### Pitfall 6: Commitlint `scope-enum` Missing in CI

**What goes wrong:** Scope validation passes locally but the CI commitlint check (if added) uses different config.
**Why it happens:** Some CI setups run commitlint differently from husky hooks. The scope-enum rule in `commitlint.config.cjs` must be consistent with the declared scopes in CONTEXT.md.
**How to avoid:** Add a `commitlint` step to the CI workflow (separate from husky) that validates the PR title or all commits in the PR using `commitlint --from HEAD~N`.
**Warning signs:** Commits with invalid scopes slip through to main; CHANGELOG categories are wrong.

---

## Code Examples

Verified patterns from official sources:

### FINOS NOTICE File Template
```
CalmStudio - FINOS
Copyright 2024-2025 CalmStudio contributors - see MAINTAINERS.md

This product includes software developed at
The Fintech Open Source Foundation (https://www.finos.org/).

---

Third-party dependencies and their licenses are listed in the
FINOS License Scanning report and individual package license files.
```
Source: FINOS contribution compliance requirements — https://community.finos.org/docs/governance/software-projects/contribution-compliance-requirements/

### REUSE annotate for Svelte files
```bash
# .svelte files use HTML comment syntax for the header block
reuse annotate \
  --copyright "2024 CalmStudio contributors - see NOTICE file" \
  --license "Apache-2.0" \
  --style html \
  apps/studio/src/routes/+page.svelte
```
Source: REUSE tool documentation — https://codeberg.org/fsfe/reuse-tool

### DCO sign-off in commits
```bash
# Developer signs each commit:
git commit -s -m "feat(studio): add canvas component"
# Resulting commit message:
# feat(studio): add canvas component
#
# Signed-off-by: Jane Doe <jane@example.com>
```
Source: FINOS project-blueprint — https://github.com/finos-labs/project-blueprint

### pnpm workspace cross-package dependency
```json
// packages/calm-core/package.json
{
  "name": "@calmstudio/calm-core",
  "version": "0.0.0",
  "dependencies": {}
}

// apps/studio/package.json
{
  "dependencies": {
    "@calmstudio/calm-core": "workspace:*"
  }
}
```
Source: pnpm workspace docs — https://pnpm.io/workspaces

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `husky install` in prepare | `"prepare": "husky"` (v9+) | Husky v9 (2024) | Simpler hook files, no `husky install` sub-command |
| `husky add .husky/hook` | Manually create `.husky/hook` file | Husky v9 (2024) | `husky add` is deprecated; write files directly |
| `vitest.workspace` config | `projects` array in root vitest config | Vitest 3.2 (2025) | Workspace config deprecated; use `test.projects` |
| Lerna for monorepo releases | `multi-semantic-release` or changesets | 2022-2023 | Lerna is largely unmaintained; multi-semantic-release handles pnpm natively |
| `.releaserc.js` (ESM issues) | `.releaserc.json` or `.releaserc.cjs` | semantic-release v24+ | JSON format avoids ESM/CJS interop issues with `"type": "module"` |
| `reuse addheader` command | `reuse annotate` command | REUSE tool v3.x | `addheader` was renamed to `annotate` |

**Deprecated/outdated:**
- `husky install`: Removed in v9. Use just `"prepare": "husky"`.
- `semantic-release-monorepo` (pmowrer): Last updated 2022, unmaintained. Use `multi-semantic-release`.
- `vitest.workspace` file: Deprecated in Vitest 3.2. Use `test.projects` in root config.
- `.reuse/dep5` (entire file): REUSE spec 3.3 marks dep5 as "deprecated but supported". It still works and is the right approach for binary/config files today — the spec keeps it for backwards compatibility.

---

## Open Questions

1. **FINOS GitHub App installation — who installs it?**
   - What we know: `dcoapp/app` is a GitHub App installed at the repository or organization level, not via workflow YAML.
   - What's unclear: Whether the project owner has FINOS org-level GitHub permissions to install apps, or must request FINOS to install them.
   - Recommendation: Plan tasks assume the implementer has sufficient GitHub permissions. If deploying under `github.com/finos/calmstudio`, the FINOS DevOps team may need to install the DCO App.

2. **npm publish scope — public or internal registry?**
   - What we know: `multi-semantic-release` with `@semantic-release/npm` publishes to npm registry by default.
   - What's unclear: Whether Phase 1 should configure npm publishing at all, or defer to when packages have real content (Phase 2+).
   - Recommendation: Phase 1 release workflow should be set up with publishing configured but with `"private": true` on all packages until Phase 2+. The CI skeleton is the deliverable; actual publishing is not.

3. **OWASP Dependency-Check NVD API key requirement**
   - What we know: As of late 2023, the NVD (National Vulnerability Database) enforces rate limits that require an API key for reliable Dependency-Check runs. Without a key, CVE database downloads may fail or time out.
   - What's unclear: Whether the scan should fail the build when the NVD API is unavailable.
   - Recommendation: Register for a free NVD API key, store as GitHub Secret `NVD_API_KEY`, pass via `--nvdApiKey ${{ secrets.NVD_API_KEY }}` in the workflow args.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (no version pinned yet — Phase 1 scaffolds, packages installed in Phase 2) |
| Config file | None yet — created as Wave 0 gap |
| Quick run command | `pnpm -r run test` |
| Full suite command | `pnpm -r run test --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOVN-01 | All source files have SPDX headers | CI tool (reuse lint) | `reuse lint` | Wave 0: `.reuse/` dir |
| GOVN-02 | DCO sign-off blocks merge without `Signed-off-by` | GitHub App check (no unit test) | manual-only: install dcoapp/app | N/A |
| GOVN-03 | CONTRIBUTING.md exists and is linked from README | file existence check | `test -f CONTRIBUTING.md` | Wave 0 |
| GOVN-04 | CODE_OF_CONDUCT.md exists | file existence check | `test -f CODE_OF_CONDUCT.md` | Wave 0 |
| GOVN-05 | SECURITY.md exists | file existence check | `test -f SECURITY.md` | Wave 0 |
| GOVN-06 | NOTICE exists | file existence check | `test -f NOTICE` | Wave 0 |
| GOVN-07 | MAINTAINERS.md exists | file existence check | `test -f MAINTAINERS.md` | Wave 0 |
| GOVN-08 | No Category X licenses in deps | CI tool (OWASP + reuse) | CI workflow only (manual trigger in Phase 1) | Wave 0 |
| CICD-01 | GitHub Actions workflow runs on PR | smoke / CI integration | manual: open a test PR | Wave 0: `.github/workflows/ci.yml` |
| CICD-02 | DCO App blocks unsigned commits | GitHub App | manual: commit without -s | N/A — app behavior |
| CICD-03 | REUSE action fails on missing headers | CI (fsfe/reuse-action) | `reuse lint` locally | Wave 0 |
| CICD-04 | OWASP scan runs and fails on CVSS≥7 | CI tool | CI workflow step | Wave 0: `.github/workflows/ci.yml` |
| CICD-05 | commitlint rejects non-conventional commits | unit (hook integration) | `.husky/commit-msg` test | Wave 0: `.husky/` dir |
| CICD-06 | semantic-release creates version tag + CHANGELOG | integration | manual: merge to main | Wave 0: `.github/workflows/release.yml` |

### Sampling Rate

- **Per task commit:** `reuse lint && pnpm -r run test`
- **Per wave merge:** `reuse lint && pnpm -r run build && pnpm -r run test`
- **Phase gate:** All CI workflows green on a test PR before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `.reuse/dep5` — SPDX coverage for binary/config files; needed before `reuse lint` passes
- [ ] `LICENSES/Apache-2.0.txt` — created by `reuse download Apache-2.0`; needed before `reuse lint` passes
- [ ] `.github/workflows/ci.yml` — CI workflow; needed for CICD-01 through CICD-04
- [ ] `.github/workflows/release.yml` — release workflow; needed for CICD-06
- [ ] `commitlint.config.cjs` — needed before `pnpm install` activates husky commit-msg hook
- [ ] `.husky/commit-msg` — needed for CICD-05 local enforcement
- [ ] All five governance files (CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, MAINTAINERS.md, NOTICE)
- [ ] Root `vitest.config.ts` with `test.projects` (for Phase 2+ — stub only in Phase 1)

---

## Sources

### Primary (HIGH confidence)

- `https://community.finos.org/docs/governance/software-projects/contribution-compliance-requirements/` — SPDX header format, NOTICE file requirements, Apache 2.0 compliance, license categories A/B/X
- `https://github.com/finos-labs/project-blueprint` — FINOS DCO requirement, governance file list, NOTICE template
- `https://github.com/fsfe/reuse-action` — `fsfe/reuse-action@v6`, workflow YAML, latest version (October 2025)
- `https://reuse.software/spec-3.3/` — REUSE spec v3.3, dep5 format, SPDX header structure, `.license` sidecar files
- `https://github.com/fsfe/reuse-tool` — `reuse annotate` command, `reuse lint`, `reuse download`, Docker CI usage
- `https://github.com/semantic-release/semantic-release` — v25.0.3 (January 2026), plugin list, workflow pattern
- `https://typicode.github.io/husky/` — v9 setup, prepare script, hook file model
- `https://pnpm.io/workspaces` — pnpm-workspace.yaml format, `workspace:*` protocol
- `https://github.com/dcoapp/app` — DCO GitHub App, configuration, Signed-off-by enforcement

### Secondary (MEDIUM confidence)

- `https://www.npmjs.com/package/multi-semantic-release` — per-package release, pnpm catalog support, commit-to-package assignment
- `https://github.com/marketplace/actions/dependency-check` — OWASP Dependency-Check Action v1.1.0, `--failOnCVSS` flag, Node.js workflow config
- `https://commitlint.js.org/` — `@commitlint/config-conventional` ruleset, `scope-enum` configuration
- `https://osr.finos.org/docs/bok/artifacts/clas-and-dcos` — FINOS DCO vs CLA educational material, GitHub DCO App recommendation

### Tertiary (LOW confidence)

- Multiple DEV Community and Medium articles on monorepo + pnpm + semantic release patterns (cross-verified against official docs above)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official tool repos and FINOS project-blueprint
- Architecture: HIGH — patterns derived from official docs and verified working examples
- Pitfalls: MEDIUM-HIGH — most verified with official docs; dep5 pitfall from REUSE spec; CI pitfalls from official GHA docs
- multi-semantic-release for pnpm: MEDIUM — community tool, not official semantic-release; active maintenance confirmed via npm and GitHub

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable ecosystem; tools move slowly except semantic-release plugin versions)
