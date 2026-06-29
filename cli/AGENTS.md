# CALM CLI - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM CLI codebase.

## Tech Stack

- **Language**: TypeScript 5.8+
- **CLI Framework**: Commander.js 14
- **Build Tool**: tsup (esbuild-based)
- **Test Framework**: Vitest
- **Package Manager**: npm (workspace package)
- **Dependencies**: 
  - `@finos/calm-shared` - Shared utilities
  - `@finos/calm-widgets` - Widget framework for visualizations
  - JSON Schema validation via `@apidevtools/json-schema-ref-parser`

## Key Commands

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces, not from within this package directory.

```bash
# Development (from repository root)
npm run build --workspace cli          # Build CLI + copy schemas/templates/widgets/AI tools
npm run watch --workspace cli          # Watch mode with live reload (uses watch.mjs)
npm test --workspace cli               # Run Vitest tests
npm run lint --workspace cli           # ESLint check
npm run lint-fix --workspace cli       # Auto-fix linting issues

# If you want to test just one file run this. Make sure you're in the cli directory or below so it can resolve vitest.config.ts.
npx vitest run ${TEST FILE}

# Local testing (from repository root)
npm run link:cli       # Link CLI globally for testing
calm --help            # Test globally linked CLI

# Build steps (executed by npm run build)
npm run copy-calm-schema      # Copy CALM JSON schemas from ../calm/
npm run copy-docify-templates # Copy docify templates from ../shared/
npm run copy-widgets          # Copy widget files from ../calm-widgets/
npm run copy-ai-tools         # Copy AI agent files from ../calm-ai/
```

## Architecture Overview

### Entry Point & Command Structure
- **Entry**: `src/index.ts` - Thin (~13-line) bin bootstrap. Imports Commander's `program`, calls `setupCLI(program)`, then `program.parseAsync(...)`. No command definitions live here.
- **Commands**: `src/cli.ts` - Exports `setupCLI(program)`, which registers every command and its options/actions. This is where all command wiring lives.
- **Pattern**: Each command is registered inline in `setupCLI`; the heavier action logic is dynamically imported from `src/command-helpers/` (see below).

### Key Commands
1. **generate** - Generate architecture from CALM pattern
2. **validate** - Validate a CALM document (architecture, pattern, and/or timeline) against schemas
3. **init-ai** - Install AI Assistant support for CALM
4. **template** - Generate files from Handlebars templates
5. **docify** - Generate documentation websites (supports `--scaffold` for two-stage workflow)
6. **diff** - Compare two CALM documents (architectures or patterns), or adjacent/explicit moments of a CALM timeline, and report what changed. Supports `--exit-code` to gate CI on detected changes.
7. **timeline** - Synthesise an implied CALM timeline from a set of local versioned architecture files (one moment per input).
8. **init-config** - Create or update the CLI configuration file (`~/.calm.json`), e.g. allowed remote hosts and CALM Hub URL.
9. **hub** - Command **group** for interacting with CALM Hub. Subcommands:
   - `hub push <resource> <file>` / `hub pull <resource>` / `hub list <resources>` / `hub create <resource>`
   - Resources span architectures, patterns, standards, control-requirements, control-configurations, namespaces, and domains (which subcommands exist varies per verb).
10. **workspace** - Command **group** for a local, git-rooted bundle of CALM documents (`.calm-workspace/`). Subcommands include `init`, `add`, `new`, `populate`, `tree`, `list`, `show`, `switch`, `clean`, and the CalmHub sync trio:
    - `workspace push` — pushes the exact version each document's `$id` declares (no auto-bump). An existing version with unchanged content is skipped; `--fail-if-modified` (or `push.failIfModified: true` in `.calm-workspace/config.json`) fails when a document already published at its declared version has changed on disk, for strict merge-time CI.
    - `workspace check` — CI/PR gate: exits non-zero if any tracked document changed on disk relative to CalmHub but wasn't version-bumped.
    - `workspace bump` — bumps changed documents (default MINOR; `--major`/`--patch`; or `bump.defaultIncrement` in config) and repoints all references to the new `$id`s. Idempotent: re-bumping an already-bumped doc is a no-op until it's pushed.
    - Central config `.calm-workspace/config.json` holds `push.failIfModified` (`true`|`false`) and `bump.defaultIncrement` (`MAJOR`|`MINOR`|`PATCH`).

### Important Directories
```
src/
├── cli.ts                    # setupCLI: registers all commands, options, and actions
├── cli-config.ts             # Configuration helpers (~/.calm.json loading/saving)
├── index.ts                  # Thin bin bootstrap (calls setupCLI + parseAsync)
├── command-helpers/          # Action logic for commands (see below)
└── test_helpers/             # Test utilities
```

