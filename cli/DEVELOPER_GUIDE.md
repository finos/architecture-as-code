# Developing the CALM CLI

## One-time environment set-up

### [Flox](https://flox.dev) users

1. Clone the git repo and `cd` into the directory.
1. Run `flox activate`. The first time you do this, it will locally install all the dependencies and Node packages, and configure the environment ready for you to develop and test.

### Everyone else

1. Install Node v22.11.0 (use `nvm` to manage Node versions if needed).
1. Make sure `libuuid.so` is installed (`ldconfig -p | grep libuuid`) and install it if not (instructions will depend on your OS).
1. Clone the git repo and `cd` into the directory
1. Run the following:

```shell
   npm install
   npm run build
   npx link cli
```

## Coding for the CLI

The CLI module has its logic split into two modules, `cli` and `shared`. Both are managed by [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

- `cli` module is for anything pertaining to the calling of the core logic, the CLI wrapper
- `shared` module is where the logic being delegated to actually sits, so that it can be re-used for other use-cases if required.

### Getting Started

Ensure you've cloned the repository - then go to the root of the repository and execute;

```shell
# Step 1: Install all necessary dependencies for the workspace
npm install

# Step 2: Build the workspace (compiles source code for all workspaces)
npm run build

# Step 3: Link the workspace locally for testing
npm run link:cli

# Step 4 : Run `watch` to check for changes automatically and re-bundle. This watching is via `chokidar` and isn't instant - give it a second or two to propagate changes.
npm run watch
```

### CLI Tests

There are currently two types of tests;

- `cli` tests - these are end-to-end and involve linking the package as part of the test so that we can assert on actual `calm X` invocations.
- `shared` tests - these are where the core logic tests live, like how validation behaves etc.

## Releasing the CLI

Before performing this process, one must update the [package.json](package.json) to represent the new version and tag that will be created.

```json
{
  "name": "@finos/calm-cli",
  "version": "0.6.0",
  "description": "A set of tools for interacting with the Common Architecture Language Model (CALM)"
}
```

Once this is done, publishing of the CLI to NPM is controlled via [this action](https://github.com/finos/architecture-as-code/blob/main/.github/workflows/publish-cli-to-npm.yml) - this action is triggered whenever a GitHub release is created. To create a github release you can do one of the following;

### Through the Github UI

- Go to your repository on GitHub.
- Click on the Releases tab (under "Code").
- Click the Draft a new release button.
- Fill in:
  - Tag version: Enter the version number (e.g., v1.0.0).
  - Release title: Name the release to be the same as the tag version
  - Description: Add details about what’s included in the release.
  - Target: Leave as main (or your default branch).
- Click Publish release to create the release and trigger the workflow.

### Through the GitHub CLI (`gh`)

```shell
# Step 1: Authenticate with GitHub if you haven't already
gh auth login

# Step 2: Create the release.
gh release create <version> --title "<release_title>" --notes "<release_description>"
```

## OWASP DEPENDENCY-CHECK

The [OWASP dependency check tool](https://jeremylong.github.io/DependencyCheck/) will run on PRs and periodically on the committed code, but it can be helpful to be able to run this locally to investigate CVEs.

To use the dependency check tool locally, first install the tool following the instructions for your operating system [here](https://jeremylong.github.io/DependencyCheck/dependency-check-cli/index.html).

Once that is done the tool is configured as a script in the package.json, run `npm run dependency-check`; the reports will be output to `cli/dependency-check-report`.
