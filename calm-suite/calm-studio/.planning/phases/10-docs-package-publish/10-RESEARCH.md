# Phase 10: Docs & Package Publish - Research

**Researched:** 2026-03-15
**Domain:** Docusaurus 3 documentation sites, tsup library publishing, GitHub Pages deployment, ADR authoring
**Confidence:** HIGH

## Summary

Phase 10 delivers two independent artifacts: a Docusaurus documentation site deployed to GitHub Pages, and `@calmstudio/calm-core` published to npm as a standalone package. Both are incremental — calm-core already exists as a private monorepo package with a `.releaserc.json` and semantic-release wired up; the docs site is net-new but bootstraps from a standard Docusaurus scaffold.

The main technical work is: (1) scaffold a `docs-site/` Docusaurus app in the monorepo, configure it for GitHub Pages, hook up TypeDoc auto-generation for the calm-core API reference, write the authored content (getting started, guides, ADRs), and add a Pages deploy GitHub Action; (2) add tsup to calm-core, update `package.json` exports and remove `private: true`, and verify the existing multi-semantic-release release workflow will publish it correctly to npm.

Docusaurus 3.9.2 is the current stable version and is the FINOS-recommended docs framework. The `docusaurus-plugin-typedoc` + `typedoc-plugin-markdown` stack is the standard approach for auto-generating API reference from TypeScript source and embedding it into a Docusaurus site — this satisfies DOCS-01 API reference requirement with minimal hand-writing. ADRs should use MADR 4.0 format stored in `docs-site/docs/adrs/` — Docusaurus indexes them automatically and its search makes them discoverable.

**Primary recommendation:** Scaffold Docusaurus in `docs-site/` (separate from the existing `docs/` assets directory), integrate TypeDoc for calm-core API reference, add tsup build to calm-core, and deploy everything via GitHub Actions on merge to main.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Docs framework:** Docusaurus — both User Guide (architects) and Developer Guide (integrators) equally served
- **Quick start:** 5-minute guide only — install, open, drag nodes, export JSON. One page.
- **Screenshots:** 5-8 annotated screenshots included (canvas, properties panel, governance panel, C4 view, template picker)
- **FINOS branding:** FINOS ecosystem positioning prominent — link to calm.finos.org, AIGF, architecture-as-code repo. FINOS logo in header.
- **ADR format:** MADR (Markdown Any Decision Record) — Title, Status, Context, Decision, Consequences
- **ADR location:** `docs/adrs/` — auto-indexed by Docusaurus, searchable on docs site
- **ADR source:** ~10 ADRs from PROJECT.md Key Decisions table
- **calm-core build:** tsup — ESM + CJS with .d.ts declarations
- **calm-core API surface:** CALM types + Validation + AIGF catalogue (no test-fixtures in public API)
- **calm-core versioning:** Semantic release for automated versioning from conventional commits
- **calm-core README:** Standalone README with install, quick example, API overview, link to full docs
- **Hosting:** GitHub Pages — free, standard for FINOS projects
- **Domain:** Default GitHub Pages URL (no custom domain for now)
- **Deploy trigger:** Auto-deploy on merge to main via GitHub Action

