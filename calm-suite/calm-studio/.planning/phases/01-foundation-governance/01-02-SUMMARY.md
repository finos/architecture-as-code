---
phase: 01-foundation-governance
plan: 02
status: complete
started: 2026-03-11
completed: 2026-03-11
subsystem: ci-cd
tags: [github-actions, semantic-release, reuse, owasp, dco, commitlint]
dependency_graph:
  requires: ["01-01"]
  provides: ["ci-cd-pipeline", "semantic-release", "pr-gates"]
  affects: ["all-future-phases"]
tech_stack:
  added:
    - multi-semantic-release@3.1.0
    - "@semantic-release/changelog@6"
    - "@semantic-release/git@10"
    - "@semantic-release/npm@13"
    - "@semantic-release/github@12"
  patterns:
    - GitHub Actions workflow with jobs matrix
    - Per-package semantic release with independent versioning
    - REUSE compliance enforcement in CI
    - OWASP Dependency-Check with CVSS 7 threshold
key_files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
    - .github/pull_request_template.md
    - .github/CODEOWNERS
    - packages/calm-core/.releaserc.json
    - packages/calmscript/.releaserc.json
    - packages/mcp-server/.releaserc.json
    - packages/extensions/.releaserc.json
    - apps/studio/.releaserc.json
  modified:
    - package.json (added semantic-release dev dependencies)
    - pnpm-lock.yaml
decisions:
  - "No @semantic-release/github in per-package configs — avoids one GitHub Release per package per push (anti-pattern)"
  - "release.yml uses persist-credentials: false with fetch-depth 0 — required for multi-semantic-release git operations"
  - "commitlint job only runs on pull_request events (not push) — avoids false failures on direct main pushes"
  - "OWASP report uploaded as artifact even on failure (if: always()) — preserves evidence for triage"
metrics:
  duration: "~5 minutes"
  completed: 2026-03-11
  tasks_completed: 2
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 1 Plan 2: CI/CD Pipeline — Summary

## Result

Two tasks completed successfully. GitHub Actions CI workflow (build, lint, test, REUSE compliance, OWASP CVE scan, commitlint) and release workflow (multi-semantic-release with full git history) are configured. All 5 packages have per-package `.releaserc.json` with changelog and git plugins. Task 3 (DCO App installation) is a blocking human-verify checkpoint.

**One-liner:** GitHub Actions CI/CD pipeline with REUSE, OWASP CVE scan, commitlint, and multi-semantic-release per-package versioning.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create GitHub Actions CI workflow and release workflow | Done | 0a2f0aa |
| 2 | Configure per-package semantic release and install release dependencies | Done | 8dbd80d |
| 3 | Verify DCO App installation and CI pipeline end-to-end | Skipped (user) | - |

## Key Files

### Created
- `.github/workflows/ci.yml` — PR gate: build, lint, test, REUSE compliance, OWASP CVE scan, commitlint
- `.github/workflows/release.yml` — Semantic release on main merge using multi-semantic-release
- `.github/pull_request_template.md` — PR checklist with DCO sign-off, SPDX headers, conventional commits
- `.github/CODEOWNERS` — `* @calmstudio/maintainers` placeholder team
- `packages/calm-core/.releaserc.json` — Per-package semantic release config
- `packages/calmscript/.releaserc.json` — Per-package semantic release config
- `packages/mcp-server/.releaserc.json` — Per-package semantic release config
- `packages/extensions/.releaserc.json` — Per-package semantic release config
- `apps/studio/.releaserc.json` — Per-package semantic release config

### Modified
- `package.json` — Added multi-semantic-release, @semantic-release/{changelog,git,npm,github} as dev dependencies
- `pnpm-lock.yaml` — Updated lockfile

## Verification

- ci.yml contains: build-lint-test, reuse-compliance, cve-scan, commitlint jobs
- release.yml has fetch-depth 0, persist-credentials false, and pnpm dlx multi-semantic-release
- All 5 packages have .releaserc.json with commit-analyzer, changelog, npm, git plugins
- No @semantic-release/github in per-package configs (anti-pattern avoided)
- multi-semantic-release installed at workspace root

## Deviations from Plan

None - plan executed exactly as written.

## Pending: Human Action Required

**Task 3 — DCO App Installation:**
1. Install DCO App on calmstudio GitHub repository: https://github.com/apps/dco
2. (Optional but recommended) Register NVD API key at https://nvd.nist.gov/developers/request-an-api-key and add as `NVD_API_KEY` GitHub Actions secret
3. Push a commit or open a PR to trigger CI — verify all 4 jobs run and report status

## Self-Check: PASSED
