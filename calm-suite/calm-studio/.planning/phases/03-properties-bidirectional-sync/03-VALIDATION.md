---
phase: 3
slug: properties-bidirectional-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.0.8 |
| **Config file** | `apps/studio/vite.config.ts` (inline `test:` block) |
| **Quick run command** | `pnpm --filter @calmstudio/studio test` |
| **Full suite command** | `pnpm --filter @calmstudio/studio test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/studio test`
- **After every plan wave:** Run `pnpm --filter @calmstudio/studio test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-00-01 | 00 | 0 | SYNC-03, SYNC-04 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-00-02 | 00 | 0 | SYNC-01, SYNC-02 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/projection.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-01 | 01 | 1 | PROP-01 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PROP-02 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PROP-04 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PROP-05 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | CODE-01 | component | manual-only — CM6 requires DOM | N/A | ⬜ pending |
| 03-02-02 | 02 | 1 | CODE-02 | component | manual-only — visual/interaction | N/A | ⬜ pending |
| 03-02-03 | 02 | 1 | CODE-03 | manual | visual — verify in browser | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | SYNC-01 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/projection.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | SYNC-02 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/projection.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | SYNC-03 | unit | `pnpm --filter @calmstudio/studio test -- --run src/tests/calmModel.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | PROP-03 | manual | visual — verify in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/studio/src/tests/calmModel.test.ts` — stubs for SYNC-03, SYNC-04, PROP-01, PROP-02, PROP-04, PROP-05 (direction mutex, mutation functions, interface CRUD)
- [ ] `apps/studio/src/tests/projection.test.ts` — stubs for SYNC-01, SYNC-02 (flowToCalm, calmToFlow round-trip, position preservation)

*Existing infrastructure (vitest) covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CodeMirror panel renders | CODE-01 | CM6 requires real DOM; jsdom limitations | Open app, verify code panel visible with CALM JSON |
| Tab bar shows JSON active, calmscript disabled | CODE-02 | Visual/interaction check | Verify JSON tab active, calmscript tab grayed with tooltip |
| Syntax highlighting + error indicators | CODE-03 | Visual verification | Type valid JSON (colored), then break syntax (red squiggles) |
| Controls section placeholder | PROP-03 | Visual verification | Select node, verify "Controls (Phase 6)" disabled section |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
