---
id: hub
title: Interacting with CALM Hub
sidebar_label: hub
---

# Interacting with CALM Hub

:::warning
The `hub` command group is under active development.  Functionality may change without notice.
:::

The `hub` command group allows you to interact with a running `CALM Hub` instance directly from the CLI. You can use it to manage Namespaces, Architectures, Standards, Patterns, Domains and Controls stored in CALM Hub.

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

## Document Identity and Versioning

CALM Hub uses the `$id` field inside each document to determine its addressing: the namespace, resource type, mapping slug, and version are all parsed from `$id`. When you push a document, the CLI reads the current `$id`, computes the next semver version automatically, rewrites `$id` in the local file with the new version, then uploads it. You never need to pass a namespace, ID, or version on the command line for push operations.

The `-t, --change-type` option controls which semver component is incremented on each push (default: `patch`):

| Value | Example jump |
|---|---|
| `patch` _(default)_ | 1.0.0 → 1.0.1 |
| `minor` | 1.0.0 → 1.1.0 |
| `major` | 1.0.0 → 2.0.0 |

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

To list all architecture mapping slugs stored in a namespace:

```shell
calm hub list architectures --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list architectures from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **MAPPING**.

### Push an architecture

The document's `$id` field determines the target namespace, resource type, and mapping slug. The CLI computes the next version, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push architecture my-architecture.json -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: Optional display name override (falls back to the document's `title` field).
- **`--description <description>`**: Optional description override (falls back to the document's `description` field).
- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull an architecture

To download an architecture from CALM Hub, provide the namespace and mapping slug. Omit `--ver` to pull the latest version:

```shell
calm hub pull architecture \
  --namespace my-namespace \
  --mapping my-architecture \
  -c http://localhost:8080
```

By default the architecture JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull architecture \
  --namespace my-namespace \
  --mapping my-architecture \
  --ver 1.0.0 \
  -o pulled-architecture.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the architecture belongs to.
- **`-m, --mapping <mapping>`**: _(required)_ The mapping slug of the architecture.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
- **`-o, --output <file>`**: Write the architecture JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Managing Patterns

### List patterns

To list all pattern mapping slugs stored in a namespace:

```shell
calm hub list patterns --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list patterns from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **MAPPING**.

### Push a pattern

The document's `$id` field determines the target namespace, resource type, and mapping slug. The CLI computes the next version, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push pattern my-pattern.json -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: Optional display name override (falls back to the document's `title` field).
- **`--description <description>`**: Optional description override.
- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a pattern

To download a pattern from CALM Hub, provide the namespace and mapping slug. Omit `--ver` to pull the latest version:

```shell
calm hub pull pattern \
  --namespace my-namespace \
  --mapping my-pattern \
  -c http://localhost:8080
```

By default the pattern JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull pattern \
  --namespace my-namespace \
  --mapping my-pattern \
  --ver 1.0.0 \
  -o pulled-pattern.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the pattern belongs to.
- **`-m, --mapping <mapping>`**: _(required)_ The mapping slug of the pattern.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
- **`-o, --output <file>`**: Write the pattern JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Managing Standards

### List standards

To list all standard mapping slugs stored in a namespace:

```shell
calm hub list standards --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list standards from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **MAPPING**.

### Push a standard

The document's `$id` field determines the target namespace, resource type, and mapping slug. The CLI computes the next version, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push standard my-standard.json -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: Optional display name override (falls back to the document's `title` field).
- **`--description <description>`**: Optional description override.
- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a standard

To download a standard from CALM Hub, provide the namespace and mapping slug. Omit `--ver` to pull the latest version:

```shell
calm hub pull standard \
  --namespace my-namespace \
  --mapping my-standard \
  -c http://localhost:8080
```

By default the standard JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull standard \
  --namespace my-namespace \
  --mapping my-standard \
  --ver 1.0.0 \
  -o pulled-standard.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the standard belongs to.
- **`-m, --mapping <mapping>`**: _(required)_ The mapping slug of the standard.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
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

## Managing Controls

Controls are organised within domains and addressed by name.

### List controls

To list all controls in a domain:

```shell
calm hub list controls --domain risk -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The domain to list controls from.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **NAME**, **ID**, and **DESCRIPTION**.

### Push a control requirement version

The document's `$id` determines the domain, control name, and version. The CLI computes the next semver version automatically, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push control-requirement my-control-requirement.json -c http://localhost:8080
```

**Options:**

- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a control requirement version

To download a control requirement from CALM Hub, provide the domain and control name. Omit `--ver` to pull the latest version:

```shell
calm hub pull control-requirement \
  --domain risk \
  --control-name access-control \
  -c http://localhost:8080
```

By default the requirement JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull control-requirement \
  --domain risk \
  --control-name access-control \
  --ver 1.0.0 \
  -o pulled-control-requirement.json \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The source domain.
- **`--control-name <controlName>`**: _(required)_ The control name.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
- **`-o, --output <file>`**: Write the requirement JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Managing Control Configurations

### List control configurations

To list all configurations for a control:

```shell
calm hub list control-configurations \
  --domain risk \
  --control-name access-control \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The target domain.
- **`--control-name <controlName>`**: _(required)_ The control name.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **NAME**, **ID**, and **DESCRIPTION**.

### Push a control configuration version

The document's `$id` determines the domain, control name, configuration name, and version. The CLI computes the next semver version automatically, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push control-configuration my-control-configuration.json -c http://localhost:8080
```

**Options:**

- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a control configuration version

To download a control configuration from CALM Hub, provide the domain, control name, and configuration name. Omit `--ver` to pull the latest version:

```shell
calm hub pull control-configuration \
  --domain risk \
  --control-name access-control \
  --config-name prod \
  -c http://localhost:8080
```

By default the configuration JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull control-configuration \
  --domain risk \
  --control-name access-control \
  --config-name prod \
  --ver 1.0.0 \
  -o pulled-control-configuration.json \
  -c http://localhost:8080
```

**Options:**

- **`--domain <domain>`**: _(required)_ The source domain.
- **`--control-name <controlName>`**: _(required)_ The control name.
- **`--config-name <configName>`**: _(required)_ The configuration name.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
- **`-o, --output <file>`**: Write the configuration JSON to a file instead of stdout.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.

## Output Formats

All `hub` subcommands support a `-f, --format <format>` option with two choices:

- **`json`** _(default)_ — outputs the raw JSON response from CALM Hub. Suitable for piping into other tools or scripts.
- **`pretty`** — renders the output as a human-readable ASCII table. Available for `list` commands; for `push` and `pull` commands it formats the response in a more readable way.
