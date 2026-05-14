---
id: hub
title: Hub
sidebar_position: 9
---

# Hub

The `hub` command group allows you to interact with a running `CALM Hub` instance directly from the CLI. You can use it to manage namespaces and push, pull, and list CALM architecture documents stored in CALM Hub.

## Connecting to CALM Hub

All `hub` subcommands accept a `-c, --calm-hub-url <url>` option that specifies the base URL of the CALM Hub instance to connect to:

```shell
calm hub list namespaces -c http://localhost:8080
```

If `-c` is omitted, the CLI will look for a `calmHubUrl` property in `~/.calm.json` and use that value as a fallback:

```json title="~/.calm.json"
{
  "calmHubUrl": "http://localhost:8080"
}
```

## Managing Namespaces

Namespaces are used to organise architectures within CALM Hub.

### List namespaces

To list all namespaces in CALM Hub:

```shell
calm hub list namespaces -c http://localhost:8080
```

**Options:**

- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **NAME** and **DESCRIPTION**.

### Create a namespace

To create a new namespace, provide a name and a description:

```shell
calm hub create namespace --name my-namespace --description "Architectures for the payments domain" -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: _(required)_ The name of the namespace to create.
- **`--description <description>`**: _(required)_ A short description of the namespace.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

## Managing Architectures

### List architectures

To list all architectures stored in a namespace:

```shell
calm hub list architectures --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list architectures from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **ID**, **NAME**, and **VERSIONS**.

### Push an architecture

To publish a new architecture document to CALM Hub, provide the architecture file together with a name and description:

```shell
calm hub push architecture my-architecture.json \
  --name "Payments Service" \
  --description "Architecture for the payments service" \
  --namespace my-namespace \
  -c http://localhost:8080
```

On success the command outputs the newly created architecture record, including the assigned ID.

**Options:**

- **`--name <name>`**: _(required when creating a new architecture)_ Display name for the architecture.
- **`--description <description>`**: _(required when creating a new architecture)_ Short description of the architecture.
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Push a new version of an existing architecture

To add a new version to an architecture that already exists in CALM Hub, use `--id` to identify the existing record and `--ver` to specify the semver version string:

```shell
calm hub push architecture my-architecture.json \
  --id <architecture-id> \
  --ver 1.1.0 \
  --namespace my-namespace \
  -c http://localhost:8080
```

When `--id` is provided, `--name` and `--description` are not required — they are already associated with the existing architecture record.

**Options:**

- **`--id <id>`**: The ID of the existing architecture to add a version to.
- **`--ver <version>`**: _(required when `--id` is provided)_ The semver version string for the new version (e.g. `1.1.0`).
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull an architecture

To download a specific version of an architecture from CALM Hub, provide the namespace, architecture ID, and version:

```shell
calm hub pull architecture \
  --namespace my-namespace \
  --id <architecture-id> \
  --ver 1.0.0 \
  -c http://localhost:8080
```

By default the architecture JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull architecture \
  --namespace my-namespace \
  --id <architecture-id> \
  --ver 1.0.0 \
  -o pulled-architecture.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the architecture belongs to.
- **`--id <id>`**: _(required)_ The ID of the architecture to pull.
- **`--ver <version>`**: _(required)_ The version to retrieve (e.g. `1.0.0`).
- **`-o, --output <file>`**: Write the architecture JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Output Formats

All `hub` subcommands support a `-f, --format <format>` option with two choices:

- **`json`** _(default)_ — outputs the raw JSON response from CALM Hub. Suitable for piping into other tools or scripts.
- **`pretty`** — renders the output as a human-readable ASCII table. Available for `list` commands; for `push`, `pull`, and `create` commands it formats the response in a more readable way.
