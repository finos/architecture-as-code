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

**CRITICAL**: Before considering any change ready:
1. **All tests must pass** with coverage enabled
2. **All new code must have tests** (unit and/or integration)
3. **Run linting** (see Linting section below)

```bash
# Run ALL tests with coverage (required before committing)
npm test -- --coverage      # TypeScript packages with coverage
cd calm-hub && ../mvnw verify  # Java tests with coverage (JaCoCo enabled by default)

# Quick test runs (without coverage reports)
npm test                    # TypeScript packages
cd calm-hub && ../mvnw test # Java unit tests (still collects coverage data)

# Package-specific tests
npm test --workspace cli
npm test --workspace calm-plugins/vscode
npm run test:cli            # With dependencies built
npm run test:shared         # With dependencies built

# Java integration tests (requires Docker)
cd calm-hub && ../mvnw -P integration verify
```

### Test Coverage Requirements
- All new functions/methods must have tests
- Aim for >80% coverage on new code
- Critical paths must have 100% coverage
- Tests should cover both success and error cases

## Linting

**CRITICAL**: Always run linting after making code changes. Fix all errors before committing.

```bash
# Lint all workspaces (required before committing)
npm run lint               # Check all TypeScript/JavaScript code

# Auto-fix issues
npm run lint-fix           # Fix auto-fixable linting issues

# Package-specific linting
npm run lint --workspace cli
npm run lint --workspace calm-plugins/vscode
```

Linting checks code style, common errors, and best practices.

## Commit Messages

This project uses **Conventional Commits** enforced by **commitlint** and **husky**.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Required**:
- `type`: One of: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`
- `subject`: Brief description (no period at end)

**Optional**:
- `scope`: Package affected (`cli`, `shared`, `calm-widgets`, `calm-hub`, `calm-hub-ui`, `docs`, `vscode`, `deps`, `ci`, `release`)
- `body`: Detailed explanation
- `footer`: Breaking changes, issue references

### Examples

```bash
# Good commit messages
feat(cli): add support for schema validation caching
fix(calm-hub): resolve MongoDB connection timeout issue
docs(vscode): update extension installation guide
test(shared): add unit tests for template processor
chore(deps): update Quarkus to 3.29.4

# Bad commit messages (will be rejected)
update stuff                          # Missing type
Fix: bug in code                      # Type must be lowercase
feat(cli) added new feature.          # Subject ends with period
FEAT(cli): new feature                # Type must be lowercase
```

### Type Guidelines

- **feat**: New feature for users
- **fix**: Bug fix for users
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code restructuring (no behavior change)
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, tooling)
- **perf**: Performance improvements
- **ci**: CI/CD pipeline changes
- **build**: Build system changes
- **revert**: Reverting a previous commit

### Automated Enforcement

**Husky** runs commitlint automatically on every commit. Invalid messages are rejected.

To bypass validation (not recommended):
```bash
git commit --no-verify -m "message"
```

### Using Commitizen (Interactive Helper)

For help crafting valid commits:
```bash
npx cz
# or
npm run commit  # if configured
```

This provides an interactive prompt to build a compliant message.

## Pre-Commit Checklist

Before considering any code change ready:

- [ ] **All tests pass with coverage**: `npm test -- --coverage` AND `cd calm-hub && ../mvnw verify`
- [ ] **All new code has tests** (unit and/or integration tests)
- [ ] **Linting passes**: `npm run lint` (0 errors)
- [ ] **Code builds successfully**: `npm run build` AND `./mvnw clean install`
- [ ] **Documentation updated** if behavior changed
- [ ] **Test coverage meets requirements** (>80% for new code)
- [ ] **Commit message follows Conventional Commits** (enforced by husky)

## Documentation

- **User Docs**: https://calm.finos.org
- **Advent of CALM**: https://calm.finos.org/advent/
- **API Docs**: Generated from code (Swagger for calm-hub)

## Contributing

1. **Fork the repository**
2. **Create a feature branch** with descriptive name (e.g., `feat/add-caching`, `fix/mongodb-timeout`)
3. **Make your changes** following package-specific guidelines (see AGENTS.md files)
4. **Write tests** for all new code
5. **Run the pre-commit checklist** (see above)
   - Tests with coverage pass
   - Linting passes (0 errors)
   - Builds succeed
6. **Commit with Conventional Commits format**
   - Example: `feat(cli): add schema validation caching`
   - Husky will validate your commit message automatically
7. **Push to your fork** and create a pull request
8. **Ensure CI passes** on your pull request

### Quick Contribution Workflow

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Make changes and write tests
vim src/my-file.ts
vim src/my-file.spec.ts

# 3. Run pre-commit checks
npm test -- --coverage
npm run lint
npm run build

# 4. Commit with conventional format (husky validates)
git add .
git commit -m "feat(cli): add my feature"

# 5. Push and create PR
git push origin feat/my-feature
```

## Getting Help

- Issues: https://github.com/finos/architecture-as-code/issues
- Discussions: https://github.com/finos/architecture-as-code/discussions
- Community: FINOS Architecture as Code meetings

---