# Contributing to Architecture as Code

Thank you for your interest in contributing to the Architecture as Code project! This guide will help you understand our development workflow and contribution standards.

## 🚀 Why We Use Semantic Release

We use [Semantic Release](https://semantic-release.gitbook.io/) to automate our release process for the **CLI module**, with plans to expand to other modules in the future. This ensures:

- **Consistent versioning** following [Semantic Versioning](https://semver.org/) principles
- **Automated releases** triggered by commit messages
- **Generated changelogs** that clearly communicate changes to users
- **Reduced human error** in the release process
- **Faster delivery** of features and fixes to our users

We enforce conventional commit standards across the entire project to ensure we can easily extend semantic-release to other modules when ready.

## 📝 Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Your commit messages must follow this format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

We accept the following commit types:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scopes

We use scopes to indicate which part of the project is affected:

- **cli**: Changes to the CLI package
- **shared**: Changes to the shared utilities
- **calm-widgets**: Changes to the CALM widgets
- **calm-hub**: Changes to the CALM hub
- **calm-hub-ui**: Changes to the CALM hub UI
- **docs**: Changes to documentation
- **vscode**: Changes to VS Code extensions
- **deps**: Dependency updates
- **ci**: CI/CD related changes
- **release**: Release-related changes

### Examples

```bash
# Feature additions
feat(cli): add new validation command
feat(shared): implement schema parser

# Bug fixes
fix(cli): resolve configuration loading issue
fix(calm-hub): correct API endpoint validation

# Documentation
docs: update installation instructions
docs(cli): add usage examples

# Chores
chore(deps): update dependencies
chore(ci): improve release workflow
```

### 💡 Pro Tip
For complete details on our commit message rules, see our [`commitlint.config.js`](./commitlint.config.js) file which contains all validation rules and accepted scopes.

## 🎯 Benefits of This Approach

### Automated Release Management

- **Version Bumping**: Semantic Release automatically determines the next version number for the CLI module based on your commit types:
  - `fix:` → Patch version (1.0.0 → 1.0.1)
  - `feat:` → Minor version (1.0.0 → 1.1.0)
  - `BREAKING CHANGE:` → Major version (1.0.0 → 2.0.0)

### Changelog Generation

- **Automatic CHANGELOG.md updates** for the CLI module with categorized changes
- **Clear release notes** for each version
- **Links to commits and PRs** for full traceability

### Release Automation (CLI Module)

- **Git tags** created automatically for CLI releases
- **GitHub releases** with detailed notes
- **NPM packages** published automatically
- **No manual version management** required for CLI releases


## 📋 Before You Commit

- Ensure your commit message follows the conventional format - if you've run `npm install` at the root of the project - `husky` will assist with ensuring you don't commit with anything incorrect.
- Run tests to make sure nothing is broken
- Update documentation if you're adding new features
- Consider the appropriate scope for your changes

## 🚫 What Not to Do

- Don't manually update version numbers in `package.json`
- Don't manually edit `CHANGELOG.md` files
- Don't use non-standard commit message formats

## 🤝 Need Help?

If you're unsure about commit message formatting or have questions about contributing:

- Check our [`commitlint.config.js`](./commitlint.config.js) for detailed rules
- Look at recent commits for examples
- Open an issue for clarification

Thank you for helping make Architecture as Code better! 🎉
