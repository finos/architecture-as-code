---
phase: 13
slug: embedding-visualization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.x (web-component package) / vitest (studio, calm-core) |
| **Config file** | `packages/web-component/vitest.config.ts` (Wave 0 — created in 13-01 Task 1) |
| **Quick run command** | `pnpm --filter @calmstudio/diagram test` or `pnpm --filter @calmstudio/studio test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/diagram test` (web component tasks) or `pnpm --filter @calmstudio/studio test` (studio flow tasks)
- **After every plan wave:** Run `pnpm test` (full workspace)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | WEBC-01, WEBC-02 | type-check + smoke | `pnpm --filter @calmstudio/calm-core typecheck && pnpm --filter @calmstudio/diagram build && ls packages/web-component/dist/calm-diagram.*.js` | ❌ W0 (vitest.config.ts, package.json created in this task) | ⬜ pending |
| 13-01-02 | 01 | 1 | WEBC-01 | unit + smoke | `pnpm --filter @calmstudio/diagram test && pnpm --filter @calmstudio/diagram build` | ❌ W0 (elkRender.test.ts created in this task) | ⬜ pending |
| 13-02-01 | 02 | 2 | FLOW-01 | unit | `pnpm --filter @calmstudio/studio test -- src/lib/stores/flowState.svelte.test.ts` | ❌ W0 (flowState.svelte.test.ts created in this task) | ⬜ pending |
| 13-02-02 | 02 | 2 | FLOW-01 | unit + type-check | `pnpm --filter @calmstudio/studio test && pnpm --filter @calmstudio/studio typecheck` | ✅ (existing studio test infra) | ⬜ pending |
| 13-03-01 | 03 | 2 | FLOW-01 | unit + smoke | `pnpm --filter @calmstudio/diagram test && pnpm --filter @calmstudio/diagram build && pnpm test` | ❌ W0 (flowOverlay.test.ts created in this task) | ⬜ pending |
| 13-03-02 | 03 | 2 | FLOW-01 | checkpoint:human-verify | `pnpm --filter @calmstudio/diagram build && test -f packages/web-component/test.html && pnpm test` | ✅ (build infra from 13-01) | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/web-component/vitest.config.ts` — test config for new package (created in 13-01 Task 1)
- [ ] `packages/web-component/package.json` — package scaffold with test script (created in 13-01 Task 1)
- [ ] `packages/web-component/src/render/elkRender.test.ts` — ELK renderer tests covering WEBC-01 (created in 13-01 Task 2)
- [ ] `apps/studio/src/lib/stores/flowState.svelte.test.ts` — flow state store tests covering FLOW-01 (created in 13-02 Task 1)
- [ ] `packages/web-component/src/render/flowOverlay.test.ts` — flow overlay tests covering FLOW-01 (created in 13-03 Task 1)

All Wave 0 test files are created within TDD-flagged tasks (tests written before implementation). No separate Wave 0 plan needed — each plan's first task bootstraps its own test infrastructure.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Web component renders visually correct diagram with pack colors/icons | WEBC-01 | Visual rendering correctness | Open `packages/web-component/test.html` in browser; verify nodes have correct colors, icons render, layout is readable |
| Flow animated dots move along edges with correct direction | FLOW-01 | SVG animation timing is visual | Open test.html with `flow` attribute; verify dots animate along flow edges in correct direction |
| Zoom and pan interaction works in web component | WEBC-01 | Interactive behavior | Scroll to zoom, click-drag to pan in the `<calm-diagram>` element |
| Studio flow dropdown shows flows and activates overlays | FLOW-01 | Interactive UI behavior | Run `pnpm dev`, load a CALM JSON with flows, select a flow from toolbar dropdown |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
