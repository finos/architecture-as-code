# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

It is published as the `calmguard-docs` workspace of the [`finos/architecture-as-code`](https://github.com/finos/architecture-as-code) monorepo.

## Installation

From the monorepo root:

```bash
npm ci
```

## Local Development

From the monorepo root:

```bash
npm run start --workspace=calmguard-docs
```

Or from `calm-suite/calm-guard/`:

```bash
npm run docs:dev
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

From the monorepo root:

```bash
npm run build --workspace=calmguard-docs
```

Or from `calm-suite/calm-guard/`:

```bash
npm run docs:build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
