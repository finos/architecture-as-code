---
phase: 15
slug: opengris-scaler-toml-exporter-and-deployment-templates
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/studio/vitest.config.ts` |
| **Quick run command** | `cd apps/studio && pnpm test` |
| **Full suite command** | `pnpm test` (from root, covers all packages) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/studio && pnpm test`
- **After every plan wave:** Run `pnpm test` (from root)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TOML-01 | unit | `cd apps/studio && pnpm test src/tests/io/scalerToml` | W0 | pending |
| 15-02-01 | 02 | 1 | TOML-03 | unit | `cd apps/studio && pnpm test src/tests/templates/registry` | exists | pending |
| 15-02-02 | 02 | 1 | TOML-03 | unit | same | exists | pending |
| 15-03-01 | 03 | 2 | TOML-02, TOML-04 | unit | `cd apps/studio && pnpm test src/tests/io/export` | exists | pending |
| 15-03-01b | 03 | 2 | TOML-02 | unit | `cd apps/studio && pnpm test src/tests/components/Toolbar` | exists | pending |
| 15-03-02 | 03 | 2 | TOML-04 | integration | `pnpm typecheck && cd apps/studio && pnpm test` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `apps/studio/src/tests/io/scalerToml.test.ts` — new file, covers all `buildScalerToml` behaviors (created by Plan 15-01 TDD RED phase)
- [ ] `apps/studio/src/lib/io/scalerToml.ts` — new file, the pure TOML builder (created by Plan 15-01 TDD GREEN phase)
- [ ] Extend `apps/studio/src/tests/io/export.test.ts` — add `exportAsScalerToml` download behavior tests (Plan 15-03 Task 1)
- [ ] Extend `apps/studio/src/tests/templates/registry.test.ts` — update count assertions from 6 to 10 (Plan 15-02 Task 2)
- [ ] Extend `apps/studio/src/tests/components/Toolbar.test.ts` — add `showScalerTomlExport` conditional rendering tests (Plan 15-03 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scaler.toml export button appears in dropdown when opengris nodes on canvas | TOML-02 | Visual confirmation of conditional UI | Load opengris-local-dev template, open export dropdown, confirm "Scaler.toml (OpenGRIS)" item visible |
| OpenGRIS demo appears in Demos dropdown | TOML-04 | Visual confirmation of demo entry | Click Demos button, confirm "OpenGRIS Local Cluster" option visible |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
