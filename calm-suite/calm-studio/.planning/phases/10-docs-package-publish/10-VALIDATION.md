---
phase: 10
slug: docs-package-publish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing for calm-core) + Docusaurus build (smoke) |
| **Config file** | `packages/calm-core/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @calmstudio/calm-core run test` |
| **Full suite command** | `pnpm --filter @calmstudio/calm-core run test && pnpm --filter @calmstudio/calm-core run build && pnpm --filter calmstudio-docs run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/calm-core run test` (calm-core changes); `pnpm --filter calmstudio-docs run build` (docs changes)
- **After every plan wave:** Both commands above + `npm pack --dry-run` in `packages/calm-core/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CORE-01 | smoke | `pnpm --filter @calmstudio/calm-core run build && ls packages/calm-core/dist/` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | CORE-01 | smoke | `node -e "const p=require('./packages/calm-core/package.json'); if(p.private) throw new Error('private')"` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | DOCS-01 | smoke | `pnpm --filter @calmstudio/calm-core run build && pnpm --filter calmstudio-docs run build && test -d docs-site/build` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | DOCS-01 | smoke | `test -f .github/workflows/docs.yml` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | DOCS-01,03,04,05 | smoke | `pnpm --filter calmstudio-docs run build && ls docs-site/build/docs/` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | DOCS-02 | smoke | `ls docs-site/docs/adrs/*.md \| wc -l` (≥ 10) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/calm-core/tsup.config.ts` — new file, must exist before build tests run
- [ ] `docs-site/` — scaffold via `pnpm create docusaurus@latest docs-site classic --typescript`
- [ ] `docs-site/package.json` — name it `calmstudio-docs` so pnpm filter works

*Existing unit tests in `packages/calm-core/src/*.test.ts` cover the API surface — no new unit tests needed for CORE-01 assuming exports are unchanged*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FINOS branding visible on docs site | DOCS-01 | Visual check | Open built site, verify FINOS logo in header and ecosystem links |
| Screenshots render correctly | DOCS-01 | Visual check | Open getting started page, verify 5-8 annotated screenshots display |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
