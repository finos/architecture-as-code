# FINOS CALM Monorepo - AI Assistant Guide

## Notes for supporting documentation

- When writing PR descriptions, do not describe every technical detail of the PR and don't include much, if any, code. Just explain any important decisions, technical gotchas that may not be obvious, and the overall intent of the PR. Link issues if possible.
- When writing issues, follow the same guidelines: do not write lots of code examples and thoroughly lay out the entire proposed implementation plan.
- When writing inline comments, do not explain exactly what the code does. Be concise, focusing on intent and any non-obvious gotchas.
- Write all the above in Simplified Technical English (ASD-STE100) where possible.

## Sandbox Folder for Working Files

**IMPORTANT:** Use the `/sandbox/` folder for all temporary working files, test outputs, notes, and drafts.

- The `sandbox/` folder is in `.gitignore` and will not be committed
- Store test plans, results, TODO lists, and exploration notes here
- Do NOT create working files in other directories (they may accidentally be committed)
- Clean up the sandbox when work is complete if appropriate

---

## Project Overview

This is the **FINOS Architecture as Code** monorepo containing the Common Architecture Language Model (CALM) specification and associated tools.

**CALM** is a declarative, JSON-based modeling language for describing complex software architectures, particularly in regulated environments like financial services.

## Monorepo Structure

```
architecture-as-code/
├── calm/                      # CALM specification (JSON schemas)
├── cli/                       # TypeScript CLI (@finos/calm-cli)
├── calm-hub/                  # Java/Quarkus REST API backend
├── calm-hub-ui/               # React frontend for CALM Hub
├── calm-server/               # TypeScript server (@finos/calm-server)
├── calm-plugins/vscode/       # VSCode extension
├── calm-models/               # TypeScript data models
├── calm-widgets/              # React visualization components
├── calm-ai/                   # AI agent tools & prompts
├── calm-studio/               # SvelteKit visual CALM editor — nested npm-workspace monorepo
├── calm-guard/                # Next.js continuous-compliance platform (CALMGuard)
├── shared/                    # Shared TypeScript utilities
├── docs/                      # Docusaurus documentation site
├── examples/                  # Example CALM documents — source of truth for the CALM Hub seed scripts
├── experimental/              # Experimental features
├── template-bundles/          # Reusable Handlebars template bundles
├── conferences/               # Conference/workshop material
├── brand/                     # Logo and brand assets
└── scripts/                   # Repo maintenance scripts (e.g. lockfile validation)
```

### Nested workspaces

`calm-studio/` and `calm-guard/` are products with their own internal structure, but their packages
are wired directly into the **root** npm workspaces. Run all npm commands from the repo root, never
from inside these folders.

- **`calm-studio/`** — a SvelteKit (Svelte 5) visual CALM editor, itself an npm-workspace monorepo.
  Its packages and app join the root workspaces via `calm-studio/packages/*` and `calm-studio/apps/*`.
  See [calm-studio/AGENTS.md](calm-studio/AGENTS.md) for the package list.
- **`calm-guard/`** — a Next.js (App Router) continuous-compliance platform (`calmguard`), plus its
  Docusaurus docs (`calmguard-docs`). Both are root workspaces.

## Technology Stack

