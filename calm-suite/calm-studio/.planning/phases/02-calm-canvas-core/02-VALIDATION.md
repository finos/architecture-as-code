---
phase: 2
slug: calm-canvas-core
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.x + @testing-library/svelte ^5.x |
| **Config file** | `apps/studio/vite.config.ts` (vitest config inline) — created in Plan 00 |
| **Quick run command** | `pnpm --filter @calmstudio/studio test --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/studio test --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 00 | 1 | CANV-01+ | setup | `pnpm --filter @calmstudio/studio test --run` | Plan 00 | ⬜ pending |
| 02-00-02 | 00 | 1 | CALM-05+ | setup | `pnpm --filter @calmstudio/studio test --run` | Plan 00 | ⬜ pending |
| 02-04-02 | 04 | 3 | CALM-05 | unit | `pnpm --filter @calmstudio/studio test --run src/tests/containment.test.ts` | Plan 04 | ⬜ pending |
| 02-05-01 | 05 | 4 | CANV-05 | unit | `pnpm --filter @calmstudio/studio test --run src/tests/history.test.ts` | Plan 05 | ⬜ pending |
| 02-05-01 | 05 | 4 | CANV-07 | unit | `pnpm --filter @calmstudio/studio test --run src/tests/clipboard.test.ts` | Plan 05 | ⬜ pending |
| 02-05-02 | 05 | 4 | CANV-08 | unit | `pnpm --filter @calmstudio/studio test --run src/tests/search.test.ts` | Plan 05 | ⬜ pending |
| 02-01-01 | 01 | 1 | CANV-01 | E2E | `pnpm test:e2e -- --grep "palette drag"` | future | ⬜ pending |
| 02-01-02 | 01 | 1 | CANV-02 | E2E | `pnpm test:e2e -- --grep "typed edge"` | future | ⬜ pending |
| 02-01-03 | 01 | 1 | CANV-03 | E2E | `pnpm test:e2e -- --grep "delete node"` | future | ⬜ pending |
| 02-01-04 | 01 | 1 | CANV-04 | E2E | `pnpm test:e2e -- --grep "zoom pan"` | future | ⬜ pending |
| 02-01-05 | 01 | 1 | CANV-05 | E2E | `pnpm test:e2e -- --grep "undo"` | future | ⬜ pending |
| 02-01-06 | 01 | 1 | CANV-06 | E2E | `pnpm test:e2e -- --grep "keyboard"` | future | ⬜ pending |
| 02-01-09 | 01 | 1 | CANV-09 | unit | `pnpm test -- --grep "dark mode"` | future | ⬜ pending |
| 02-02-01 | 02 | 1 | CALM-01 | component | `pnpm test -- --grep "node renders"` | future | ⬜ pending |
| 02-02-02 | 02 | 1 | CALM-02 | component | `pnpm test -- --grep "GenericNode"` | future | ⬜ pending |
| 02-02-03 | 02 | 1 | CALM-03 | component | `pnpm test -- --grep "edge style"` | future | ⬜ pending |
| 02-02-04 | 02 | 1 | CALM-04 | component | `pnpm test -- --grep "handles"` | future | ⬜ pending |
| 02-02-06 | 02 | 1 | CALM-06 | component | `pnpm test -- --grep "protocol label"` | future | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/studio/vite.config.ts` — vitest + SvelteKit config (Plan 00 Task 1)
- [x] `apps/studio/src/tests/` — test directory (Plan 00 Task 2)
- [x] `apps/studio/playwright.config.ts` — E2E config (Plan 00 Task 1)
- [x] Framework install: vitest, @testing-library/svelte, jsdom, @playwright/test (Plan 00 Task 1)
- [x] Stub test files: containment, history, clipboard, search (Plan 00 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop from palette to canvas feels natural | CANV-01 | DnD fidelity needs visual inspection | Drag each of the 9 node types; verify placement at cursor position |
| Dark mode styling looks correct | CANV-09 | Visual rendering check | Toggle dark mode; verify all node types, edges, palette, and canvas background render correctly |
| Zoom/pan smoothness | CANV-04 | Performance perception | Pinch-zoom and scroll-pan on a 20-node diagram; verify no stutter |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
