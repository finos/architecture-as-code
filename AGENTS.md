# FINOS CALM Monorepo - AI Assistant Guide

## Project Overview

This is the **FINOS Architecture as Code** monorepo containing the Common Architecture Language Model (CALM) specification and associated tools.

**CALM** is a declarative, JSON-based modeling language for describing complex software architectures, particularly in regulated environments like financial services.

## Monorepo Structure

```
architecture-as-code/
├── calm/                      # CALM specification (JSON schemas)
├── cli/                       # TypeScript CLI (@finos/calm-cli)
├── calm-hub/                  # Java/Quarkus REST API backend
├── calm-plugins/vscode/       # VSCode extension
├── calm-models/               # TypeScript data models
├── calm-widgets/              # React visualization components
├── calm-ai/                   # AI chatmode tools & prompts
├── shared/                    # Shared TypeScript utilities
├── docs/                      # Docusaurus documentation site
├── advent-of-calm/            # Educational content (24-day challenge)
├── calm-hub-ui/               # React frontend for CALM Hub
└── experimental/              # Experimental features
```

## Technology Stack

**TypeScript/Node.js** (npm workspaces):
- CLI, models, widgets, shared, VSCode plugin, Hub UI
- Build: tsup (esbuild), vitest for testing
- Package manager: npm workspaces

**Java/Maven** (Maven reactor build):
- Root pom.xml defines multi-module reactor
- Modules: calm-hub (Java/Quarkus), cli, calm, docs, shared (POM modules)
- calm-hub backend (Quarkus 3.29+)
- MongoDB/NitriteDB storage
- TestContainers for integration tests
- Maven reactor allows building all modules from root: `./mvnw clean install`

**Documentation**:
- Docusaurus for main docs
- Astro for advent-of-calm website

## Quick Navigation

### Package-Specific Guides

For detailed guidance on specific packages, see:
- **[cli/AGENTS.md](cli/AGENTS.md)** - CLI commands, build pipeline, Commander.js patterns
- **[calm-hub/AGENTS.md](calm-hub/AGENTS.md)** - Java/Quarkus backend, storage modes, security
- **[calm-plugins/vscode/AGENTS.md](calm-plugins/vscode/AGENTS.md)** - VSCode extension, MVVM architecture
- **[advent-of-calm/AGENTS.md](advent-of-calm/AGENTS.md)** - Educational content, day format, testing

### When to Use Package-Specific Guides

Open the package-specific AGENTS.md when:
- Working on code or tests in that package
- Debugging package-specific issues
- Understanding architecture patterns
- Running package-specific commands

## Key Commands

```bash
# Root-level commands (npm workspaces)
npm run build              # Build all TypeScript workspaces
npm run test               # Test all TypeScript workspaces
npm run lint               # Lint all workspaces
npm run build:cli          # Build CLI and dependencies
npm run build:shared       # Build shared packages

# Root-level Maven reactor build
./mvnw clean install       # Build all Maven modules (mainly calm-hub)
./mvnw test                # Test all Maven modules (mainly calm-hub)

# Testing specific packages (from root)
npm run test:cli           # Test CLI only
npm run test:shared        # Test shared packages
npm run test:vscode        # Test VSCode extension
npm run test:models        # Test calm-models
npm run test:calm-widgets  # Test calm-widgets

# Java/Maven (calm-hub specific)
cd calm-hub
../mvnw quarkus:dev        # Development mode with hot reload
../mvnw -P integration verify  # Full test suite with integration tests
../mvnw test               # Unit tests only

# CLI (from root)
npm run link:cli           # Link CLI globally for testing
calm --version             # Test CLI

# Advent of CALM website
cd advent-of-calm/website
npm install                # First time setup
npm run dev                # Dev server with hot reload
npm run build              # Production build
```

## Build Order Dependencies

```
TypeScript packages (npm workspaces) build in order:
  calm-models → calm-widgets → shared → cli → calm-plugins/vscode

Maven modules (reactor build):
  Parent POM → calm-hub (only Java module with code)
  Other modules (cli, calm, docs, shared) are POM-only placeholders
```

**Important**: 
- Always build dependencies before dependent packages for TypeScript
- Maven reactor handles build order automatically: `./mvnw clean install`

## Common Workflows

### Working on the CLI
```bash
npm run build:cli          # Builds models, widgets, shared, cli
npm run link:cli           # Link globally
calm --version             # Verify
```

### Working on VSCode Extension
```bash
npm run build:shared       # Build dependencies
cd calm-plugins/vscode
npm run watch              # Watch mode
# Press F5 in VSCode to debug
```

### Working on CALM Hub
```bash
cd calm-hub/local-dev
docker-compose up          # Start MongoDB
cd ..
../mvnw quarkus:dev        # Start backend
```

### Working on Advent of CALM
```bash
cd advent-of-calm
vim day-10.md              # Edit content
cd website
npm run dev                # Test in browser
```

## Testing

```bash
# All tests
npm test                   # TypeScript packages
cd calm-hub && ../mvnw test  # Java unit tests

# Package-specific
npm test --workspace cli
npm test --workspace calm-plugins/vscode

# With coverage
npm test -- --coverage
```

## Documentation

- **User Docs**: https://calm.finos.org
- **Advent of CALM**: https://calm.finos.org/advent/
- **API Docs**: Generated from code (Swagger for calm-hub)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow package-specific guidelines (see AGENTS.md files)
4. Run tests and linting
5. Create pull request

## Getting Help

- Issues: https://github.com/finos/architecture-as-code/issues
- Discussions: https://github.com/finos/architecture-as-code/discussions
- Community: FINOS Architecture as Code meetings

---

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->