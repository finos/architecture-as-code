---
phase: 1
slug: foundation-governance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (scaffolded in Phase 1, packages installed in Phase 2) |
| **Config file** | None yet — created as Wave 0 gap |
| **Quick run command** | `reuse lint && pnpm -r run test` |
| **Full suite command** | `reuse lint && pnpm -r run build && pnpm -r run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `reuse lint && pnpm -r run test`
- **After every plan wave:** Run `reuse lint && pnpm -r run build && pnpm -r run test`
- **Before `/gsd:verify-work`:** All CI workflows green on a test PR
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | GOVN-01 | CI tool | `reuse lint` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | GOVN-02 | GitHub App | manual: install dcoapp/app | N/A | ⬜ pending |
| 01-01-03 | 01 | 1 | GOVN-03 | file check | `test -f CONTRIBUTING.md` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | GOVN-04 | file check | `test -f CODE_OF_CONDUCT.md` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | GOVN-05 | file check | `test -f SECURITY.md` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | GOVN-06 | file check | `test -f NOTICE` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | GOVN-07 | file check | `test -f MAINTAINERS.md` | ❌ W0 | ⬜ pending |
| 01-01-08 | 01 | 1 | GOVN-08 | CI tool | OWASP + reuse lint | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CICD-01 | CI integration | manual: open test PR | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | CICD-02 | GitHub App | manual: commit without -s | N/A | ⬜ pending |
| 01-02-03 | 02 | 1 | CICD-03 | CI tool | `reuse lint` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | CICD-04 | CI tool | CI workflow step | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 1 | CICD-05 | hook test | `.husky/commit-msg` | ❌ W0 | ⬜ pending |
| 01-02-06 | 02 | 1 | CICD-06 | integration | manual: merge to main | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.reuse/dep5` — SPDX coverage for binary/config files; needed before `reuse lint` passes
- [ ] `LICENSES/Apache-2.0.txt` — created by `reuse download Apache-2.0`; needed before `reuse lint` passes
- [ ] `.github/workflows/ci.yml` — CI workflow; needed for CICD-01 through CICD-04
- [ ] `.github/workflows/release.yml` — release workflow; needed for CICD-06
- [ ] `commitlint.config.cjs` — needed before husky commit-msg hook works
- [ ] `.husky/commit-msg` — needed for CICD-05 local enforcement
- [ ] All five governance files (CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, MAINTAINERS.md, NOTICE)
- [ ] Root `vitest.config.ts` — stub only in Phase 1

*All Wave 0 items must exist before task-level verification can run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DCO App blocks unsigned commits | GOVN-02, CICD-02 | GitHub App behavior, not code | Open PR without `Signed-off-by`, verify check fails |
| CI workflow runs on push/PR | CICD-01 | Requires actual GitHub Actions runner | Push a commit, verify all jobs run and report status |
| Semantic release creates tag + CHANGELOG | CICD-06 | Requires merge to main | Merge a conventional commit to main, verify tag and changelog |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