### Claude's Discretion
- Docusaurus theme/color scheme
- Exact docs sidebar navigation structure
- TypeDoc vs hand-written API reference
- ADR numbering scheme

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | Docusaurus site with getting started guide, architecture overview, and API reference | Docusaurus 3.9.2 scaffold + docusaurus-plugin-typedoc for auto-generated API reference |
| DOCS-02 | Architecture Decision Records (ADRs) for key v1.0 decisions | MADR 4.0 template; ~10 ADRs sourced from PROJECT.md Key Decisions table; stored in `docs-site/docs/adrs/` |
| DOCS-03 | Extension pack development guide (create custom packs) | Authored markdown; content sourced from `packages/extensions/src/packs/` and `PackDefinition` type |
| DOCS-04 | MCP server usage guide for AI tool integration | Authored markdown; content sourced from `packages/mcp-server/` and existing README |
| DOCS-05 | Contributor guide (setup, testing, PR workflow, DCO) | Authored markdown; thin wrapper referencing existing CONTRIBUTING.md rather than duplicating it |
| CORE-01 | `@calmstudio/calm-core` published to npm with README, API docs, independent versioning | tsup build config, remove `private: true`, npm publish via existing multi-semantic-release + release.yml workflow |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @docusaurus/core | 3.9.2 | Docs site framework | FINOS-recommended; React + MDX static site with search, versioning, dark mode |
| @docusaurus/preset-classic | 3.9.2 | Bundled preset: docs, blog, pages, search | Includes everything needed out of the box |
| tsup | ^8.x | Bundle calm-core to ESM + CJS + .d.ts | Zero-config, esbuild-powered; standard for TS library publishing in 2025 |
| typedoc | ^0.27 | Generate API docs from TypeScript source | Standard TS doc generator |
| typedoc-plugin-markdown | ^4.x | Render TypeDoc output as Markdown | Required by docusaurus-plugin-typedoc |
| docusaurus-plugin-typedoc | ^1.x | Integrate TypeDoc into Docusaurus build | Single source of truth: code comments → docs site |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @docusaurus/plugin-search-local | 3.9.2| Offline full-text search | Free alternative to Algolia; sufficient for FINOS project scale |
| actions/upload-pages-artifact | v3 | GitHub Action: upload Pages artifact | Required by GitHub Pages deployment workflow |
| actions/deploy-pages | v4 | GitHub Action: deploy to Pages | Required by GitHub Pages deployment workflow |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docusaurus-plugin-typedoc (auto-generated) | Hand-written API reference | Hand-written is higher quality but costly to maintain; auto-generated keeps API docs in sync with source |
| tsup | tsc directly | tsc alone doesn't produce a bundled CJS/ESM dual output; tsup adds esbuild speed and automatic .cjs/.js output extensions |
| multi-semantic-release (already configured) | Changesets | Already wired; switching is unnecessary churn |

**Installation for docs-site:**
```bash
pnpm create docusaurus@latest docs-site classic --typescript
# Then in docs-site/:
pnpm add --save-dev typedoc typedoc-plugin-markdown docusaurus-plugin-typedoc
```

**Installation for calm-core:**
```bash
pnpm --filter @calmstudio/calm-core add --save-dev tsup
```

---

## Architecture Patterns

### Recommended Project Structure
```
calmstudio/
├── docs/                    # EXISTING — raw AIGF/CALM spec files (unchanged)
│   ├── images/              # Screenshots for docs site
│   └── AIGF_CATALOGUE.json  # etc.
├── docs-site/               # NEW — Docusaurus site root
│   ├── docs/
│   │   ├── getting-started/ # Quick start + install guide
│   │   ├── user-guide/      # Architects: canvas, C4 view, governance, templates
│   │   ├── developer-guide/ # Integrators: extension packs, MCP, contributing
│   │   ├── api/             # Auto-generated by docusaurus-plugin-typedoc (do not edit manually)
│   │   └── adrs/            # MADR ADR files (0001-*, 0002-*, …)
│   ├── static/
│   │   └── img/             # FINOS logo, favicons, annotated screenshots
│   ├── src/
│   │   └── css/             # Custom CSS (FINOS color palette if desired)
│   ├── docusaurus.config.ts
│   ├── sidebars.ts
│   └── package.json
├── packages/
│   └── calm-core/
│       ├── src/             # UNCHANGED source
│       ├── dist/            # NEW — tsup build output (gitignored)
│       ├── tsup.config.ts   # NEW
│       ├── package.json     # UPDATED: private:false, exports, build script
│       └── README.md        # NEW — standalone npm README
└── .github/
    └── workflows/
        ├── ci.yml           # EXISTING
        ├── release.yml      # EXISTING — already publishes; add tsup build step
        └── docs.yml         # NEW — build + deploy Docusaurus to GitHub Pages
```

### Pattern 1: Docusaurus with TypeDoc API Reference

**What:** TypeDoc reads calm-core's TypeScript source (via `entryPoints`), generates Markdown, and Docusaurus includes it as a docs section during build.

**When to use:** Any TypeScript library that needs API reference that stays in sync with source code.

