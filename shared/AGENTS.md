# Shared Package - AI Assistant Guide

## Project Overview

The `shared` package contains common utilities, helpers, and core logic used across the CALM monorepo. It is a critical dependency for:
- CLI (`@finos/calm-cli`)
- VSCode Extension (`calm-vscode-plugin`)
- CALM Models (`calm-models`)
- CALM Widgets (`calm-widgets`)

## Critical Development Rules

### 1. Impact Analysis
**WARNING**: Changes in this package affect multiple downstream projects.
- **ALWAYS** run the full test suite (`npm run test` from root) after making changes here.
- Do not break existing public APIs unless absolutely necessary (and coordinated with all consumers).

### 2. Testing
Because this is a shared library, rigorous testing is mandatory.

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces.

```bash
# Run tests for this package only (from repository root)
npm test --workspace @finos/calm-shared

# Run tests for ALL packages (REQUIRED before PR)
npm test
```

## Key Components

- **Document Loader**: Strategies for loading CALM documents (FileSystem, MultiStrategy).
- **Template Processor**: Handlebars-based template generation logic.
- **Model Visitors**: Visitor pattern implementations for traversing CALM models.
- **Validation**: Core validation logic (Spectral integration).

## Common Workflows

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces, not from within this package directory.

### Building
```bash
# Build this package (from repository root)
npm run build --workspace @finos/calm-shared
```

### Testing Changes
1. Make changes in `shared/src/...`
2. Run local tests: `npm test --workspace shared`
3. Run consumer tests (e.g., CLI): `npm test --workspace cli`
4. Run ALL tests: `npm test`
