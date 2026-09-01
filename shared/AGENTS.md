# Shared Package - AI Assistant Guide

## Project Overview

The `shared` package contains common utilities, helpers, and core logic used across the CALM monorepo. It is a critical dependency for:
- CLI (`@finos/calm-cli`)
- VSCode Extension (`calm-vscode-plugin`)
- CALM Models (`calm-models`)
- CALM Widgets (`calm-widgets`)

## Critical Development Rules

Also include all rules from [the root level AGENTS.md](../AGENTS.md).

### 1. Impact Analysis
**WARNING**: Changes in this package affect multiple downstream projects.
- **ALWAYS** run the full test suite (`npm run test` from root) after making changes here.
- Do not break existing public APIs unless absolutely necessary (and coordinated with all consumers).

### 2. Testing
Because this is a shared library, rigorous testing is mandatory.

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces.

```bash
# Run tests for this package only (from repository root)
npm test --workspace shared

# Build shared (+ deps) then run its tests in one step
npm run test:shared

# Run tests for ALL packages (REQUIRED before PR)
npm test

# If you want to test just one file run this. Make sure you're in the shared directory so it can resolve vitest.config.ts.
npx vitest run ${TEST FILE}
```

## Entry points: Node vs browser

`@finos/calm-shared` exposes two entry points via the package `exports` map:

| Entry | File | Audience |
|---|---|---|
| `@finos/calm-shared` | `src/index.ts` | CLI, calm-server, anything on Node. Registers winston logging and the JUnit formatter at load. |
| `@finos/calm-shared/browser` | `src/browser.ts` | Browser bundles (the docs learning lab, Studio/Guard). Validate (JSON Schema + Spectral), generate, diff (including `diff --timeline` via `diffTimeline`), `SchemaDirectory`, loaders, the CLI capability manifest. |

Rules:
- New modules are browser-safe by default. Node-only code (`fs`, `path`, `net`, `process.exit`, `__dirname`, winston, mkdirp, playwright) lives in a `*.node.ts` / `node-*.ts` module or in a wrapper that the root barrel imports — never imported from `browser.ts` or anything it reaches.
- Prefer seams over conditionals: pure core + Node wrapper (`generate-core.ts` / `generate.ts`, `diff-core.ts` / `diff.ts`, `validate-core.ts` / `validate.ts`), injected `DocumentLoader`s, registries (`registerNodeLoggerFactory`, `registerOutputFormatter`).
- `scripts/check-browser-entry.mjs` runs in `npm test`. It bundles `src/browser.ts` with esbuild for the browser and fails on any Node builtin request outside a four-entry allowlist (Spectral's dependency chain requests `fs`/`path`/`buffer` but never touches `fs`/`path` at runtime), then executes a real probe (`validate()`, `generate()`, `diffDocuments()`) with those builtins stubbed to throw. Do not extend the allowlist to make a red build green — fix the seam.
- Deep imports (`@finos/calm-shared/src/...`, `/dist/...`) are sealed by the `exports` map. Import from the barrel.
- Browser consumers bundling the entry must map the allowlisted builtins to nothing — webpack: `resolve.fallback: { fs: false, path: false, buffer: false }`; esbuild: the same stub plugin the guard uses.
- Not in the browser entry (follow-ups): template/docify (filesystem-bound loaders and output strategies), Hub read/write commands (CORS), diagram rasterisation, the standalone `timeline` command (synthesises from versioned architecture files on the local filesystem — `diff --timeline` via `diffTimeline` is supported).

## Key Components

- **Document Loader** (`document-loader/`): Strategies for loading CALM documents — FileSystem, MultiStrategy, plus CalmHub, direct-URL, and mapped loaders. Also `InMemoryDocumentLoader` (pass-a-map loader for tests and embedders) and `buildBrowserDocumentLoader` (the browser-entry loader factory, `document-loader/browser-document-loader.ts`).
- **Template Processor** (`template/`): Handlebars-based template generation logic.
- **Model Visitors** (`model-visitor/`): Visitor pattern implementations for traversing CALM models.
- **Validation** (`commands/validate/`, `spectral/`): Core validation logic (Spectral integration) and output enrichment.
  - `validate()` - Main validation function (`commands/validate/validate.ts`) used by CLI and VSCode
  - `enrichWithDocumentPositions()` - Adds precise line/character positions to validation output using `@stoplight/json`
  - `parseDocumentWithPositions()` - Parses JSON/YAML with position tracking for error location
- **Schema Directory** (`schema-directory.ts`): Registry of bundled CALM schemas, used for lookup by schema URL (`getSchema`).
- **Docify** (`docify/`): Documentation generator (`docifier`) with C4/relationship graphing (`docify/graphing`) and template bundles (`docify/template-bundles`, e.g. `ants`, `docusaurus`).
- **Resolver** (`resolver/`): CALM reference resolver plus the network-addressable extractor and validator.
- **Hub Client** (`hub/`): `calm-hub-client` for talking to CALM Hub.
- **View Model** (`view-model/`): ADR (Architecture Decision Record) view-model logic.
- **Auth** (`auth/`): Auth plugin abstraction (`auth-plugin`, `no-auth-plugin`).

## Common Workflows

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces, not from within this package directory.

### Building
```bash
# Build this package (from repository root)
npm run build --workspace shared

# Build shared and its TypeScript dependencies (calm-models + calm-widgets + shared)
npm run build:shared
```

This package builds with `tsc` (not tsup/esbuild): `tsc -p ./tsconfig.build.json` followed by the
`copy:docify-template-bundle` post-build step (`scripts/copy-templates.mjs`), which copies the docify
template bundles into `dist`. `npm test --workspace shared` also runs `scripts/check-browser-entry.mjs`
first, an esbuild-based guard that bundles `src/browser.ts` for the browser and fails the test run if it
pulls in a Node builtin outside its allowlist or touches one at runtime — see "Entry points: Node vs
browser" above.

#### Build configuration
`tsconfig.build.json` is the production build config. It enables `"strict": true` and **excludes** spec
files (`**/*.spec.ts`) and `src/docify/**`. This means specs and the `docify/` module are not strictly
type-checked, but **all other new code must compile under strict mode**.

### Testing Changes
1. Make changes in `shared/src/...`
2. Run local tests: `npm test --workspace shared`
3. Run consumer tests (e.g., CLI): `npm test --workspace cli`
4. Run ALL tests: `npm test`
