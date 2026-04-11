<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Contributing to CalmStudio

Thank you for your interest in contributing to CalmStudio! This document explains how to get started, how we work, and what we expect from contributors.

CalmStudio is developed under the [FINOS](https://finos.org) umbrella and follows FINOS open-source governance practices.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Developer Certificate of Origin (DCO)](#developer-certificate-of-origin-dco)
- [Fork and Pull Request Workflow](#fork-and-pull-request-workflow)
- [Conventional Commits](#conventional-commits)
- [Local Development Setup](#local-development-setup)
- [Testing Expectations](#testing-expectations)
- [Code Review SLA](#code-review-sla)
- [License Headers](#license-headers)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Developer Certificate of Origin (DCO)

CalmStudio uses the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) in lieu of a Contributor License Agreement (CLA). The DCO is a lightweight way to assert that you have the right to submit your contribution and that you agree it can be incorporated under the project's Apache 2.0 license.

**Every commit must be signed off.** Add a `Signed-off-by` line to your commit messages using:

```bash
git commit -s -m "feat(studio): add canvas component"
```

This produces:

```
feat(studio): add canvas component

Signed-off-by: Your Name <your.email@example.com>
```

If you forget to sign off, you can amend your last commit:

```bash
git commit --amend -s
```

Or sign off multiple commits in a branch:

```bash
git rebase --signoff HEAD~N  # where N is the number of commits
```

DCO sign-off is verified automatically in CI via the DCO check on every pull request.

## Fork and Pull Request Workflow

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/calmstudio.git
   cd calmstudio
   ```
3. **Set upstream** remote:
   ```bash
   git remote add upstream https://github.com/finos/calmstudio.git
   ```
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
5. **Make your changes**, following the conventions below.
6. **Keep your branch up to date**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
7. **Push** to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
8. **Open a Pull Request** against `finos/calmstudio:main`.

All PRs require:
- Passing CI (build, lint, test, DCO, license scan, commitlint)
- At least one maintainer approval
- All conversations resolved

## Conventional Commits

We enforce [Conventional Commits](https://www.conventionalcommits.org/) via commitlint + husky. Every commit message must follow this format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
Signed-off-by: Your Name <email>
```

### Allowed Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `test` | Tests only |
| `refactor` | Code change with no new feature or fix |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, config |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |
| `revert` | Revert a previous commit |

### Allowed Scopes

| Scope | Package / area |
|-------|----------------|
| `studio` | `apps/studio` — SvelteKit web app |
| `desktop` | `apps/desktop` — Tauri shell |
| `calm-core` | `packages/calm-core` — CALM types and validation |
| `calmscript` | `packages/calmscript` — DSL parser and compiler |
| `mcp-server` | `packages/mcp-server` — MCP server for AI integration |
| `extensions` | `packages/extensions` — Extension pack system |
| `ci` | CI/CD pipeline and tooling |
| `docs` | Documentation |
| `deps` | Dependency updates |

### Examples

```
feat(calm-core): add validation for connect relationship
fix(studio): correct node handle position on re-render
chore(deps): update @xyflow/svelte to 0.1.34
docs(calmscript): document DSL grammar syntax
ci(ci): add OWASP dependency scan step
```

## Local Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/calmstudio.git
cd calmstudio

# Install all dependencies (installs husky hooks automatically)
pnpm install

# Verify everything works
pnpm typecheck
pnpm test
pnpm build
```

### Useful Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # TypeScript type check across all packages
pnpm lint             # Lint all packages
```

To work on a specific package:

```bash
cd packages/calm-core
pnpm typecheck
pnpm test
```

## Testing Expectations

CalmStudio follows London School TDD (outside-in test development). We expect:

- **New features**: accompanied by tests before implementation (TDD)
- **Bug fixes**: include a regression test that fails without the fix
- **Coverage target**: aim for meaningful coverage of business logic — we care about test quality, not hitting arbitrary percentages

Test types used in this project:

| Type | Tool | Location |
|------|------|----------|
| Unit | Vitest | `*.test.ts` alongside source |
| Integration | Vitest | `*.integration.test.ts` |
| Component | Svelte Testing Library | `*.svelte.test.ts` |
| E2E | Playwright | `e2e/` directory |

All tests must pass in CI. Flaky tests are treated as bugs.

## Code Review SLA

- **Maintainers acknowledge PRs** within 3 business days
- **First review** within 5 business days for non-trivial PRs
- **Small PRs** (< 200 lines) are typically reviewed within 2 business days

If you haven't heard back after the SLA, feel free to ping `@calmstudio-maintainers` in the PR.

## License Headers

All source files must carry SPDX headers. See existing files for examples:

**TypeScript/JavaScript/CJS:**
```typescript
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
```

**Markdown:**
```markdown
<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
```

**Svelte:**
```svelte
<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
```

CI will fail if license headers are missing (REUSE compliance check).

## Questions?

Open a GitHub Discussion or join the [FINOS Community Slack](https://www.finos.org/blog/finos-community-slack) in the `#calmstudio` channel.