**Example (docusaurus.config.ts):**
```typescript
// Source: https://www.typedoc-plugin-markdown.org/plugins/docusaurus/quick-start
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'CalmStudio',
  tagline: 'Visual architecture diagrams that produce validated CALM code',
  url: 'https://finos.github.io',
  baseUrl: '/calmstudio/',
  organizationName: 'finos',
  projectName: 'calmstudio',
  trailingSlash: false,
  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../packages/calm-core/src/index.ts'],
        tsconfig: '../packages/calm-core/tsconfig.json',
        out: 'api',
        sidebar: {
          categoryLabel: 'API Reference',
          position: 4,
        },
      },
    ],
  ],
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: './sidebars.ts' },
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
};

export default config;
```

### Pattern 2: tsup Dual ESM+CJS Build for calm-core

**What:** tsup bundles `src/index.ts` to both ESM (`.js`) and CJS (`.cjs`) with type declarations. Package exports field routes consumers to the correct format.

**When to use:** Any TypeScript library targeting both Node.js (CJS) and modern bundlers (ESM) consumers.

**tsup.config.ts:**
```typescript
// Source: https://tsup.egoist.dev/ + https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,   // keep false for libraries — splitting is for apps
  treeshake: true,
});
```

**Updated package.json exports (calm-core):**
```json
{
  "name": "@calmstudio/calm-core",
  "version": "0.0.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "echo \"no-op\" && exit 0"
  }
}
```

Note: The `test-fixtures` export must be removed from the public `exports` map — it should not be in the published package (use `.npmignore` or `files` field to exclude `test-fixtures/` directory entirely from published tarball).

### Pattern 3: GitHub Pages Deploy Workflow

**What:** Docusaurus builds to a static directory; the GitHub Action uploads it as a Pages artifact and deploys it.

**When to use:** Any static site hosted on GitHub Pages using the modern Actions-based deployment (not the legacy gh-pages branch approach).

**docs.yml:**
```yaml
# Source: https://docusaurus.io/docs/deployment
name: Deploy Docs

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write   # REQUIRED for OIDC verification

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-docs:
    name: Build Docusaurus
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for git history (used by some TypeDoc plugins)

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build calm-core (TypeDoc needs compiled types)
        run: pnpm --filter @calmstudio/calm-core run build

      - name: Build docs site
        run: pnpm --filter calmstudio-docs run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs-site/build

  deploy-docs:
    name: Deploy to GitHub Pages
    needs: build-docs
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Pattern 4: MADR ADR Format

**What:** MADR 4.0 is the current version. Each ADR is a Markdown file in `docs-site/docs/adrs/`. Docusaurus indexes them and its search makes them discoverable.

**ADR front matter + required sections:**
```markdown
---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0001: Use Svelte 5 over React

## Context and Problem Statement
[2-3 sentences describing the problem]

## Considered Options
- Svelte 5
- React 18

## Decision Outcome
Chosen: **Svelte 5**, because [rationale].

