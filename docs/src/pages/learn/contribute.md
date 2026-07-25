---
title: Contribute to CALM
description: Set up the finos/architecture-as-code monorepo, find a good first issue, and ship your first pull request.
---

# Contribute to CALM

CALM is built in the open in the
[finos/architecture-as-code](https://github.com/finos/architecture-as-code)
monorepo. This page gets you from a fresh clone to your first merged pull
request.

## 1. Prerequisites

- **Node.js 26** — the repo pins the exact version in `.nvmrc` and enforces it
  with `engine-strict`, so installs on older versions will refuse to run. With
  [nvm](https://github.com/nvm-sh/nvm) installed:

  ```bash
  nvm use   # reads .nvmrc
  ```

- **Java 21 and Maven** — only needed if you are working on the CALM Hub
  backend (`calm-hub`). The repo ships a Maven wrapper (`./mvnw`), so you just
  need a JDK.
- **Docker** — optional; used for CALM Hub integration tests and local
  MongoDB.

## 2. Clone and build

Fork the repository on GitHub, then:

```bash
git clone https://github.com/<your-username>/architecture-as-code.git
cd architecture-as-code
npm install
npm run build
```

Always run npm commands from the repository root — the TypeScript packages
(CLI, shared, widgets, models, and more) are managed as npm workspaces with a
single root lockfile.

## 3. Run the tests

```bash
npm test        # all TypeScript workspaces
npm run lint    # linting must pass with 0 errors

# CALM Hub (Java) only:
cd calm-hub && ../mvnw test
```

## 4. Find a good first issue

Issues labelled **good first issue** are curated entry points to the codebase:

- [Browse good first issues →](https://github.com/finos/architecture-as-code/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

If you have questions, ask on the issue itself or in
[GitHub Discussions](https://github.com/finos/architecture-as-code/discussions)
— maintainers are happy to help you get started.

## 5. Branch, change, commit

Create a feature branch with a descriptive name (for example
`feat/add-caching` or `fix/mongodb-timeout`), make your change, and write
tests for any new code.

Commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/) — this is
enforced automatically by commitlint via a husky hook:

```bash
git commit -m "feat(cli): add schema validation caching"
git commit -m "docs: update installation instructions"
```

Accepted types include `feat`, `fix`, `docs`, `test`, `chore`, `refactor` and
more; see the repo's `CONTRIBUTING.md` for the full list of types and scopes.

### Responsible use of AI coding assistants

AI coding assistants are welcome, but treat generated code as a draft, not a
finished contribution. Do not submit code you cannot explain. Keep changes
focused, review the full diff, run the required validation steps, and verify
technical claims with project docs and tests.

Do not share credentials or confidential information with AI tools unless you
are authorized to do so. By opening a PR, you remain responsible for the full
change, including any AI-assisted portions.

For full guidance, see the repository contributor policy:
[Responsible Use of AI Coding Assistants](https://github.com/finos/architecture-as-code/blob/main/CONTRIBUTING.md#responsible-use-of-ai-coding-assistants).

## 6. Open your pull request

Push your branch to your fork and open a pull request against `main`. CI will
run the build, tests and linting.

As a FINOS project, contributions require a Contributor License Agreement:
the **EasyCLA** bot will comment on your first pull request with a link to
complete it (individually, or via your employer's corporate CLA). Once CLA
and CI are green, a maintainer will review your change and work with you to
get it merged.

**That's it — welcome aboard!** 🎉

[← Back to the contributor journey](/learn/journeys/contributor)
