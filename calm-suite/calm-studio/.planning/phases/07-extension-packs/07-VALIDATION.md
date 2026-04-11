---
phase: 7
slug: extension-packs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via vite.config.ts `test` block) |
| **Config file** | `apps/studio/vite.config.ts` — `test: { include: ['src/**/*.test.ts'], environment: 'jsdom' }` |
| **Quick run command** | `pnpm --filter studio vitest run` |
| **Full suite command** | `pnpm --filter studio vitest run && pnpm --filter @calmstudio/calm-core vitest run && pnpm --filter @calmstudio/extensions vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter studio vitest run`
- **After every plan wave:** Run `pnpm --filter studio vitest run && pnpm --filter @calmstudio/calm-core vitest run && pnpm --filter @calmstudio/extensions vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-00-01 | 00 | 0 | EXTK-01 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-00-02 | 00 | 0 | EXTK-01 | unit | `pnpm --filter studio vitest run src/tests/nodeTypes.test.ts` | ❌ W0 | ⬜ pending |
| 07-00-03 | 00 | 0 | EXTK-01 | unit | `pnpm --filter studio vitest run src/tests/sidecar.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-01 | 01 | 1 | EXTK-01 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | EXTK-02 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | EXTK-03 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | EXTK-04 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 1 | EXTK-05 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-02-04 | 02 | 1 | EXTK-06 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-02-05 | 02 | 1 | EXTK-07 | unit | `pnpm --filter @calmstudio/extensions vitest run` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | EXTK-01, EXTK-08 | unit | `pnpm --filter studio vitest run` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | EXTK-01 | unit | `pnpm --filter studio vitest run src/tests/projection.test.ts` | ✅ (extend) | ⬜ pending |
| 07-04-01 | 04 | 3 | EXTK-03 | manual | n/a | n/a | ⬜ pending |
| 07-04-02 | 04 | 3 | EXTK-01 | unit | `pnpm --filter studio vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/extensions/` needs vitest in devDependencies and a working test script
- [ ] `packages/extensions/src/registry.test.ts` — stubs for EXTK-01 through EXTK-07 (registry API + all pack node counts)
- [ ] `apps/studio/src/tests/nodeTypes.test.ts` — stubs for `resolveNodeType()` with pack-prefixed types
- [ ] `apps/studio/src/tests/sidecar.test.ts` — stubs for `detectPacksFromArch()`, `sidecarNameFor()`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pack badge appears in search results | EXTK-08 | Svelte component rendering | Search for "lambda" in palette, verify [AWS] badge visible |
| Collapsible palette sections | EXTK-08 | Visual interaction | Click pack headers, verify expand/collapse, verify smart defaults |
| Extension node canvas rendering | EXTK-01 | Visual verification | Drag AWS Lambda to canvas, verify icon and color rendering |
| Missing sidecar banner | EXTK-01 | UI interaction | Open .json with pack types but no .calmstudio.json, verify banner appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
