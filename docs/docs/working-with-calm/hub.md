---
id: hub
title: Hub
sidebar_position: 9
---

# Hub

:::note
The `hub` command group is under active development.  Additional subcommands and features will be released in future verions.
:::

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

## Managing Patterns

### List patterns

To list all patterns stored in a namespace:

```shell
calm hub list patterns --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list patterns from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **ID**, **NAME**, and **VERSIONS**.

### Push a pattern

To publish a new pattern document to CALM Hub, provide the pattern file together with a name and description:

```shell
calm hub push pattern my-pattern.json \
  --name "Payments Integration Pattern" \
  --description "Reusable integration pattern for payments services" \
  --namespace my-namespace \
  -c http://localhost:8080
```

On success the command outputs the newly created pattern record, including the assigned ID.

**Options:**

- **`--name <name>`**: _(required when creating a new pattern)_ Display name for the pattern.
- **`--description <description>`**: _(required when creating a new pattern)_ Short description of the pattern.
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Push a new version of an existing pattern

To add a new version to a pattern that already exists in CALM Hub, use `--id` to identify the existing record and `--ver` to specify the semver version string:

```shell
calm hub push pattern my-pattern.json \
  --id <pattern-id> \
  --ver 1.1.0 \
  --namespace my-namespace \
  -c http://localhost:8080
```

When `--id` is provided, `--name` and `--description` are not required — they are already associated with the existing pattern record.

**Options:**

- **`--id <id>`**: The ID of the existing pattern to add a version to.
- **`--ver <version>`**: _(required when `--id` is provided)_ The semver version string for the new version (e.g. `1.1.0`).
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a pattern

To download a specific version of a pattern from CALM Hub, provide the namespace, pattern ID, and version:

```shell
calm hub pull pattern \
  --namespace my-namespace \
  --id <pattern-id> \
  --ver 1.0.0 \
  -c http://localhost:8080
```

By default the pattern JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull pattern \
  --namespace my-namespace \
  --id <pattern-id> \
  --ver 1.0.0 \
  -o pulled-pattern.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the pattern belongs to.
- **`--id <id>`**: _(required)_ The ID of the pattern to pull.
- **`--ver <version>`**: _(required)_ The version to retrieve (e.g. `1.0.0`).
- **`-o, --output <file>`**: Write the pattern JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Managing Standards

### List standards

To list all standards stored in a namespace:

```shell
calm hub list standards --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list standards from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **ID**, **NAME**, **DESCRIPTION**, and **VERSIONS**.

### Push a standard

To publish a new standard document to CALM Hub, provide the standard file together with a name and description:

```shell
calm hub push standard my-standard.json \
  --name "Payments Service Standard" \
  --description "Standard schema extensions for payments services" \
  --namespace my-namespace \
  -c http://localhost:8080
```

On success the command outputs the newly created standard record, including the assigned ID.

**Options:**

- **`--name <name>`**: _(required when creating a new standard)_ Display name for the standard.
- **`--description <description>`**: _(required when creating a new standard)_ Short description of the standard.
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Push a new version of an existing standard

To add a new version to a standard that already exists in CALM Hub, use `--id` to identify the existing record and `--ver` to specify the semver version string:

```shell
calm hub push standard my-standard.json \
  --id <standard-id> \
  --ver 1.1.0 \
  --namespace my-namespace \
  -c http://localhost:8080
```

When `--id` is provided, `--name` and `--description` are not required — they are already associated with the existing standard record.

If you provide `--name` and/or `--description` together with `--id`, CALM Hub updates the standard's stored metadata to those values when creating the new version. This means the standard's top-level name/description shown by `list standards` will reflect the latest values you pushed.

**Options:**

- **`--id <id>`**: The ID of the existing standard to add a version to.
- **`--ver <version>`**: _(required when `--id` is provided)_ The semver version string for the new version (e.g. `1.1.0`).
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a standard

To download a specific version of a standard from CALM Hub, provide the namespace, standard ID, and version:

```shell
calm hub pull standard \
  --namespace my-namespace \
  --id <standard-id> \
  --ver 1.0.0 \
  -c http://localhost:8080
```

By default the standard JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull standard \
  --namespace my-namespace \
  --id <standard-id> \
  --ver 1.0.0 \
  -o pulled-standard.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the standard belongs to.
