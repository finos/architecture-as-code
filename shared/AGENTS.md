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

A **decision holder** is a relationship that carries `relationship-type.properties.options`.
It poses a question and lists choice bundles. A **candidate** is a node or relationship that
a bundle can select. Candidates are declared in four places: a plain `prefixItems` entry, a
`prefixItems[i].oneOf` or `.anyOf` alternative, or an `items.oneOf`/`items.anyOf` catalog.

**A decision holder must be in `properties.relationships.prefixItems`.** `extractOptions`
(`options.ts:65`) finds decisions only through `getRelationshipsPrefixItems` (`options.ts:55`),
which never reads the `items` catalog. A holder in a catalog is never offered, on any path.

A candidate reaches the output only when a chosen bundle names its `unique-id`. Drive new
tests from `extractOptions`, not from hand-built choices, or you do not test whether the
decision is discoverable. See `catalog-decisions.spec.ts`.

### Three questions, three owners

Use the wrong one and the failure is silent, so they are separate named functions.

| Question | Function | Home |
|---|---|---|
| What does *this block* offer? (`oneOf` wins) | `readChoiceBlock` | `@finos/calm-models/pattern` |
| What does the pattern *declare*? (both keywords) | `listCandidates` | `@finos/calm-models/pattern` |
| What can selection *reach*? (one keyword) | `listSelectableCandidates` | `@finos/calm-models/pattern` |

Use *declared* for what a document says: uniqueness, dangling references. Use *selectable*
for "can this answer be honoured". They differ only where a block declares both keywords.

`getPatternArray` locates the `prefixItems` array and `items` catalog for a property.

### `allOf` has three unreconciled meanings

Treat `allOf` for nodes and relationships as unsupported.

| Reader | Behaviour |
|---|---|
| `deepMergeSchemas` (`flatten-allof.ts`) | shallow merge; a repeated property loses `type`, so `instantiate` emits `{}` |
| `getPatternArray` | first branch wins, later branches ignored; marked TEMPORARY |
| `listCandidates` / `listSelectableCandidates` | ignore `allOf` entirely, to keep `path` correct for diagnostics |

A pattern whose `prefixItems`/`items` sits under `allOf` yields no candidates at all from the
readers, and `deepMergeSchemas` may still merge it (lossily) for `calm generate`. `allOf` means
**intersection**, never union, because `calm validate` never flattens. `shared` previously kept
its own copy of `listCandidates` that followed `allOf` through `getPatternArray`, disagreeing
with the `calm-models` copy and reporting a `path` the document did not contain; nothing tested
or relied on that behaviour, so the copy was removed rather than reconciled. Correct `allOf`
support for nodes and relationships is still unbuilt — this only removed a second, wrong answer,
it did not add support.

### Enforcement

`calm generate` **never validates**. These rules run only on `calm validate`.

| Rule | Severity | Catches |
|---|---|---|
| `pattern-option-relationship-must-be-in-prefix-items` | `error` | a holder inside an `items` catalog |
| `pattern-decision-must-reference-selectable-nodes` / `-relationships` | `error` | a bundle naming a declared but unreachable candidate |
| `group-relationship-with-const-nodes-references-existing-nodes-in-pattern` | `error` | a bundle naming an id that does not exist |
| `pattern-items-catalog-must-declare-one-choice-keyword` | `warn` | a block declaring both keywords |

The generate path has its own guard. `assertChoicesAreSelectable` throws from `runGenerate`.
It is not called from `selectChoices`, because validation calls that too.

`pattern-nodes-must-be-referenced` does not help with holder placement. Its query
(`node-has-relationship.ts:10`) matches a holder in the wrong array.

### Still duplicated

Nothing keeps this pair in step. `listCandidates`'s own duplicate (`shared/src/pattern-candidates.ts`)
is gone — both `listCandidates` and `listSelectableCandidates` now live only in `@finos/calm-models/pattern`.

| Duplicate | Sites | Note |
|---|---|---|
| decision-holder reading | `options.ts:25,29`, `patternTransformer.ts:290,317` | already differ: one unions both keywords, the other picks `oneOf` |

`calm-hub-ui` depends on `@finos/calm-models` and not on `shared`, so a shared reader must
live in `calm-models`.

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
