---
phase: 11
slug: desktop-app
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/studio/vite.config.ts` (test section) |
| **Quick run command** | `pnpm --filter @calmstudio/studio test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/studio test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | DESK-01 | smoke (CI matrix build) | GitHub Actions `tauri build` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | DESK-02 | unit (mockIPC) | `pnpm --filter @calmstudio/studio test -- fileSystem` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | DESK-02 | unit (mockIPC) | `pnpm --filter @calmstudio/studio test -- fileSystem` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | DESK-03 | manual (offline) | manual-only | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/studio/src/tests/io/fileSystemTauri.test.ts` — covers DESK-02 with mockIPC (open + save)
- [ ] `apps/studio/src/tests/desktop/menu.test.ts` — covers menu construction (mockWindows)
- [ ] `apps/studio/src/tests/desktop/recentFiles.test.ts` — covers plugin-store recent files
- [ ] `.github/workflows/release.yml` — CI build matrix for DESK-01 (macOS/Windows/Linux)
- [ ] Install mocks package: `pnpm add -D @tauri-apps/api` (mocks are in the same package)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App runs with no outbound network calls | DESK-03 | Offline verification requires launching the packaged binary with network blocked — not automatable in unit/integration tests | 1. Build release binary 2. Disable network 3. Launch app 4. Verify all features work without network |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
