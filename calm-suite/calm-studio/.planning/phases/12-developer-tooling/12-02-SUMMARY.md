---
phase: 12-developer-tooling
plan: "02"
subsystem: github-action
tags: [github-action, octokit, ncc, tdd, rendering, validation]
dependency_graph:
  requires:
    - "12-01 — renderArchitectureToSvg pure function in @calmstudio/mcp"
  provides:
    - "getChangedCalmFiles using Octokit pulls.listFiles"
    - "renderCalmFile wrapping renderArchitectureToSvg + validateCalmArchitecture"
    - "buildCommentBody with MARKER and gh-diagrams SVG branch strategy"
    - "upsertComment with hidden marker pattern"
    - "dist/index.js ncc-bundled action ready for use"
  affects:
    - packages/github-action/src/changed-files.ts
    - packages/github-action/src/render.ts
    - packages/github-action/src/comment.ts
    - packages/github-action/src/index.ts
    - packages/github-action/dist/index.js
tech_stack:
  added:
    - "ncc 0.38.4: bundles the action into a single 3.2MB dist/index.js"
  patterns:
    - "Hidden marker pattern for idempotent PR comment create/update"
    - "SVG committed to gh-diagrams branch, referenced via raw.githubusercontent.com"
    - "TDD: RED tests committed before GREEN implementations"
key_files:
  created:
    - packages/github-action/vitest.config.ts
    - packages/github-action/src/test/action.test.ts
    - packages/github-action/src/changed-files.ts
    - packages/github-action/src/render.ts
    - packages/github-action/src/comment.ts
    - packages/github-action/dist/index.js
    - packages/github-action/.gitignore
  modified:
    - packages/github-action/src/index.ts (stub replaced with full orchestration)
    - packages/github-action/package.json (fix ncc build script)
    - packages/github-action/tsconfig.json (remove rootDir restriction)
    - commitlint.config.cjs (add github-action and vscode-extension scopes)
decisions:
  - "Import renderArchitectureToSvg from @calmstudio/mcp/dist/tools/render.js (compiled dist) not src — ncc cannot bundle TypeScript source outside rootDir"
  - "SVG committed to gh-diagrams branch via createOrUpdateFileContents — GitHub does not render inline SVG or base64 data URIs in PR comments"
  - "ncc build flag --no-source-map unsupported in v0.38.4 — removed from build script"
  - "commitlint scope-enum extended with github-action and vscode-extension scopes"
metrics:
  duration_minutes: 8
  tasks_completed: 2
  files_created: 7
  files_modified: 4
  completed_date: "2026-03-16"
---

# Phase 12 Plan 02: GitHub Action Implementation Summary

**One-liner:** GitHub Action that detects changed .calm.json files in PRs, renders them to SVG via renderArchitectureToSvg, validates via calm-core, and posts/updates an idempotent PR comment with diagram images.

## What Was Built

### Task 1: Implement changed file detection, rendering, and validation logic (TDD)

Three source modules created with full test coverage (10 unit tests):

**packages/github-action/src/changed-files.ts**

`getChangedCalmFiles(octokit, context)` calls `octokit.rest.pulls.listFiles` with `per_page: 100`, filters to files ending in `.calm.json` with `status !== 'removed'`. Returns empty array when running outside PR context (`pull_request.number` is undefined).

**packages/github-action/src/render.ts**

`renderCalmFile(filePath)` reads the file from disk, parses JSON as `CalmArchitecture`, calls `renderArchitectureToSvg` from `@calmstudio/mcp/dist/tools/render.js`, and validates via `validateCalmArchitecture` from `@calmstudio/calm-core`. Returns `{ fileName, svg, issues }`. On parse failure returns an error SVG placeholder and a single error-severity issue.

**packages/github-action/src/comment.ts**

`MARKER = '<!-- calmstudio-diagram-comment -->'` — the hidden marker for idempotent comment upsert.

`buildCommentBody(renders, octokit, context)` commits each SVG to a `gh-diagrams` branch using `octokit.rest.repos.createOrUpdateFileContents`, then references it via `https://raw.githubusercontent.com/{owner}/{repo}/gh-diagrams/diagrams/{fileName}.svg`. Each diagram section includes a validation summary with error/warning counts and inline issue messages.

`upsertComment(octokit, context, body)` lists PR comments, finds any with the MARKER, and updates it. Creates a new comment if none found.

**TDD commits:** RED (tests only) committed as `dc403ef`, then GREEN (implementations) as `ded3b9c`.

### Task 2: Wire action entry point and build bundled dist/index.js

**packages/github-action/src/index.ts** (stub replaced):

Full orchestration: detect changed files → skip if none → render all in parallel → build comment body (commits SVGs) → upsert PR comment → set output `comment-url` → warn if validation errors found.

**packages/github-action/dist/index.js:**

3.2MB ncc bundle produced by `ncc build src/index.ts --out dist`. The `.gitignore` in the package overrides the root `dist/` exclusion so the file is tracked in git (required — GitHub Actions downloads and runs this file directly).

Running `node packages/github-action/dist/index.js` outside GitHub fails with `::error::Input required and not supplied: github-token` — confirming the bundle loads and runs correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ncc flag --no-source-map unsupported in v0.38.4**
- **Found during:** Task 2 build
- **Issue:** `ncc build src/index.ts --out dist --no-source-map` failed with `ArgError: unknown or unexpected option: --no-source-map`
- **Fix:** Removed unsupported flag — `ncc build src/index.ts --out dist`
- **Files modified:** `packages/github-action/package.json`
- **Commit:** 73e35dd

**2. [Rule 3 - Blocking] ncc cannot bundle TypeScript source outside rootDir**
- **Found during:** Task 2 build
- **Issue:** Importing `@calmstudio/mcp/src/tools/render.ts` caused TS6059 (file not under rootDir) because ncc uses TypeScript compiler
- **Fix:** Changed import to `@calmstudio/mcp/dist/tools/render.js` (compiled dist output) and removed `rootDir` restriction from tsconfig.json
- **Files modified:** `packages/github-action/src/render.ts`, `packages/github-action/tsconfig.json`
- **Commit:** 73e35dd

**3. [Rule 3 - Blocking] commitlint scope-enum missing github-action scope**
- **Found during:** Task 1 commit
- **Issue:** commitlint rejected `feat(github-action): ...` — scope not in allowed list
- **Fix:** Added `github-action` and `vscode-extension` to `scope-enum` in `commitlint.config.cjs`
- **Files modified:** `commitlint.config.cjs`
- **Commit:** dc403ef

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @calmstudio/github-action test` | 10/10 tests pass |
| `test -f packages/github-action/dist/index.js` | Pass (3.2MB bundle) |
| `grep "calmstudio-diagram-comment" comment.ts` | MARKER present |
| `grep "renderArchitectureToSvg" render.ts` | Pure function imported |
| `grep "pulls.listFiles" changed-files.ts` | Octokit API used |
| `node dist/index.js` fails with missing token error | Pass (bundle loads correctly) |

## Self-Check: PASSED