- **`--id <id>`**: _(required)_ The ID of the standard to pull.
- **`--ver <version>`**: _(required)_ The version to retrieve (e.g. `1.0.0`).
- **`-o, --output <file>`**: Write the standard JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Managing Domains

Domains are used to organise controls in CALM Hub.

### List domains

To list all domains:

```shell
calm hub list domains -c http://localhost:8080
```

**Options:**

- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **NAME**.

### Create a domain

To create a new domain, provide a name:

```shell
calm hub create domain --name risk -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: _(required)_ The name of the domain to create.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

## Managing Control Requirements

Control requirements are managed within a domain and identified by a numeric control ID.

### List control requirements

To list all control requirements in a domain:

```shell
calm hub list control-requirements --domain risk -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The domain to list control requirements from.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **ID**, **NAME**, and **DESCRIPTION**.

### Create a control requirement

To create a new control requirement, provide the requirement JSON file together with domain, name, and description:

```shell
calm hub create control-requirement my-control-requirement.json \
  --domain risk \
  --name "MFA Required for Privileged Access" \
  --description "Administrative access must use multi-factor authentication" \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--name <name>`**: _(required)_ Control name.
- **`--description <description>`**: _(required)_ Control description.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Push a control requirement version

To add a new version to an existing control requirement, provide the requirement file with domain, control ID, and version:

```shell
calm hub push control-requirement my-control-requirement.json \
  --domain risk \
  --control-id 42 \
  --ver 1.1.0 \
  -c http://localhost:8080
```

You can optionally provide `--name` and `--description` for the version wrapper. If omitted, the CLI resolves them from the existing control metadata.

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`--ver <version>`**: _(required)_ The semver version string for the new requirement version.
- **`--name <name>`**: Optional name for the requirement version wrapper.
- **`--description <description>`**: Optional description for the requirement version wrapper.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a control requirement version

To download a specific version of a control requirement:

```shell
calm hub pull control-requirement \
  --domain risk \
  --control-id 42 \
  --ver 1.0.0 \
  -c http://localhost:8080
```

By default the requirement JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull control-requirement \
  --domain risk \
  --control-id 42 \
  --ver 1.0.0 \
  -o pulled-control-requirement.json \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The source domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`--ver <version>`**: _(required)_ The requirement version to retrieve.
- **`-o, --output <file>`**: Write the requirement JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

### List control requirement versions

To list all available versions for a control requirement:

```shell
calm hub list control-requirement-versions --domain risk --control-id 42 -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **VERSION**.

## Managing Control Configurations

Control configurations are managed per control requirement and identified by a numeric configuration ID.

### List control configurations

To list all control configurations and their versions for a control requirement:

```shell
calm hub list control-configurations --domain risk --control-id 42 -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **ID** and **VERSIONS**.

### Create a control configuration

To create a new control configuration for a control requirement:

```shell
calm hub create control-configuration my-control-configuration.json \
  --domain risk \
  --control-id 42 \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Push a control configuration version

To add a new version to an existing control configuration:

```shell
calm hub push control-configuration my-control-configuration.json \
  --domain risk \
  --control-id 42 \
  --config-id 7 \
  --ver 1.1.0 \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`--config-id <id>`**: _(required)_ The numeric configuration ID.
- **`--ver <version>`**: _(required)_ The semver version string for the new configuration version.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a control configuration version

To download a specific version of a control configuration:

```shell
calm hub pull control-configuration \
  --domain risk \
  --control-id 42 \
  --config-id 7 \
  --ver 1.0.0 \
  -c http://localhost:8080
```

By default the configuration JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull control-configuration \
  --domain risk \
  --control-id 42 \
  --config-id 7 \
  --ver 1.0.0 \
  -o pulled-control-configuration.json \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The source domain.
- **`--control-id <id>`**: _(required)_ The numeric control ID.
- **`--config-id <id>`**: _(required)_ The numeric configuration ID.
- **`--ver <version>`**: _(required)_ The configuration version to retrieve.
- **`-o, --output <file>`**: Write the configuration JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Output Formats

All `hub` subcommands support a `-f, --format <format>` option with two choices:

- **`json`** _(default)_ — outputs the raw JSON response from CALM Hub. Suitable for piping into other tools or scripts.
- **`pretty`** — renders the output as a human-readable ASCII table. Available for `list` commands; for `push`, `pull`, and `create` commands it formats the response in a more readable way.