- **TypeScript/Node.js** — everything except calm-hub. Built with tsup (esbuild), tested with
  vitest, managed as npm workspaces off a single root lockfile
  (see [Lockfile Regeneration](#lockfile-regeneration)).
- **Java/Maven** — calm-hub only (Quarkus 3.34+, MongoDB/NitriteDB, TestContainers). The root
  `pom.xml` is a reactor; `cli`, `calm`, `docs` and `shared` are POM-only placeholders.
- **Documentation** — Docusaurus, both for the main site and CALMGuard's `calmguard-docs`.

## Node Version Requirements

**Canonical Node version: 26.** `.nvmrc` pins `26.3.1`, CI reads it via
`node-version-file: '.nvmrc'`, and `engine-strict=true` in `.npmrc` blocks installs on anything
older. Node 26 is the only version builds and tests are validated against.

```bash
node --version   # MUST show v26.x.x
nvm use          # if not — reads .nvmrc → 26.3.1
```

Running on another major version breaks in ways that are slow to diagnose: native bindings
(`@swc/core`, `@tailwindcss/oxide`) resolve for the wrong ABI, and Node 26's global Web Storage API
shadows jsdom's `localStorage` in tests. `@types/node` is pinned to `^26` by a root `package.json`
override and by a Renovate `allowedVersions` rule, because transitive deps with loose constraints
will otherwise hoist an older major to the root and mask API differences.

Packages that touch `localStorage` or `sessionStorage` document their own stubbing pattern — see
[calm-hub-ui/AGENTS.md](calm-hub-ui/AGENTS.md) and [calm-studio/AGENTS.md](calm-studio/AGENTS.md).

### Lockfile Regeneration

**CRITICAL**: npm has a known bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) where
running `npm install` with an existing `node_modules` directory prunes optional platform-specific
dependencies (e.g. `@tailwindcss/oxide`, `@swc/core`, `@esbuild`) for platforms other than the
current machine. This causes CI failures on Linux runners when the lockfile was regenerated on macOS.

**Correct method** — always delete both `node_modules` and the lockfile:

```bash
rm -rf node_modules package-lock.json && npm install
```

**Never** regenerate the lockfile without deleting `node_modules` first. The `validate-lockfile`
CI workflow checks that all expected platform variants are present in `package-lock.json`.

## Package-Specific Guides

Read the guide for a package before working on its code, tests, or build.

- **[calm/AGENTS.md](calm/AGENTS.md)** - CALM JSON Meta Schema, schema change workflow, draft/release rules
- **[cli/AGENTS.md](cli/AGENTS.md)** - CLI commands, build pipeline, Commander.js patterns
- **[calm-hub/AGENTS.md](calm-hub/AGENTS.md)** - Java/Quarkus backend, storage modes, security
- **[calm-hub-ui/AGENTS.md](calm-hub-ui/AGENTS.md)** - React frontend, service patterns, component conventions
- **[calm-server/AGENTS.md](calm-server/AGENTS.md)** - TypeScript CALM server
- **[calm-plugins/vscode/AGENTS.md](calm-plugins/vscode/AGENTS.md)** - VSCode extension, MVVM architecture
- **[calm-widgets/AGENTS.md](calm-widgets/AGENTS.md)** - Widget system, Handlebars templates, common pitfalls
- **[shared/AGENTS.md](shared/AGENTS.md)** - Shared TypeScript utilities consumed across packages
- **[calm-studio/AGENTS.md](calm-studio/AGENTS.md)** - CalmStudio visual editor, CALM 1.2 rules, nested workspaces
- **[calm-guard/AGENTS.md](calm-guard/AGENTS.md)** - CALMGuard compliance platform, agents/skills

## Key Commands

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces, not from within
individual package directories. Any script below can be narrowed to one package with
`--workspace <name>`, e.g. `npm test --workspace cli`.

```bash
# npm workspaces (from the repository root)
npm run build              # Build all TypeScript workspaces
npm test                   # Test all TypeScript workspaces
npm run lint               # Lint all workspaces
npm run lint-fix           # Fix auto-fixable lint issues
npm run build:cli          # Build CLI and its dependencies
npm run build:shared       # Build shared packages
npm run link:cli           # Link the CLI globally for manual testing
npm run watch --workspace <name>   # Watch mode

# Maven reactor (from the repository root)
./mvnw clean install       # Build all Maven modules (mainly calm-hub)
./mvnw test                # Test all Maven modules
```

Package-specific development loops — CLI, VSCode extension, CALM Hub — live in that package's
AGENTS.md.

## Build Order Dependencies

```
TypeScript packages (npm workspaces) build in order:
  calm-models → calm-widgets → shared → cli → calm-plugins/vscode
```

Always build dependencies before dependent packages. The Maven reactor works this out for itself:
`./mvnw clean install`.

## Testing

**IMPORTANT**: All workspaces use `vitest run` for the test script, which runs tests once and exits.
Do NOT use `vitest` without `run` as it enters watch mode and will hang indefinitely.

**IMPORTANT FOR SHARED PACKAGE**:
If you modify the `shared` package, you **MUST** run tests for **ALL** workspaces (`npm run test`) because `shared` is a dependency for CLI, VSCode extension, and other packages. Changes in `shared` can break downstream consumers.

```bash
npm test -- --coverage         # TypeScript packages, with coverage
cd calm-hub && ../mvnw verify  # Java tests with coverage (JaCoCo on by default)

# One file — you must be at or below that package's directory so vitest.config.ts resolves
npx vitest run ${TEST_FILE}

# Java integration tests (requires Docker)
cd calm-hub && ../mvnw -P integration verify
```

All new code needs tests covering both success and error cases. Aim for >80% coverage on new code,
100% on critical paths.

## Commit Messages

**Conventional Commits**, enforced by commitlint via husky — invalid messages are rejected at commit
time. Format is `<type>(<scope>): <subject>`, subject with no trailing period.

- **type** (required, lowercase): `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`,
  `perf`, `ci`, `build`, `revert`
- **scope** (optional but preferred): `cli`, `shared`, `calm-widgets`, `calm-hub`, `calm-hub-ui`,
  `docs`, `vscode`, `deps`, `ci`, `release`

Run `npx cz` for an interactive prompt. Note that only commits scoped `(cli)` trigger a CLI release.

## Pre-Commit Checklist

Before considering any code change ready:

- [ ] **All tests pass with coverage**: `npm test -- --coverage` AND `cd calm-hub && ../mvnw verify`
- [ ] **All new code has tests** (unit and/or integration tests)
- [ ] **Linting passes**: `npm run lint` (0 errors)
- [ ] **Code builds successfully**: `npm run build` AND `./mvnw clean install`
- [ ] **Documentation updated** if behavior changed
- [ ] **Test coverage meets requirements** (>80% for new code)
- [ ] **Commit message follows Conventional Commits** (enforced by husky)

## Contributing

**CRITICAL:** Always create a feature branch for your changes and submit a pull request. Never commit directly to the main branch—direct commits will be rejected.

**CRITICAL:** Always use the repository PR template in `.github/pull_request_template.md` when creating or updating a pull request. Do not submit ad-hoc PR descriptions when a template exists; populate each section with accurate status.

Branch names are descriptive and conventional-commit-flavoured (`feat/add-caching`,
`fix/mongodb-timeout`). Work through the pre-commit checklist above before pushing, follow the
package-specific guide for whatever you touched, and make sure CI is green on the PR.

## Getting Help

- User docs: https://calm.finos.org (calm-hub also serves generated Swagger)
- Issues: https://github.com/finos/architecture-as-code/issues
- Discussions: https://github.com/finos/architecture-as-code/discussions
