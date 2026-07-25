# Contributing to Architecture as Code

Thank you for your interest in contributing to the Architecture as Code project! This guide will help you understand our development workflow and contribution standards.

## 🚀 Why We Use Semantic Release

We use [Semantic Release](https://semantic-release.gitbook.io/) to automate our release process for the **CLI module**, with plans to expand to other modules in the future. This ensures:

- **Consistent versioning** following [Semantic Versioning](https://semver.org/) principles
- **Automated releases** triggered by commit messages
- **Generated changelogs** that clearly communicate changes to users
- **Reduced human error** in the release process

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

## Responsible Use of AI Coding Assistants

This project welcomes the responsible use of AI coding assistants. They can accelerate learning, improve productivity, and help contributors understand the codebase, but AI-generated output should be treated as a draft, not a finished contribution. Contributors remain responsible for every change they submit.

### Understand Before You Submit

Do not submit code you cannot explain. Before opening a pull request, ensure you understand why the change is needed, how it works, its impact on the project, and how you verified that it behaves correctly.

### Use AI as an Assistant, Not an Authority

Treat AI suggestions like code from any unfamiliar contributor. Review and validate them against the project's architecture, coding conventions, documentation, and testing practices rather than assuming they are correct because they compile or appear plausible.

### Start With the Problem

Take time to understand the issue before asking AI to generate code. Focused prompts based on a clear understanding of the problem consistently produce better contributions than asking AI to implement an entire feature from scratch.

### Keep Contributions Focused

AI assistants often generate broader solutions than necessary. Keep pull requests narrowly focused on the problem being solved, minimize unrelated changes, and avoid introducing new abstractions or dependencies unless they are clearly justified.

### Validate Every Change

AI-generated code requires the same level of review and testing as any other contribution. Carefully review the complete diff, run the project's required validation steps, and ensure the implementation and tests accurately solve the intended problem.

### Protect Sensitive Information

Do not share credentials, confidential information, private repository content, or other sensitive data with AI services unless you are authorized to do so. Contributors are responsible for understanding the privacy and data-retention policies of the tools they use.

### Verify, Don't Assume

AI assistants can produce incorrect code, invent APIs, misinterpret project conventions, or generate flawed tests. Verify technical claims using authoritative sources and your own testing rather than relying solely on AI-generated responses.

### Own Your Contribution

AI can help draft code, but it cannot take responsibility for it. Be prepared to explain your design decisions, respond thoughtfully to maintainer feedback, and revise your implementation based on code review.

### Contributor Responsibility

By submitting a contribution, you confirm that you:

1. Reviewed the complete change.
2. Understand and can explain the implementation.
3. Verified the change using the project's required validation steps.
4. Considered security, privacy, licensing, and dependency implications.
5. Accept responsibility for the entire contribution, including any AI-assisted portions.

Maintainers may reject contributions that appear to be AI-generated but are not sufficiently understood, reviewed, or validated by the contributor.

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