The `command-helpers/` directory now holds the substantial per-command logic that
`cli.ts` dynamically imports:
- `diff.ts` - document and timeline diffing
- `timeline.ts` - timeline synthesis
- `hub-commands.ts` - CALM Hub push/pull/list/create implementations
- `hub-output.ts` - formatting of Hub command output
- `template.ts` - template processing helpers (e.g. URL-to-local-file mapping)
- `validate.ts` - validation option checks and execution
- `generate-options.ts` - interactive/option-choice handling for `generate`
- `ai-tools.ts` - `init-ai` provider setup

### Build Artifacts
After `npm run build`, the `dist/` directory contains:
```
dist/
├── index.js              # Compiled CLI entry point (bin)
├── calm/                 # Copied CALM meta schemas only (release + draft **/meta/* files)
├── calm-ai/              # Copied AI agent files
├── template-bundles/     # Copied docify templates
└── widgets/              # Copied widget files (copy-widgets uses --up 4)
```

Note: `copy-calm-schema` only bundles `**/meta/*` files (not every CALM schema)
into `dist/calm/`.

## Key Concepts

### Schema Handling
- CALM schemas live in `../calm/release/` and `../calm/draft/`
- Default schema directory: `../calm/release`
- CLI accepts `-s, --schema-directory` to override
- Schemas are copied during build, not at runtime

### CALM Hub Integration
- CLI can load architectures/patterns from CALM Hub via `-c, --calm-hub-url`
- Supports both file paths and URLs for pattern/architecture files

### Verbose Mode
- Most top-level commands support `-v, --verbose` (generate, validate, template, docify, init-ai, diff, timeline). `init-config` and the `hub` subcommands do not.
- Use for debugging command execution

### Configuration
- `cli-config.ts` handles loading CLI configuration
- Supports reading from multiple locations

## Testing

### Test Organization
- `*.spec.ts` - Unit tests alongside source files
- `*.e2e.spec.ts` - End-to-end CLI tests
- `test_fixtures/` - Test data (patterns, architectures, schemas)

### Running Tests
```bash
# From repository root (preferred)
npm test --workspace cli              # All tests
npm test --workspace cli -- --watch   # Watch mode
npm test --workspace cli -- <file>    # Specific test file
```

### Common Test Patterns
- Use `test_helpers/` for shared test utilities
- Mock external dependencies (file system, HTTP)
- Test both success and error cases

## Common Tasks

### Adding a New Command
1. Add command definition in `src/cli.ts`
2. Implement command function (follow existing patterns)
3. Add tests in `src/cli.spec.ts`
4. Add E2E test in `src/cli.e2e.spec.ts`
5. Update README.md with command documentation

### Modifying Schema Handling
- Schemas are in `../calm/` directory (outside CLI)
- Update copy script in `package.json` if schema structure changes
- Test with `npm run build` to ensure schemas copy correctly

### Working with Widgets
- Widget files come from `../calm-widgets/dist/cli/widgets/`
- Built by calm-widgets package first
- CLI copies pre-built widgets during build

## Dependencies on Other Packages

```
calm-cli depends on:
  ├── calm-models (built first)
  ├── calm-widgets (built first)  
  ├── shared (built first)
  └── calm-ai (copied during build)
```

**Important**: When working across packages, rebuild dependencies:
```bash
# From repository root (always use workspaces)
npm run build:cli    # Builds models, widgets, shared, then CLI
# Or build individual packages:
npm run build --workspace calm-models
npm run build --workspace calm-widgets
npm run build --workspace shared
npm run build --workspace cli
```

## Common Pitfalls

1. **Missing Schemas**: If tests fail due to missing schemas, run `npm run build`
2. **Widget Errors**: Ensure `calm-widgets` is built before building CLI
3. **Watch Mode**: Use `npm run watch` (not `tsc --watch`) - includes file copying
4. **Global Linking**: After changes, run `npm run link:cli` from root to update global install

## Configuration Files

- `tsconfig.json` - TypeScript compiler options
- `tsconfig.build.json` - Production build config
- `tsup.config.ts` - Build configuration (entry points, formats)
- `vitest.config.mts` - Test configuration
- `eslint.config.mjs` - Linting rules
- `.releaserc.json` - Semantic release configuration

## Release Process

- Uses semantic-release for automated releases
- Versioning follows semantic versioning
- CHANGELOG.md auto-generated
- Published to npm as `@finos/calm-cli`

## Useful Links

- [README.md](./README.md) - User-facing documentation
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Detailed development guide
- [Root README](../README.md) - Monorepo overview
