---
sidebar_position: 3
title: Contributing to CalmStudio
---

# Contributing to CalmStudio

This guide gets you from zero to an open PR in one read. It covers local setup, project structure, development workflow, testing, and the PR process.

CalmStudio follows FINOS open-source governance practices. Before contributing, review these files at the repository root:

- **[CONTRIBUTING.md](https://github.com/finos/calmstudio/blob/main/CONTRIBUTING.md)** — full contribution policy, DCO sign-off instructions, and PR requirements
- **[CODE_OF_CONDUCT.md](https://github.com/finos/calmstudio/blob/main/CODE_OF_CONDUCT.md)** — community standards
- **[SECURITY.md](https://github.com/finos/calmstudio/blob/main/SECURITY.md)** — vulnerability reporting process
- **[MAINTAINERS.md](https://github.com/finos/calmstudio/blob/main/MAINTAINERS.md)** — current maintainers list

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or later (required by `engine-strict` in the monorepo)
- Git with DCO sign-off configured (see CONTRIBUTING.md)

## Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/architecture-as-code.git
cd architecture-as-code

# Install all workspace dependencies (also installs husky hooks)
npm ci

# Verify everything works before making changes
npm run typecheck --workspaces --if-present
npm run test --workspaces --if-present
npm run build --workspaces --if-present
```

All three commands should exit 0. If they don't, check the [open issues](https://github.com/finos/calmstudio/issues) for known setup problems.

## Project Structure

CalmStudio is part of the `finos/architecture-as-code` npm workspaces monorepo. Each directory has a distinct responsibility:

```
calmstudio/
├── apps/
│   └── studio/          # SvelteKit web app (the main CalmStudio UI)
│       └── src/lib/     # canvas, editor, io, layout, palette, properties,
│                        #   stores, validation, governance, templates
├── packages/
│   ├── calm-core/       # CALM 1.2 TypeScript types and validation (published to npm)
│   ├── extensions/      # Node type packs (core, aws, gcp, azure, k8s, ai, fluxnova)
│   ├── mcp-server/      # MCP server — 21 tools for AI integration
│   └── calmscript/      # DSL compiler (deferred — not shipped in v1.0)
├── docs-site/           # Docusaurus documentation site
└── e2e/                 # Playwright E2E tests
```

When making changes:

- **UI features** → `apps/studio/src/lib/`
- **New node types** → `packages/extensions/src/packs/`
- **CALM types or validation** → `packages/calm-core/src/`
- **New MCP tools** → `packages/mcp-server/src/tools/`
- **Documentation** → `docs/docs/calm-studio/`

## Development Workflow

### Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-description
```

Use the same type prefix as your commit message (`feat/`, `fix/`, `docs/`, `chore/`, `test/`).

### Run the Dev Server

```bash
# Start the studio app in dev mode (from repo root)
npm run dev --workspace=@calmstudio/studio

# Or start the documentation site
npm run start --workspace=calmstudio-docs
```

### TypeScript Type Check

```bash
npm run typecheck --workspaces --if-present
```

TypeScript strict mode is enabled. There is no `any` allowed. Fix all type errors before opening a PR.

### Lint

```bash
npm run lint --workspaces --if-present
```

ESLint is configured for TypeScript strict linting. CalmStudio uses Svelte 5 runes (`$state`, `$derived`, `$effect`) — not the legacy Options API.

## Testing

CalmStudio follows London School TDD (outside-in). We write tests before implementation for new features.

### Test Types

| Type | Tool | File convention | Location |
|------|------|----------------|---------|
| Unit | Vitest | `*.test.ts` | Alongside source files |
| Integration | Vitest | `*.integration.test.ts` | Alongside source files |
| Component | Svelte Testing Library | `*.svelte.test.ts` | Alongside components |
| E2E | Playwright | `*.spec.ts` | `e2e/` directory |

### Run Tests

```bash
# All tests (from repo root)
npm run test --workspaces --if-present

# A specific package
npm run test --workspace=@calmstudio/calm-core

# E2E tests (requires dev server running)
npm run dev --workspace=@calmstudio/studio &
npm run test:e2e --workspace=@calmstudio/studio

# Watch mode during development
npm run test --workspace=@calmstudio/calm-core -- --watch
```

## Commit Conventions

Every commit must:

1. **Follow Conventional Commits** — `type(scope): description`
2. **Be signed off** — `git commit -s` (DCO)

```bash
git commit -s -m "feat(extensions): add monitoring pack with prometheus, grafana, alertmanager"
```

### Types and Scopes

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `test` | Tests only |
| `refactor` | Code change, no behavior change |
| `docs` | Documentation only |
| `chore` | Tooling, config, dependencies |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |

| Scope | Area |
|-------|------|
| `studio` | `apps/studio` |
| `calm-core` | `packages/calm-core` |
| `extensions` | `packages/extensions` |
| `mcp-server` | `packages/mcp-server` |
| `calmscript` | `packages/calmscript` |
| `docs` | Documentation |
| `ci` | CI/CD |
| `deps` | Dependency updates |

Commitlint runs as a husky hook on every commit and in CI. Non-conforming commits will be rejected.

## Opening a Pull Request

1. Push your branch to your fork: `git push origin feat/your-feature-name`
2. Open a PR against `finos/calmstudio:main` on GitHub
3. Fill in the PR template: summary, test plan, screenshots (for UI changes)
4. Wait for CI to pass (build, lint, typecheck, test, DCO check, REUSE license scan)

### CI Checks

| Check | What it verifies |
|-------|----------------|
| Build | `npm run build --workspaces --if-present` exits 0 |
| Lint | `npm run lint --workspaces --if-present` exits 0 |
| Typecheck | `npm run typecheck --workspaces --if-present` exits 0 |
| Test | `npm run test --workspaces --if-present` exits 0 |
| DCO | All commits have `Signed-off-by` |
| REUSE | All files have SPDX license headers |
| E2E | Playwright tests pass on the built app |
| Coverage | Coverage thresholds met |

### Review SLA

Maintainers acknowledge PRs within 3 business days. First review within 5 business days for non-trivial PRs. Small PRs (< 200 lines changed) typically reviewed within 2 business days.

If you haven't heard back after the SLA, ping `@calmstudio-maintainers` in the PR.

## License Headers

All source files must carry SPDX headers. The REUSE CI check enforces this.

```typescript
// TypeScript / JavaScript
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
```

```svelte
<!-- Svelte / HTML / Markdown -->
<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
```

## Getting Help

- **GitHub Discussions** — ask questions, propose ideas
- **GitHub Issues** — report bugs or request features
- **FINOS Community Slack** — `#calmstudio` channel ([join here](https://www.finos.org/blog/finos-community-slack))
- **CALM spec questions** — `#architecture-as-code` in FINOS Slack
