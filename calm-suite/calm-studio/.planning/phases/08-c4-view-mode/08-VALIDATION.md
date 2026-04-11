---
phase: 8
slug: c4-view-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vite.config.ts `test` block) |
| **Config file** | `apps/studio/vite.config.ts` (inline `test:` block) |
| **Quick run command** | `pnpm --filter studio test --run src/tests/c4Filter.test.ts src/tests/c4State.test.ts` |
| **Full suite command** | `pnpm --filter studio test --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter studio test --run src/tests/c4Filter.test.ts src/tests/c4State.test.ts`
- **After every plan wave:** Run `pnpm --filter studio test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | C4VM-01 | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 0 | C4VM-02 | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 0 | C4VM-03 | unit | `pnpm --filter studio test --run src/tests/c4State.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 0 | C4VM-04 | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-05 | 01 | 0 | C4VM-05 | unit | `pnpm --filter studio test --run src/tests/c4Filter.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/studio/src/tests/c4Filter.test.ts` — stubs for C4VM-01, C4VM-02, C4VM-04, C4VM-05 (pure function tests)
- [ ] `apps/studio/src/tests/c4State.test.ts` — stubs for C4VM-03 (state logic; pure function wrapper if runes not testable)

*Note: `c4Filter.ts` is a pure TS file (no `.svelte.ts`), fully testable in Vitest. `c4State.svelte.ts` uses runes — keep testable logic in `c4Filter.ts` and test only that.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| View selector UI switches C4 levels | C4VM-01 | UI interaction | Open C4 mode, click Context/Container/Component tabs, verify canvas filters |
| Double-click drill-down | C4VM-02 | UI interaction + event handler | In Context level, double-click system node, verify Container view loads |
| Breadcrumb navigation | C4VM-03 | UI component rendering | Drill into nested levels, verify breadcrumb shows path, click breadcrumb to navigate back |
| Read-only overlay preserves model | C4VM-04 | Integration behavior | Toggle C4 mode on/off, verify CALM JSON unchanged in code editor |
| C4 styling per level | C4VM-05 | Visual styling | At Context level, verify external systems are greyed out, internal highlighted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
