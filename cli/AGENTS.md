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

```bash
# Development
npm run build          # Build CLI + copy schemas/templates/widgets/AI tools
npm run watch          # Watch mode with live reload (uses watch.mjs)
npm test               # Run Vitest tests
npm run lint           # ESLint check
npm run lint-fix       # Auto-fix linting issues

# Local testing
npm run link:cli       # From root: link CLI globally for testing
calm --help            # Test globally linked CLI

# Build steps (executed by npm run build)
npm run copy-calm-schema      # Copy CALM JSON schemas from ../calm/
npm run copy-docify-templates # Copy docify templates from ../shared/
npm run copy-widgets          # Copy widget files from ../calm-widgets/
npm run copy-ai-tools         # Copy AI chatmode files from ../calm-ai/
```

## Architecture Overview

### Entry Point & Command Structure
- **Entry**: `src/index.ts` - Sets up Commander.js and registers commands
- **Commands**: `src/cli.ts` - Main command implementations
- **Pattern**: Each command is a separate function (generateArchitecture, validateArchitecture, etc.)

### Key Commands
1. **generate** - Generate architecture from CALM pattern
2. **validate** - Validate architecture against pattern
3. **copilot-chatmode** - Install AI chatmode for CALM
4. **server** - HTTP server proxy (experimental)
5. **template** - Generate files from Handlebars templates
6. **docify** - Generate documentation websites (supports `--scaffold` for two-stage workflow)

### Important Directories
```
src/
├── cli.ts                    # Main command implementations
├── cli-config.ts             # Configuration helpers
├── index.ts                  # Entry point
├── command-helpers/          # Shared utilities for commands
├── server/                   # HTTP server implementation (experimental)
└── test_helpers/             # Test utilities
```

### Build Artifacts
After `npm run build`, the `dist/` directory contains:
```
dist/
├── index.js              # Compiled CLI entry point (bin)
├── calm/release/         # Copied CALM schemas
├── calm-ai/              # Copied AI chatmode files
├── template-bundles/     # Copied docify templates
└── cli/widgets/          # Copied widget files
```

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
- All commands support `-v, --verbose` flag
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
npm test              # All tests
npm test -- --watch   # Watch mode
npm test -- <file>    # Specific test file
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
# From root
npm run build:cli    # Builds models, widgets, shared, then CLI
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
