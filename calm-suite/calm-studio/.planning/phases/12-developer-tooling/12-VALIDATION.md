---
phase: 12
slug: developer-tooling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (unit) |
| **Config file** | `packages/vscode-extension/vitest.config.ts`, `packages/github-action/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @calmstudio/vscode-extension test:unit && pnpm --filter @calmstudio/github-action test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite + `vsce package --no-dependencies`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | VSCE-01 | unit (pure render) | `vitest run src/tests/preview.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | VSCE-02 | unit (mock VS Code) | `vitest run src/tests/preview.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | VSCE-03 | unit | `vitest run src/tests/mcp.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | VSCE-04 | unit (mock openExternal) | `vitest run src/tests/openInStudio.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | VSCE-05 | smoke (build) | `vsce package --no-dependencies` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | GHAC-01 | unit (mock octokit) | `pnpm --filter @calmstudio/github-action test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/vscode-extension/` — scaffold new package
- [ ] `packages/vscode-extension/vitest.config.ts` — unit test config
- [ ] `packages/vscode-extension/src/tests/preview.test.ts` — covers VSCE-01, VSCE-02
- [ ] `packages/vscode-extension/src/tests/mcp.test.ts` — covers VSCE-03
- [ ] `packages/vscode-extension/src/tests/openInStudio.test.ts` — covers VSCE-04
- [ ] `packages/github-action/` — scaffold new package
- [ ] `packages/github-action/vitest.config.ts` — test config
- [ ] `packages/github-action/src/tests/action.test.ts` — covers GHAC-01
- [ ] Verify `pnpm-workspace.yaml` includes both new packages

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension installs from .vsix in VS Code | VSCE-05 | Requires VS Code host, not automatable in CI unit tests | 1. Build .vsix 2. Install via `code --install-extension` 3. Open .calm.json 4. Verify preview panel |
| Preview renders correctly in VS Code | VSCE-01 | Visual verification of SVG rendering in webview | 1. Open .calm.json 2. Check preview panel shows diagram |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
