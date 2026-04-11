---
phase: 5
slug: mcp-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.8 (already used in studio) |
| **Config file** | packages/mcp-server/vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `pnpm --filter @calmstudio/mcp test` |
| **Full suite command** | `pnpm -r run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @calmstudio/mcp test`
- **After every plan wave:** Run `pnpm -r run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-00-01 | 00 | 0 | MCPS-01 | unit | `pnpm --filter @calmstudio/mcp test -- createArchitecture` | ❌ W0 | ⬜ pending |
| 05-00-02 | 00 | 0 | MCPS-02 | unit | `pnpm --filter @calmstudio/mcp test -- addNode` | ❌ W0 | ⬜ pending |
| 05-00-03 | 00 | 0 | MCPS-02 | unit | `pnpm --filter @calmstudio/mcp test -- addRelationship` | ❌ W0 | ⬜ pending |
| 05-00-04 | 00 | 0 | MCPS-03 | unit | `pnpm --filter @calmstudio/mcp test -- validate` | ❌ W0 | ⬜ pending |
| 05-00-05 | 00 | 0 | MCPS-04 | unit (real elkjs) | `pnpm --filter @calmstudio/mcp test -- render` | ❌ W0 | ⬜ pending |
| 05-00-06 | 00 | 0 | MCPS-05 | unit (mocked fs) | `pnpm --filter @calmstudio/mcp test -- io` | ❌ W0 | ⬜ pending |
| 05-00-07 | 00 | 0 | MCPS-06 | integration/smoke | `node dist/index.js --version` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/mcp-server/src/tests/createArchitecture.test.ts` — stubs for MCPS-01
- [ ] `packages/mcp-server/src/tests/nodes.test.ts` — stubs for MCPS-02 (node CRUD)
- [ ] `packages/mcp-server/src/tests/relationships.test.ts` — stubs for MCPS-02 (relationship CRUD)
- [ ] `packages/mcp-server/src/tests/validate.test.ts` — stubs for MCPS-03
- [ ] `packages/mcp-server/src/tests/render.test.ts` — stubs for MCPS-04
- [ ] `packages/mcp-server/src/tests/io.test.ts` — stubs for MCPS-05
- [ ] `packages/mcp-server/vitest.config.ts` — vitest config for mcp-server package
- [ ] `packages/mcp-server/package.json` — deps: @modelcontextprotocol/sdk, zod, elkjs-svg; scripts: test, build; bin field

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCP Inspector compliance — server starts, responds to tools/list | MCPS-07 | Requires spawning live server process + MCP Inspector tool | 1. Build: `pnpm --filter @calmstudio/mcp build` 2. Run: `npx @modelcontextprotocol/inspector dist/index.js` 3. Verify: tools/list returns all registered tools |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
