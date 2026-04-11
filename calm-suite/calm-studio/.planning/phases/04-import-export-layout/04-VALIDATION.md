---
phase: 4
slug: import-export-layout
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `apps/studio/vite.config.ts` (test section, include: `src/**/*.test.ts`) |
| **Quick run command** | `pnpm --filter @calmstudio/studio test` |
| **Full suite command** | `pnpm --filter @calmstudio/studio test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/studio test`
- **After every plan wave:** Run `pnpm --filter @calmstudio/studio test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-00-01 | 00 | 0 | IOEX-01, LAYT-01, LAYT-02, LAYT-03 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | W0 | pending |
| 04-00-02 | 00 | 0 | IOEX-06 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/fileSystem.test.ts` | W0 | pending |
| 04-01-01 | 01 | 1 | IOEX-01 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | W0 | pending |
| 04-01-02 | 01 | 1 | IOEX-01 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/projection.test.ts` | extend | pending |
| 04-02-01 | 02 | 1 | IOEX-02 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/calmModel.test.ts` | extend | pending |
| 04-02-02 | 02 | 1 | IOEX-06 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/fileSystem.test.ts` | W0 | pending |
| 04-03-01 | 03 | 2 | IOEX-04 | manual | N/A — DOM capture requires browser | N/A | pending |
| 04-03-02 | 03 | 2 | IOEX-05 | manual | N/A — DOM capture requires browser | N/A | pending |
| 04-03-03 | 03 | 2 | IOEX-03 | manual | N/A — reads CodePanel state | N/A | pending |
| 04-04-01 | 04 | 2 | LAYT-02 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | W0 | pending |
| 04-04-02 | 04 | 2 | LAYT-03 | unit | `pnpm --filter @calmstudio/studio test -- src/tests/elkLayout.test.ts` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `src/tests/elkLayout.test.ts` — stubs for IOEX-01, LAYT-01, LAYT-02, LAYT-03
- [x] `src/tests/fileSystem.test.ts` — stubs for IOEX-06 (File System Access API + fallback)
- [x] Install elkjs: `pnpm add --filter @calmstudio/studio elkjs`
- [x] Install html-to-image: `pnpm add --filter @calmstudio/studio html-to-image@1.11.11`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SVG export triggers download | IOEX-04 | html-to-image requires real browser DOM rendering | 1. Create diagram 2. Click Export > SVG 3. Verify downloaded file opens in browser/Inkscape |
| PNG export triggers download | IOEX-05 | Same as SVG | 1. Create diagram 2. Click Export > PNG 3. Verify image renders correctly at 2x resolution |
| calmscript export stub | IOEX-03 | Reads CodePanel UI state | 1. Toggle code panel to calmscript view 2. Click Export > calmscript 3. Verify downloaded file matches panel content |
| Error banner on invalid import | IOEX-01 | Requires drag-and-drop interaction in browser | 1. Drop invalid JSON onto canvas 2. Verify error banner appears 3. Click X to dismiss 4. Verify canvas unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
