---
id: hub
title: Interacting with CALM Hub
sidebar_label: hub
---

# Interacting with CALM Hub

:::warning
The `hub` command group is under active development.  Functionality may change without notice.
:::

The `hub` command group allows you to interact with a running `CALM Hub` instance directly from the CLI. You can use it to manage Namespaces, Architectures, Standards, Patterns, Timelines, Domains and Controls stored in CALM Hub, and to run the commands of CALM Hub extensions.

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

See [Configuring the CLI](configuration.md) for the other settings, and for authentication plugins for CALM Hub.

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

### Your personal namespace

If the CALM Hub operator turns on [personal namespaces](../working-with-calm/calm-hub-entitlements.md#personal-namespaces), you can have one private namespace for scratch work, for example `users.mark-scott`.

To show its name and whether it exists:

```shell
calm hub whoami -c http://localhost:8080 -f pretty
```

The `pretty` format shows the **PERSONAL NAMESPACE** and its **STATE**: `Not created`, `Yours`, or `Held by another user`.

To create it:

```shell
calm hub create my-namespace -c http://localhost:8080
```

If you already own the namespace, the command does nothing and reports `Exists`. Put the namespace name in the `$id` of each document that you push to it.

Both commands take `-c, --calm-hub-url <url>` and `-f, --format <format>`. They fail with 404 when personal namespaces are off, and with 409 (`create`) when another user holds the name.

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

## Managing Timelines

### List timelines

To list all timeline mapping slugs stored in a namespace:

```shell
calm hub list timelines --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list timelines from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with column **MAPPING**.

### Push a timeline

The file must include a top-level `title` alongside `$id`. The document's `$id` field determines the target namespace, resource type, and mapping slug. The CLI computes the next version, rewrites `$id` in the local file, and uploads the document.

```shell
calm hub push timeline my-timeline.json -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: Optional display name override (replaces the document's `title` field when pushed; `title` must still be present in the file).
- **`--description <description>`**: Optional description override (falls back to the document's `description` field).
- **`-t, --change-type <type>`**: Semver bump type — `patch` (default), `minor`, or `major`.
- **`--fail-if-modified`**: Skip if the document is unchanged from the latest published version; fail if it has changed.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Pull a timeline

To download a timeline from CALM Hub, provide the namespace and mapping slug. Omit `--ver` to pull the latest version:

```shell
calm hub pull timeline \
  --namespace my-namespace \
  --mapping my-timeline \
  -c http://localhost:8080
```

By default the timeline JSON is written to stdout. Use `-o` to write it to a file instead:

```shell
calm hub pull timeline \
  --namespace my-namespace \
  --mapping my-timeline \
  --ver 1.0.0 \
  -o pulled-timeline.json \
  -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: _(required)_ The namespace the timeline belongs to.
- **`-m, --mapping <mapping>`**: _(required)_ The mapping slug of the timeline.
- **`--ver <version>`**: Version to retrieve (defaults to latest).
- **`-o, --output <file>`**: Write the timeline JSON to a file instead of stdout.
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

## Running Extension Commands

A CALM Hub operator can enable extensions. An extension can declare commands, and the CLI runs them through CALM Hub. The CLI does not add a subcommand for each extension command, so `--help` works without a CALM Hub. An extension command runs only under `calm hub ext <id>`, so it cannot replace a built-in command.

### List extensions

```shell
calm hub extensions list -c http://localhost:8080
```

The `pretty` format shows the columns **ID**, **VERSION**, **NAME** and **COMMANDS**. CALM Hub leaves out the commands that it cannot run, for example write commands on a read-only CALM Hub.

### Describe an extension or a command

```shell
calm hub extensions describe example-services
calm hub extensions describe example-services list-services
```

With a command name, the output shows the method, path and scope of the command's route, and the input and output JSON Schemas. `readOnly` is `true` for a `GET` route and for a route that the manifest marks `readOnly`, as the MCP `readOnlyHint` is.

### Run a command

```shell
calm hub ext example-services list-services --arg namespace=finos
echo '{"namespace":"finos","name":"payments"}' | calm hub ext example-services add-service --input -
```

**Options:**

- **`--input <file>`**: A JSON file with the command input object, or `-` to read it from stdin.
- **`--arg <key=value>`**: Sets a top-level input property. You can use it more than once, and it overrides `--input`. The value gets the type that the input schema declares for the property, so `--arg limit=5` sends a number. A number converts only when it is written as it is sent, so `0x10`, `1e3`, `1.0` and an integer above 2^53 stay strings, for the extension to reject. `--arg` cannot set `__proto__`: put it in the `--input` file.
- **`--timeout <seconds>`**: Stops waiting for the reply after this many seconds, written as a decimal number up to 2147483. With no `--timeout`, the CLI waits until CALM Hub ends the call at the `request-timeout-seconds` of the extension. If the CLI stops waiting on a write, CALM Hub and the extension can still complete the write, so check before you run the command again.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Error format, `json` (default) or `pretty`.

Input properties that match a `{param}` in the route path fill the path. Such a value must not be empty or `.`, or contain `..`, `/`, `\`, `%`, `@`, a look-alike of `/`, `\`, `.`, `%`, `@` or `;` (such as `∕` U+2215, `＼` U+FF3C or `‥` U+2025), a code point whose NFKC form contains `/` or `\` (such as U+2100, `a/c`), a control character or a lone surrogate, because CALM Hub refuses these in a path. A value that makes the path match another route of the extension, such as `admin` for `/services/{name}` next to a `/services/admin` route, is refused too. The other properties go to the query for `GET` and `DELETE`, and to the JSON body for other methods. A query name or value must not contain a control character or a lone surrogate. A number fills the path or the query in plain notation, as for an MCP tool, so `1e21` gives `1000000000000000000000`. The CLI and MCP encode a value in the same way, so CALM Hub signs the same path and query for both. A JSON reply is printed as JSON, and a text reply as text.

CALM Hub checks the route, the path and the scope. It does not check the input against the input schema, as it does for an MCP tool: the extension checks it. If CALM Hub or the extension rejects the call, the CLI exits with code 1 and prints the error with the body as CALM Hub sent it. For example, `add-service` with no `name`:

```json
{"status":400,"error":"name is required","request":"POST /api/calm/extensions/example-services/api/namespaces/finos/services","body":{"error":"name is required"}}
```

CALM Hub sends a generic `502` with the error `The extension failed` when the extension refuses the connection, when the reply is larger than the reply limit, when the extension replies with a 3xx, 401, 407 or 5xx status, or when the reply has a content type that CALM Hub does not pass on. The extension's own body does not reach the CLI. CALM Hub sends `504` with the error `The extension did not reply in time` when the connection or the reply takes longer than its timeout.

## Output Formats

All `hub` subcommands support a `-f, --format <format>` option with two choices:

- **`json`** _(default)_ — outputs the raw JSON response from CALM Hub. Suitable for piping into other tools or scripts.
- **`pretty`** — renders the output as a human-readable ASCII table. Available for `list` commands; for `push` and `pull` commands it formats the response in a more readable way. For `ext`, it changes only the error format.