### Consequences
- Good: [positive outcomes]
- Neutral: [tradeoffs]
- Bad: [negative outcomes]
```

ADR numbering: four-digit zero-padded (`0001`, `0002`, …), derived from PROJECT.md Key Decisions table. ~10 ADRs to write.

### Anti-Patterns to Avoid

- **Using `docs/` as the Docusaurus root:** The existing `docs/` directory contains CALM/AIGF spec files, not a Docusaurus app. Name the new directory `docs-site/` to avoid collision.
- **Committing `dist/` in calm-core:** tsup outputs to `dist/` — add `packages/calm-core/dist/` to `.gitignore`. The release workflow publishes from the built artifact, not from git.
- **Using `splitting: true` in tsup for libraries:** Code splitting is for applications. Libraries should keep splitting off to avoid import path complexity.
- **Keeping `test-fixtures` export in public package.json:** The `./test-fixtures` export must be removed before publishing. Use the `files` field to only include `dist/` and `README.md`.
- **Pointing TypeDoc at compiled output:** Point TypeDoc `entryPoints` at the TypeScript source (`src/index.ts`), not at `dist/`. TypeDoc reads TS source directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript → Markdown API docs | Custom script parsing types | typedoc + typedoc-plugin-markdown | TypeDoc handles generics, union types, JSDoc comments, interface inheritance |
| ESM/CJS dual output with .d.ts | Custom tsc + rollup pipeline | tsup | Handles output extensions (.cjs/.js), declaration maps, sourcemaps, tree-shaking |
| Versioning calm-core on npm | Custom version-bumping script | multi-semantic-release (already configured) | Already wired in `.releaserc.json` + `release.yml`; adding tsup build is the only change needed |
| Static site search | Custom search implementation | @docusaurus/plugin-search-local | Works offline, no Algolia account, sufficient for project scale |
| GitHub Pages deployment | gh-pages branch push script | actions/deploy-pages@v4 | Modern OIDC-verified deployment; avoids orphan branch management |

**Key insight:** The heavy lifting (versioning, release, search) is already solved. This phase is assembly — wire existing pieces together, don't rebuild them.

---

## Common Pitfalls

### Pitfall 1: `docs/` Directory Collision
**What goes wrong:** Scaffolding Docusaurus into `docs/` (the existing directory used for AIGF JSON and spec files) breaks those assets and confuses the site's content structure.
**Why it happens:** `create-docusaurus` defaults to `my-website` but developers rename it `docs`.
**How to avoid:** Use `docs-site/` as the Docusaurus root. Update `docusaurus.config.ts` with `url` and `baseUrl` pointing to the GitHub Pages URL.
**Warning signs:** Build errors referencing AIGF_CATALOGUE.json or CALM_1.2_CONTROLS_SCHEMA.md as broken Docusaurus pages.

### Pitfall 2: TypeDoc Cannot Find Types
**What goes wrong:** docusaurus-plugin-typedoc fails with "Cannot find entry point" or produces empty API docs.
**Why it happens:** The calm-core package currently exports raw `.ts` files (not compiled output). TypeDoc needs the TypeScript source and a valid `tsconfig.json` with correct `rootDir`.
**How to avoid:** In `docusaurus.config.ts`, set `entryPoints: ['../packages/calm-core/src/index.ts']` and `tsconfig: '../packages/calm-core/tsconfig.json'`. Run `pnpm build` for calm-core first in the docs workflow.
**Warning signs:** Empty `/docs/api` section after build, or TypeDoc output with 0 exports.

### Pitfall 3: `private: true` Blocks npm Publish
**What goes wrong:** The release workflow runs without errors but calm-core never appears on npm.
**Why it happens:** `@semantic-release/npm` respects `"private": true` and silently skips publish.
**How to avoid:** Set `"private": false` in `packages/calm-core/package.json` as part of this phase. Verify with `npm pack --dry-run` before release.
**Warning signs:** Release workflow completes, GitHub release tag created, but `npm show @calmstudio/calm-core` returns 404.

### Pitfall 4: GitHub Pages `baseUrl` Mismatch
**What goes wrong:** CSS, images, and navigation links return 404 on the deployed Pages site.
**Why it happens:** Docusaurus needs `baseUrl: '/calmstudio/'` (matching the GitHub repo name) when hosted at `https://finos.github.io/calmstudio/`.
**How to avoid:** Set `url: 'https://finos.github.io'` and `baseUrl: '/calmstudio/'` in `docusaurus.config.ts`. Set `trailingSlash: false`.
**Warning signs:** Site home page loads but all internal links and assets return 404.

### Pitfall 5: Missing `id-token: write` Permission for Pages Deploy
**What goes wrong:** `actions/deploy-pages` fails with OIDC authentication error.
**Why it happens:** The GitHub Pages deploy action requires OIDC to verify the deployment origin. Missing permission causes the workflow to fail at the deploy step.
**How to avoid:** Set `id-token: write` alongside `pages: write` in the workflow permissions block (see Pattern 3).
**Warning signs:** Error: "Error: The artifact does not exist or cannot be found" or OIDC token failure in deploy job.

### Pitfall 6: AJV Bundled Twice in calm-core dist
**What goes wrong:** Consumers get duplicate AJV in their bundle; validation may produce unexpected behavior.
**Why it happens:** tsup bundles all dependencies by default unless they're marked external.
**How to avoid:** In `tsup.config.ts`, set `external: ['ajv', 'ajv-formats']` — these are listed in `dependencies` (not devDependencies) so they should be peer/runtime deps in the published package, not bundled.
**Warning signs:** Bundle size much larger than source; `npm pack` output includes ajv source code in dist.

