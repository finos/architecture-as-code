---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0009: tsup for calm-core Package Bundling

## Context and Problem Statement

`packages/calm-core` contains the canonical CALM 1.2 TypeScript types, Zod schemas, and validation logic. It must be published to npm as `@calmstudio/calm-core` with dual ESM+CJS output and TypeScript declaration files (`.d.ts`). The package is consumed by both Node.js tools (MCP server, CLI) and browser applications (the SvelteKit studio app). Correct output format and declaration file generation are critical for the package to work across all consumers.

## Considered Options

- **tsc only** — compile TypeScript directly to JavaScript using the TypeScript compiler. Produces `.js` and `.d.ts`. Requires manual configuration for ESM vs CJS output format and no tree-shaking.
- **tsup** — zero-config esbuild-powered TypeScript bundler. Produces ESM+CJS dual output with `.d.ts` generation in a single command.
- **Rollup** — flexible JavaScript bundler with rich plugin ecosystem. Mature, used by many libraries. Requires more configuration than tsup.

## Decision Outcome

Chosen: **tsup**, because it produces correct dual ESM+CJS output with TypeScript declarations in a single zero-config command (`tsup`). The esbuild core means builds complete in milliseconds. tsup handles the `exports` field in `package.json` correctly, including `./package.json` sub-path exports needed for bundler compatibility.

AJV (used for CALM JSON Schema validation) is marked as external in the tsup config — consumers install AJV via their own `package.json` rather than having it bundled inside `calm-core`.

### Consequences

- **Good:** Fast builds (esbuild). Zero-config for standard library output. Correct `.cjs`, `.mjs`, and `.d.ts` output file extensions. Works with Vite, webpack, Node.js `require()`, and `import` without additional configuration. Tree-shaking supported.
- **Neutral:** tsup adds a devDependency. Developers unfamiliar with tsup need to learn its config format (simpler than Rollup, but still a new tool). Esbuild does not run TypeScript type checking — a separate `tsc --noEmit` step is still needed for type safety.
- **Bad:** Less control over output than a hand-crafted Rollup config. If exotic output requirements emerge (e.g., IIFE for browser globals), tsup may need to be replaced or augmented.
