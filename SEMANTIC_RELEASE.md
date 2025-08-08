# Semantic Release Setup for CLI

This project uses semantic-release to automatically manage versioning and publishing of the `@finos/calm-cli` package.

## How it works

- **Automated Versioning**: Version numbers are automatically determined based on the semantic meaning of commits
- **Manual Release Control**: Releases are triggered manually when you're ready to publish
- **Changelog Generation**: A changelog is automatically generated and maintained
- **GitHub Releases**: GitHub releases are automatically created with release notes

## Commit Message Format

This project follows the [Conventional Commits](https://conventionalcommits.org/) specification. All commit messages should be structured as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (triggers a minor release)
- **fix**: A bug fix (triggers a patch release)
- **docs**: Documentation only changes (triggers a patch release)
- **style**: Changes that do not affect the meaning of the code (triggers a patch release)
- **refactor**: A code change that neither fixes a bug nor adds a feature (triggers a patch release)
- **perf**: A code change that improves performance (triggers a patch release)
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

### Breaking Changes

To trigger a major release, include `BREAKING CHANGE:` in the commit footer or add a `!` after the type:

```
feat!: remove deprecated API endpoints

BREAKING CHANGE: The old v1 API endpoints have been removed
```

### Scopes

Available scopes include:
- `cli`: Changes specific to the CLI package
- `shared`: Changes to shared utilities
- `calm`: Changes to the CALM spec
- `calm-widgets`: Changes to the widgets package
- `calm-hub`: Changes to the hub backend
- `calm-hub-ui`: Changes to the hub frontend
- `docs`: Changes to documentation
- `workspace`: Changes affecting the entire workspace

## Using Commitizen

To help create properly formatted commits, you can use commitizen:

```bash
npm run commit
```

This will prompt you through creating a conventional commit message.

## Workflow

1. Make your changes
2. Use `npm run commit` or write a conventional commit message manually
3. Push to a feature branch and create a PR
4. When you're ready to release:
   - Go to the GitHub Actions tab in the repository
   - Run the "Release and Publish CLI" workflow manually
5. The workflow will:
   - Analyze the commits since the last release to determine the version bump
   - Update the version in `cli/package.json`
   - Generate/update the `cli/CHANGELOG.md`
   - Create a Git tag
   - Publish to NPM
   - Create a GitHub release
