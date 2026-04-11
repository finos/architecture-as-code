---
phase: 9
slug: testing-suite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit/integration)** | Vitest 3.2.4 (studio, extensions, calm-core), 4.1.0 (mcp-server) |
| **Framework (E2E)** | Playwright 1.58.2 |
| **Config file (studio)** | `apps/studio/vite.config.ts` (inline test block) |
| **Config file (packages)** | `packages/*/vitest.config.ts` (all empty — need coverage config added) |
| **E2E config** | `apps/studio/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @calmstudio/studio run test` |
| **Full suite command** | `pnpm -r run test && pnpm --filter @calmstudio/studio run test:e2e` |
| **Estimated runtime** | ~30s unit, ~120s E2E |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/studio run test`
- **After every plan wave:** Run `pnpm -r run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit), 120 seconds (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TEST-01 | infra | `pnpm -r run test` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | TEST-01 | infra | `pnpm --filter @calmstudio/calm-core run test` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | TEST-02 | unit | `pnpm --filter @calmstudio/studio run test` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | TEST-03 | integration | `pnpm --filter @calmstudio/studio run test` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | TEST-05 | component | `pnpm --filter @calmstudio/studio run test` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | TEST-05 | component | `pnpm --filter @calmstudio/studio run test` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | TEST-04 | e2e | `npx playwright test --reporter=list` | ❌ W0 | ⬜ pending |
| 09-04-02 | 04 | 2 | TEST-04 | e2e | `npx playwright test --reporter=list` | ❌ W0 | ⬜ pending |
| 09-05-01 | 05 | 3 | TEST-01 | ci | `grep -c "coverage" .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 09-05-02 | 05 | 3 | TEST-01 | ci | `pnpm -r run test && grep -c "coverage" README.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/calm-core/test-fixtures/index.ts` — shared fixture factories (createMinimalArch, createFluxNovaArch, createAIGovernanceArch)
- [ ] `apps/studio/src/tests/stores/validation.test.ts` — covers validation.svelte.ts (TEST-02)
- [ ] `apps/studio/src/tests/stores/governance.test.ts` — covers governance.svelte.ts (TEST-02)
- [ ] `apps/studio/src/tests/stores/c4State.test.ts` — covers c4State.svelte.ts (TEST-02)
- [ ] `apps/studio/src/tests/io/export.test.ts` — covers export.ts (TEST-02)
- [ ] `apps/studio/src/tests/templates/registry.test.ts` — covers templates/registry.ts (TEST-02)
- [ ] `apps/studio/src/tests/integration/sync-integration.test.ts` — bidirectional sync round-trip (TEST-03)
- [ ] `apps/studio/src/tests/e2e/core-diagram-flow.spec.ts` — E2E workflow 1 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/template-governance.spec.ts` — E2E workflow 2 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/c4-navigation.spec.ts` — E2E workflow 3 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/validation-flow.spec.ts` — E2E workflow 4 (TEST-04)
- [ ] `apps/studio/src/tests/components/NodeProperties.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/EdgeProperties.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/ControlsList.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/GovernancePanel.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/TemplatePicker.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/ValidationPanel.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/Toolbar.test.ts` — component test (TEST-05)
- [ ] Coverage provider: `pnpm add -D @vitest/coverage-v8` in all 4 packages
- [ ] Coverage config blocks in all 4 vitest configs with tiered thresholds
- [ ] CI: coverage step + Codecov upload in GitHub Actions
- [ ] Playwright browser install: `npx playwright install --with-deps chromium` in CI workflow

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit), < 120s (E2E)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
