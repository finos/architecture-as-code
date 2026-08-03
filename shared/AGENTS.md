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

## Key Components

- **Document Loader** (`document-loader/`): Strategies for loading CALM documents — FileSystem, MultiStrategy, plus CalmHub, direct-URL, and mapped loaders.
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
template bundles into `dist`.

#### Build configuration
`tsconfig.build.json` is the production build config. It enables `"strict": true` and **excludes** spec
files (`**/*.spec.ts`) and `src/docify/**`. This means specs and the `docify/` module are not strictly
type-checked, but **all other new code must compile under strict mode**.

### Testing Changes
1. Make changes in `shared/src/...`
2. Run local tests: `npm test --workspace shared`
3. Run consumer tests (e.g., CLI): `npm test --workspace cli`
4. Run ALL tests: `npm test`