---

## Code Examples

### Running Docusaurus locally in the monorepo

```bash
# From repo root
pnpm --filter calmstudio-docs start
# or directly
cd docs-site && pnpm start
```

### Verifying calm-core publish contents before releasing

```bash
# From packages/calm-core/
pnpm build   # runs tsup
npm pack --dry-run
# Should list only: dist/, README.md, package.json, CHANGELOG.md
# Should NOT list: src/, test-fixtures/, *.test.ts
```

### Consuming calm-core in an external project (post-publish)

```typescript
// ESM import
import { CalmArchitecture, CalmNode, validateArchitecture } from '@calmstudio/calm-core';

const arch: CalmArchitecture = {
  nodes: [
    {
      'unique-id': 'web-app',
      'node-type': 'service',
      name: 'Web Application',
      description: 'Frontend SPA',
    },
  ],
  relationships: [],
};

const result = validateArchitecture(arch);
console.log(result.valid); // true
```

### ADR file naming convention

```
docs-site/docs/adrs/
  0001-use-svelte-5-over-react.md
  0002-use-svelte-flow-as-canvas.md
  0003-use-elk-for-auto-layout.md
  0004-domain-oriented-control-keys.md
  0005-defer-calmscript-dsl.md
  0006-extension-pack-system.md
  0007-mcp-server-as-primary-ai-integration.md
  0008-docusaurus-for-documentation.md
  0009-tsup-for-calm-core-packaging.md
  0010-github-pages-hosting.md
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gh-pages branch push | actions/deploy-pages@v4 with OIDC | GitHub 2022+ | Simpler workflow, no orphan branch, OIDC verified |
| TypeDoc → raw HTML | TypeDoc → Markdown via typedoc-plugin-markdown | 2023+ | Embeds cleanly into Docusaurus without iframe hacks |
| tsc + custom bundler | tsup (esbuild-powered) | 2022+ | 10-100x faster builds, zero-config dual output |
| Manual ADR docs | MADR 4.0 structured templates | MADR 4.0 released 2024-09-17 | Consistent structure, "bare" and "minimal" template variants |

**Deprecated/outdated:**
- `gh-pages` npm package: Old approach to deploying to GitHub Pages via `gh-pages` branch; replaced by `actions/deploy-pages`.
- Docusaurus v2: EOL; current version is v3 (3.9.2). Migration guide exists if ever needed.
- TSDoc-only approach (no markdown output): Raw TypeDoc HTML output doesn't integrate into Docusaurus; requires typedoc-plugin-markdown bridge.

---

## Open Questions

1. **Docusaurus site location: `docs-site/` or `website/`?**
   - What we know: FINOS blueprint uses `website/` by convention; Docusaurus defaults suggest `my-website` → `website`
   - What's unclear: Does any tooling in this repo expect a specific directory name?
   - Recommendation: Use `docs-site/` — it's unambiguous and avoids conflict with existing `docs/` directory. Planner can override if project convention prefers `website/`.

2. **GitHub org for Pages URL: `finos.github.io` vs placeholder?**
   - What we know: README badges already reference `github.com/finos/calmstudio`. PROJECT.md confirms `https://github.com/finos/calmstudio`.
   - What's unclear: Whether the GitHub Pages is actually enabled on the finos org; may need separate verification.
   - Recommendation: Use `url: 'https://finos.github.io'` and `baseUrl: '/calmstudio/'` as the target. If the repo is in a personal GitHub account during development, baseUrl will differ — make it a config variable or document as a one-time repo-settings step.

3. **AJV: bundle in dist or declare as peer dependency?**
   - What we know: AJV is in `dependencies` (not devDependencies) of calm-core.
   - What's unclear: Should consumers get AJV as a transitive dep, or should tsup exclude it from the bundle?
   - Recommendation: Mark `external: ['ajv', 'ajv-formats']` in tsup config so they remain runtime dependencies (listed in package.json `dependencies`). This is standard for libraries — don't bundle third-party deps unless they're internal-only utilities.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (existing) |
