---
phase: 6
slug: calm-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/studio/vite.config.ts` (test section) + `packages/calm-core/vite.config.ts` |
| **Quick run command** | `pnpm --filter @calmstudio/calm-core test` |
| **Full suite command** | `pnpm --filter @calmstudio/studio test && pnpm --filter @calmstudio/calm-core test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/calm-core test`
- **After every plan wave:** Run `pnpm --filter @calmstudio/studio test && pnpm --filter @calmstudio/calm-core test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-00-01 | 00 | 0 | VALD-01, VALD-02, VALD-03 | unit | `pnpm --filter @calmstudio/calm-core test` | ❌ W0 | ⬜ pending |
| 06-00-02 | 00 | 0 | VALD-01, VALD-03 | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ W0 | ⬜ pending |
| 06-01-01 | 01 | 1 | VALD-01, VALD-03 | unit | `pnpm --filter @calmstudio/calm-core test` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | VALD-01 | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | VALD-02 | unit | `pnpm --filter @calmstudio/studio test -- validation` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | VALD-01, VALD-02 | manual | — manual only | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/calm-core/src/validation.test.ts` — stubs for validateCalmArchitecture() with error/warning/info cases, Ajv schema validation, semantic rules
- [ ] `apps/studio/src/tests/validation.test.ts` — stubs for validation store debounce behavior, issue grouping by elementId
- [ ] `packages/calm-core/src/schemas/` — directory with all 8 bundled CALM 2025-03 meta JSON files
- [ ] Add `ajv` and `ajv-formats` to `packages/calm-core/package.json` dependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Panel click selects and centers element on canvas | VALD-02 | Requires canvas viewport manipulation + DOM scroll | 1. Create diagram with errors 2. Open validation panel 3. Click error row 4. Verify node is selected and centered |
| Inline badge tooltip shows issue list on hover | VALD-01 | Requires hover interaction + tooltip rendering | 1. Create node with validation error 2. Hover badge 3. Verify tooltip lists all issues |
| Validation panel auto-opens on first error | VALD-02 | Requires visual verification of panel drawer behavior | 1. Start with valid diagram 2. Introduce an error 3. Verify panel slides open automatically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
