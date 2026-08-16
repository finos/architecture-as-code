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
- **Generate** (`commands/generate/`): Pattern → architecture instantiation. `flatten-allof.ts` composes `allOf` branches, `options.ts` resolves user decisions (`extractOptions`, `selectChoices`), and `instantiate.ts` materializes the result. See [Pattern Decisions](#pattern-decisions) before changing any of these.
- **Schema Directory** (`schema-directory.ts`): Registry of bundled CALM schemas, used for lookup by schema URL (`getSchema`).
- **Docify** (`docify/`): Documentation generator (`docifier`) with C4/relationship graphing (`docify/graphing`) and template bundles (`docify/template-bundles`, e.g. `ants`, `docusaurus`).
- **Resolver** (`resolver/`): CALM reference resolver plus the network-addressable extractor and validator.
- **Hub Client** (`hub/`): `calm-hub-client` for talking to CALM Hub.
- **View Model** (`view-model/`): ADR (Architecture Decision Record) view-model logic.
- **Auth** (`auth/`): Auth plugin abstraction (`auth-plugin`, `no-auth-plugin`).

## Pattern Decisions

A pattern expresses choice through two distinct kinds of object. Confusing them causes silent failures.

A **decision holder** is a relationship carrying `relationship-type.properties.options`. It is not part of the architecture — it poses a question and lists choice bundles, each naming candidates by `unique-id`. A **candidate** is a concrete node or relationship that may or may not reach the output; candidates live either in a `prefixItems` slot or in an `items.oneOf`/`items.anyOf` open catalog.

**Invariant: a decision holder must be declared in `properties.relationships.prefixItems`.** `extractOptions` (`options.ts:77`) discovers decisions solely via `getRelationshipsPrefixItems` (`options.ts:53`), which reads that path and nothing else. A holder placed inside an `items` catalog is never offered by `calm generate`, with no error on any path — the CLI takes its choices only from `promptUserForOptions` or `loadChoicesFromInput` (`cli/src/command-helpers/generate-options.ts:29,58`), and both go through `extractOptions`.

`allOf` composition is only partly supported here, and the support is narrower than it looks. `getRelationshipsPrefixItems` falls back to scanning `allOf` branches, but it `return`s on the **first** branch declaring `relationships.prefixItems` — so a holder in a later branch is invisible when an earlier branch also declares that path (measured: `extractOptions` returns `[]`). Note also that `extractOptions` runs on the **raw** pattern in the CLI, before `runGenerate` calls `flattenAllOf`, so no change to `allOf` flattening can repair this. Treat `allOf` for relationships as unsupported until that lookup unions across branches.

A candidate is included only when a chosen bundle names its `unique-id` (`options.ts:136,148`). A catalog with no holder pointing at it is therefore unreachable via `calm generate`; it remains reachable programmatically, since `selectChoices` accepts hand-built `CalmChoice` objects, which is how most existing tests drive it. When adding tests for decision behaviour, drive them through `extractOptions` rather than hand-building choices, or you will not be testing whether the decision is discoverable at all.

**Enforcement.** `pattern-option-relationship-must-be-in-prefix-items` (`spectral/rules-pattern.ts`, `error`) rejects a holder declared under `relationships.items.oneOf`/`anyOf`, including inside an `allOf` branch. It exists because the constraint is not expressible in JSON Schema — a catalog containing an options relationship is well-formed, so only the linter can state that the *decision* must be mandatory even when its answer may be empty. The other four decision rules keep their recursive-descent selectors (`$..relationship-type.properties.options...`) and still structurally validate a misplaced holder; that overlap is deliberate, since narrowing them would leave a misplaced holder with fewer diagnostics rather than more. Note that `pattern-nodes-must-be-referenced` (`warn`) does not help here: its function queries `$..relationship-type..*@string()` (`functions/pattern/node-has-relationship.ts:10`), so a holder in the wrong array still counts as referencing its candidates.

**Three implementations, no shared helper.** Catalog lookup and the oneOf-over-anyOf precedence rule are hand-written in three places: generation (`options.ts:142-148`), linting (`spectral/rules-pattern.ts:139-140` and its functions), and the Hub UI visualizer (`calm-hub-ui/.../patternTransformer.ts:73`, used at `:262` and `:446`). A change to how candidates are located or ordered needs all three, and nothing enforces that.

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