| Config file | `packages/calm-core/vitest.config.ts` |
| Quick run command | `pnpm --filter @calmstudio/calm-core run test` |
| Full suite command | `pnpm --filter @calmstudio/calm-core run test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | tsup build produces dist/ with ESM + CJS + .d.ts | smoke | `ls packages/calm-core/dist/ && node -e "require('./packages/calm-core/dist/index.cjs')"` | ❌ Wave 0 |
| CORE-01 | `private: false` in package.json and `files` field excludes test-fixtures | smoke | `node -e "const p=require('./packages/calm-core/package.json'); if(p.private) throw new Error('private')"` | ❌ Wave 0 |
| CORE-01 | Published exports match declared API surface | unit | Existing `types.test.ts` + `validation.test.ts` — no new tests needed if exports unchanged | ✅ existing |
| DOCS-01 | Docusaurus build completes without errors | smoke | `pnpm --filter calmstudio-docs run build` (exit code 0) | ❌ Wave 0 |
| DOCS-01 | API reference section exists in built site | smoke | `ls docs-site/build/docs/api/` (non-empty) | ❌ Wave 0 |
| DOCS-02 | All 10 ADR files exist and are valid MADR | smoke | `ls docs-site/docs/adrs/*.md \| wc -l` (≥ 10) | ❌ Wave 0 |
| DOCS-03 | Extension pack guide page exists in built site | smoke | `ls docs-site/build/docs/developer-guide/extension-packs/` | ❌ Wave 0 |
| DOCS-04 | MCP guide page exists in built site | smoke | `ls docs-site/build/docs/developer-guide/mcp-server/` | ❌ Wave 0 |
| DOCS-05 | Contributor guide page exists in built site | smoke | `ls docs-site/build/docs/developer-guide/contributing/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/calm-core run test` (calm-core changes); `pnpm --filter calmstudio-docs run build` (docs changes)
- **Per wave merge:** both commands above + `npm pack --dry-run` in `packages/calm-core/`
- **Phase gate:** All smoke checks green + docs build succeeds before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/calm-core/tsup.config.ts` — new file, must exist before build tests run
- [ ] `docs-site/` — scaffold via `pnpm create docusaurus@latest docs-site classic --typescript`
- [ ] `docs-site/package.json` — name it `calmstudio-docs` so pnpm filter works

*(Existing unit tests in `packages/calm-core/src/*.test.ts` cover the API surface — no new unit tests needed for CORE-01 assuming exports are unchanged)*

---

## Sources

### Primary (HIGH confidence)
- [Docusaurus official installation docs](https://docusaurus.io/docs/installation) — version 3.9.2 confirmed, monorepo setup
- [Docusaurus deployment docs](https://docusaurus.io/docs/deployment) — GitHub Pages workflow, required permissions
- [typedoc-plugin-markdown Docusaurus quick start](https://www.typedoc-plugin-markdown.org/plugins/docusaurus/quick-start) — entryPoints config, monorepo paths
- [MADR official site](https://adr.github.io/madr/) — MADR 4.0 template sections, required vs optional
- Existing `.releaserc.json` in `packages/calm-core/` — semantic-release already configured
- Existing `release.yml` — multi-semantic-release already wired, NPM_TOKEN secret already required

### Secondary (MEDIUM confidence)
- [johnnyreilly: Dual Publishing ESM and CJS with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong) — verified package.json exports pattern against npm docs
- [tsup official docs](https://tsup.egoist.dev/) — config options
- [actions/deploy-pages GitHub](https://github.com/actions/deploy-pages) — permissions requirements
- [FINOS community docs on Docusaurus](https://community.finos.org/docs/development-infrastructure/project-documentation/) — FINOS adopts Docusaurus 3.x as standard

### Tertiary (LOW confidence)
- WebSearch results on pnpm monorepo + docusaurus-openapi-docs installation failure — not applicable (we're not using openapi-docs plugin)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Docusaurus 3.9.2 version confirmed from official docs; tsup pattern verified from multiple authoritative sources; MADR 4.0 confirmed from adr.github.io
- Architecture: HIGH — all patterns based on official docs and existing project infrastructure
- Pitfalls: HIGH (baseUrl, private flag, id-token permission) / MEDIUM (AJV bundling — derived from tsup documentation pattern, not directly verified against this specific case)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Docusaurus releases frequently; re-verify version if planning is delayed)
