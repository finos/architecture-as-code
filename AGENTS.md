# FINOS CALM Monorepo - AI Assistant Guide

## Notes for supporting documentation

- All documentation should be as concise as possible and should avoid explaining *everything*. Focus on the most significant details for a human reader.
- When writing PR descriptions, do not describe every technical detail of the PR and don't include much, if any, code. Just explain any important decisions, technical gotchas that may not be obvious, and the overall intent of the PR. Link issues if possible.
- When writing issues, follow the same guidelines: do not write lots of code examples and thoroughly lay out the entire proposed implementation plan. Prefer tables over lists of options, but don't put too much in each table cell.
- When writing inline comments, do not explain exactly what the code does. Be concise, focusing on intent and any non-obvious gotchas.
- Don't add comments to code that doesn't need them. Code should ideally be self-documenting.
- When replying to review feedback, give the conclusion and the change only — "Confirmed, fixed in abc1234" is a complete reply. Do not repeat evidence the reviewer can read for themselves, do not explain how the mistake happened, and do not volunteer follow-up work nobody asked for. If you disagree, give the reason in a sentence or two and stop.
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
├── calm-lab/                  # Standalone learning lab app (lab.calm.finos.org)
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

- **TypeScript/Node.js** — every package except the Java modules below. Built with tsup (esbuild),
  tested with vitest, managed as npm workspaces off a single root lockfile
  (see [Lockfile Regeneration](#lockfile-regeneration)).
- **Java/Maven** — the root `pom.xml` is a reactor over six modules. Two carry Java code: `calm-hub`
  (Quarkus 3.34+, MongoDB/NitriteDB, TestContainers) and `calm-models` (a plain jar). `cli`, `calm`,
  `docs` and `shared` are POM-only placeholders. Note that `calm-models` is built by both toolchains
  — it is an npm workspace *and* a Maven module.
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

## CALM Schema Updates

The tools get the CALM schema from the `@finos/calm-schema` npm package. The root `package.json`
pins the latest release as `@finos/calm-schema`, and each release by a `calm-schema-<major.minor>`
alias (see [cli/AGENTS.md](cli/AGENTS.md#schema-handling)). Renovate raises `@finos/calm-schema`
updates in their own PR. That PR must also pin the alias of that release to the same version.

`.github/workflows/calm-schema-compatibility.yml` builds and tests each tool against a new release,
with the commands of its `build-*.yml` workflow (listed in `scripts/calm-schema-compat.mjs`). It
stops before the tests if the version is not on npm. If a tool fails, the workflow opens one issue
for that release (label `calm-schema-compatibility`), or comments on the open issue. The issue asks
for `Closes #<issue>` in the PR that moves `@finos/calm-schema` to the release, so that the merge
closes it. A run on the default branch in which all tools pass also closes it. A manual run on
another branch only comments on the open issue: it never opens or closes one. The workflow does
not reopen a closed issue: a new failure gets a new issue. `cli-hub-smoke.yml` is not in the
matrix: it tests the CLI against a CALM Hub image, and the cli and calm-hub jobs already test the
schema.

| Trigger | Version | Notes |
|---|---|---|
| `repository_dispatch` | `client_payload.version` | From the finos/calm-schema publish workflow: `event_type: calm-schema-published`, `client_payload: {"version": "x.y.z"}`. Waits up to about five minutes for the version on npm |
| Daily schedule | npm `latest` | Skips the pinned version, a version with any issue (open or closed), and a version that passed |
| Manual run | `version` input, or npm `latest` | Always runs. Run it on a fix branch to test the fix |

calm-hub fails for each new `major.minor` release until its schema index files list the release
(see [calm-hub/AGENTS.md](calm-hub/AGENTS.md)).

To test a tool locally, run `node scripts/calm-schema-compat.mjs use <version>`, then
`node scripts/calm-schema-compat.mjs test <tool>`. The `use` command changes `package.json` and
`package-lock.json` as the update PR must, with `npm install --package-lock-only`, then runs
`npm ci`. It never installs over an existing `node_modules`, because that can prune other
platforms' packages from the lockfile. If your PR does not update the schema, restore both files
(`git checkout -- package.json package-lock.json`) and run `npm ci` when you are done.

## Package-Specific Guides

Read the guide for a package before working on its code, tests, or build.

- **[calm/AGENTS.md](calm/AGENTS.md)** - CALM JSON Meta Schema, schema change workflow, draft/release rules
- **[cli/AGENTS.md](cli/AGENTS.md)** - CLI commands, build pipeline, Commander.js patterns
- **[calm-hub/AGENTS.md](calm-hub/AGENTS.md)** - Java/Quarkus backend, storage modes, security
- **[calm-hub-ui/AGENTS.md](calm-hub-ui/AGENTS.md)** - React frontend, service patterns, component conventions
- **[calm-lab/AGENTS.md](calm-lab/AGENTS.md)** - In-browser learning lab, browser-engine contract, deploy
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
                                     ↳ calm-lab
```

Always build dependencies before dependent packages. The Maven reactor works this out for itself:
`./mvnw clean install`.

`calm-lab` consumes the compiled `@finos/calm-shared/browser` entry, so `shared` must be built
first — `npm run build:calm-lab` chains the whole order for you.

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

Run `npx cz` for an interactive prompt.

Type and scope drive the automated release, so neither is cosmetic: `cli/.releaserc.json` releases
on the `cli`, `shared`, `calm-models`, `calm-ai` and `calm-widgets` scopes, and its fallback rule
also releases any *unscoped* `feat`, `fix`, `perf` or `revert`. Check that file before assuming a
commit is release-neutral.

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
