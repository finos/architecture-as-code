---
id: cli
title: CLI
sidebar_position: 10
---

# CALM Command Line Interface (CLI)

The CALM CLI is a set of command-line tools for defining, validating, and generating software architectures using the Common Architecture Language Model (CALM). It enables architects and developers to work with CALM models natively on their systems.

---

## Installation

The CALM CLI allows you to interact with CALM's schema, enabling you to generate, validate, and visualize your architectural definitions.

### Prerequisites

Before installing CALM, ensure that you have the following prerequisites installed on your system:

- **Node.js**: CALM CLI requires Node.js (Node 22 or later is recommended). You can download and install Node.js from [nodejs.org](https://nodejs.org/).
- **NPM**: The Node Package Manager (NPM) is typically included with Node.js, and it’s used to install the CLI.

### Installing the CALM CLI

To install the CALM CLI globally on your machine, run the following command in your terminal:

```shell
npm install -g @finos/calm-cli
```

or if you use [Homebrew](https://brew.sh):
```shell
brew install calm-cli
```

Once the installation is complete, you can verify that the CLI is installed correctly by typing:

```shell
calm --version
```

This command should display the version of the CALM CLI you have installed.

### Troubleshooting Installation

If you encounter issues during the installation, consider the following troubleshooting steps:

- **Permissions Error**: If you get a permissions error, try running the installation command with elevated privileges using `sudo` (Linux/macOS) or running the command prompt as an administrator (Windows).
- **Node Version**: Ensure you are using a compatible version of Node.js. Updating to a supported version is recommended.

---

## Basic Usage

The CALM CLI provides a set of commands that allow you to interact with CALM’s architecture model.

Once installed, you can access the CLI by typing `calm` in your terminal. This command will display the help text and available commands:

```shell
calm
```

You should see output similar to the following:

```shell
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model (CALM)

Options:
  -V, --version               output the version number
  -h, --help                  display help for command

Commands:
  generate [options]          Generate an architecture from a CALM pattern file.
  validate [options]          Validate that an architecture conforms to a given CALM pattern.
  diff [options]              Compare two CALM documents (architectures or patterns) and report what changed.
  template [options]          Generate files from a CALM model using a template bundle, a single file, or a directory of templates
  docify [options]            Generate a documentation website from your CALM model using a template or template directory
  init-ai [options]           Augment a git repository with AI assistance for CALM
  help [command]              display help for command
```

### AI-Powered Development

CALM CLI includes AI-powered development assistance through the `init-ai` command. This feature integrates with various IDEs and Coding Assistants to provide intelligent help with architecture modeling. Learn more in the [CALM AI Tools](calm-ai-tools) section.

---

## Generating Architectures

The `generate` command allows you to create an architecture from a predefined CALM pattern. This command helps you quickly set up the structure of your architecture using reusable patterns, which can then be customized to fit your specific needs.

### Basic Usage

To generate an architecture, you will need a pattern file that defines the architecture template. You can use the `generate` command with the `--pattern` option to specify the path to the pattern file:

```shell
calm generate -p calm/pattern/api-gateway.json
```

This will create an architecture in the current working directory with the default filename `architecture.json`.

### Command Options

- **`-p, --pattern <source>`**: Path to the pattern file to use. This can be a file path or a URL.
- **`-o, --output <output>`**: Path to the location where the generated file will be saved (default is `architecture.json`).
- **`-s, --schema-directory <path>`**: Path to the directory containing schemas to use in architecture.
- **`-c, --calm-hub-url <url>`**: URL to CALMHub instance.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL Mapping](#url-to-local-file-mapping) below).
- **`--option-choices <choices>`**: Pre-defined option choices as a JSON object, or a path to a JSON file. Skips interactive prompts (see [Pattern Options](#pattern-options) below).
- **`-v, --verbose`**: Enable verbose logging.

### Example

Here is an example command that generates an architecture from a CALM pattern file and saves it with a custom filename:

```shell
calm generate -p calm/pattern/microservices.json -o my-architecture.json
```

This command uses the `microservices.json` pattern and outputs the result to `my-architecture.json`.

### Pattern Options

Some CALM patterns contain `options` relationships that present a choice of which nodes and relationships to include in the generated architecture. When you run `calm generate` against such a pattern, the CLI will interactively prompt you to make each choice.

#### Interactive prompts

For each options relationship in the pattern, the CLI will ask you to select a choice:

- **`oneOf`** options present a single-select prompt — you must pick exactly one.
- **`anyOf`** options present a multi-select prompt — you can pick zero or more.

#### Pre-defining choices non-interactively

You can skip the interactive prompts by passing `--option-choices` with a JSON object that maps each option's `unique-id` to the chosen description(s).

- For **`oneOf`** options, supply a **string** (exactly one choice).
- For **`anyOf`** options, supply a **string** or an **array of strings** (one or more choices).

```shell
# oneOf option — single string
calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C"}'

# anyOf option — array of strings
calm generate -p pattern.json --option-choices '{"node-options": ["Node 1", "Node 2"]}'

# Mixed oneOf and anyOf
calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C", "node-options": ["Node 1", "Node 2"]}'
```

You can also save the choices to a file in the same JSON format and pass the path instead:

```json
{
  "connection-options": "Application A connects to Application C",
  "node-options": ["Node 1", "Node 2"]
}
```

```shell
calm generate -p pattern.json --option-choices choices.json
```

The keys in the object must match the `unique-id` of the options relationship in the pattern. The values must match the `description` of one or more of the available choices within that option.

:::tip
After running `calm generate` interactively, the CLI prints your selections in the `--option-choices` format so you can save them for later use:

```
info: Selected choices (reusable with --option-choices): {"connection-options":"Application A connects to Application C","node-options":["Node 1","Node 2"]}
```
:::

### URL to Local File Mapping

When developing patterns locally, you may want to reference Standards or other schemas via canonical URLs (e.g., `https://example.com/standards/node-standard.json`) while the actual files exist on your local filesystem. The `-u, --url-to-local-file-mapping` option allows you to map these URLs to local paths.

#### Mapping File Format

Create a JSON file that maps URLs to relative file paths:

```json
{
  "https://example.com/standards/node-standard.json": "standards/node-standard.json",
  "https://example.com/standards/relationship-standard.json": "standards/relationship-standard.json"
}
```

Paths in the mapping file are resolved relative to the mapping file's location.

#### Example Usage

```shell
calm generate -p pattern.json -o architecture.json -u url-mapping.json
```

#### Relative Path Resolution

For patterns that don't have an `$id` field, the CLI automatically resolves relative `$ref` paths against the pattern file's directory. For example, if your pattern is at `patterns/my-pattern.json` and contains:

```json
{
  "$ref": "standards/my-standard.json"
}
```

The CLI will look for the standard at `patterns/standards/my-standard.json`.

---

## Validating Architectures

The `validate` command is used to check if an architecture conforms to a given CALM pattern. Validation helps ensure that your architecture adheres to best practices and meets the required standards.

### Basic Usage

To validate an architecture against a pattern, use the `validate` command with the `--pattern` and `--architecture` options:

```shell
calm validate -p calm/pattern/api-pattern.json -a architecture.json
```

If the architecture does not match the pattern, the command will output a list of errors and warnings that need to be addressed.

### Command Options

- **`-p, --pattern <pattern>`**: Path to the pattern file. This can be a local file path or a URL.
- **`-a, --architecture <architecture>`**: Path to the architecture file to validate.
- **`    --timeline <timeline>`**: Path to the timeline file to validate.
- **`-s, --schema-directory <path>`**: Path to the directory containing the meta schemas to use.
- **`-c, --calm-hub-url <url>`**: URL to CALMHub instance.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL Mapping](#url-to-local-file-mapping) below).
- **`--strict`**: When enabled, the CLI will fail if any warnings are reported (default: false).
- **`-f, --format <format>`**: The format of the output (choices: "json", "junit", "pretty", default: "json").
- **`-o, --output <file>`**: Path location at which to output the validation results.
- **`-v, --verbose`**: Enable verbose logging to see detailed validation output.

### Example of Architecture Validation

Here is an example command that validates an architecture against a pattern and outputs the results in JSON format:

```shell
calm validate -p calm/pattern/api-pattern.json -a my-architecture.json -f json
```

This command will check if `my-architecture.json` conforms to the `api-pattern.json` and display any validation errors or warnings.

### Example of Timeline Validation

Here is an example command that validates a timeline and outputs the results in JSON format:

```shell
calm validate --timeline calm/architecture/calm.timeline.json -f json
```

This command will check if `calm.timeline.json` conforms to the timeline schema and display any validation errors or warnings.

### URL to Local File Mapping (Validate)

Refer to the [URL to Local File Mapping](#url-to-local-file-mapping) instructions above under the Generate section. The mapping behavior is identical.

### Validation Server

The separate `@finos/calm-server` package provides a network accessible [validation server](validation-server.md).

---

## Documenting Architectures (Docify)

The `docify` command transforms a CALM architecture JSON file into human-readable documentation. It supports two primary output modes:

- **Website generation** — uses the built-in template bundle to produce a fully structured Markdown documentation site ready to publish with a static site generator.
- **Custom Markdown reports** — uses your own Handlebars (`.hbs`) or Markdown (`.md`) templates to render bespoke reports, conformance summaries, runbooks, or any other document format you need.

In both modes, `docify` processes your architecture model through a set of templates and writes the resulting files to an output directory. Template rendering is powered by [CALM Widgets](../core-concepts/widgets) — a Handlebars-based component system that provides built-in helpers for tables, lists, Mermaid diagrams, and more.

### Basic Usage

#### Generate a documentation website

To generate a documentation website using the built-in template bundle, provide the path to your architecture file and the directory where the output should be written:

```shell
calm docify -a architecture.json -o docs/output
```

This uses the default website template bundle and produces a fully structured Markdown documentation site in `docs/output`.

#### Generate a custom Markdown report

To produce a tailored document — such as a compliance report or runbook — supply your own template:

```shell
calm docify -a architecture.json -o reports/ -t my-report-template.hbs
```

Or point to a directory of templates to generate multiple output files in one pass:

```shell
calm docify -a architecture.json -o reports/ -d my-templates/
```

### Command Options

- **`-a, --architecture <file>`**: _(required)_ Path to the CALM architecture JSON file.
- **`-o, --output <file>`**: _(required)_ Path to the output directory where the generated documentation will be written.
- **`--clear-output-directory`**: Clear the output directory before processing (default: false).
- **`-t, --template <path>`**: Path to a single `.hbs` or `.md` template file to use instead of the built-in bundle.
- **`-d, --template-dir <path>`**: Path to a directory of `.hbs`/`.md` templates to use instead of the built-in bundle.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths.
- **`--scaffold`**: Copy the built-in template files into the output directory without processing them. Use this to obtain a starting point for customisation or for live-reload workflows.
- **`-v, --verbose`**: Enable verbose logging.

### Examples

#### Generate website with the built-in bundle

```shell
calm docify -a my-architecture.json -o docs/output
```

#### Generate a custom Markdown report from a single template

```shell
calm docify -a my-architecture.json -o reports/ -t templates/compliance-report.hbs
```

#### Generate multiple documents from a template directory

```shell
calm docify -a my-architecture.json -o reports/ -d my-templates/
```

#### Scaffold the built-in templates for customisation

```shell
calm docify -a my-architecture.json -o docs/output --scaffold
```

---

## Interacting with CALM Hub

:::note
The `hub` command group is under active development. Additional subcommands and features will be released in future versions.
:::

The `hub` command group allows you to interact with a running `CALM Hub` instance directly from the CLI. You can use it to manage namespaces and push, pull, and list CALM architecture documents stored in CALM Hub.

### Connecting to CALM Hub

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

### Managing Namespaces

#### List namespaces

To list all namespaces in CALM Hub:

```shell
calm hub list namespaces -c http://localhost:8080
```

**Options:**

- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`. The `pretty` format renders results as an ASCII table with columns **NAME** and **DESCRIPTION**.

#### Create a namespace

To create a new namespace, provide a name and a description:

```shell
calm hub create namespace --name my-namespace --description "Architectures for the payments domain" -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: _(required)_ The name of the namespace to create.
- **`--description <description>`**: _(required)_ A short description of the namespace.
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

### Managing Architectures

#### List architectures

To list all architectures stored in a namespace:

```shell
calm hub list architectures --namespace my-namespace -c http://localhost:8080
```

**Options:**

- **`--namespace <namespace>`**: The namespace to list architectures from (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

#### Push an architecture

To publish a new architecture document to CALM Hub, provide the architecture file together with a name and description:

```shell
calm hub push architecture my-architecture.json \
  --name "Payments Service" \
  --description "Architecture for the payments service" \
  --namespace my-namespace \
  -c http://localhost:8080
```

**Options:**

- **`--name <name>`**: _(required when creating a new architecture)_ Display name for the architecture.
- **`--description <description>`**: _(required when creating a new architecture)_ Short description of the architecture.
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

#### Push a new version of an existing architecture

To add a new version to an architecture that already exists in CALM Hub, use `--id` to identify the existing record and `--ver` to specify the semver version string:

```shell
calm hub push architecture my-architecture.json \
  --id <architecture-id> \
  --ver 1.1.0 \
  --namespace my-namespace \
  -c http://localhost:8080
```

**Options:**

- **`--id <id>`**: The ID of the existing architecture to add a version to.
- **`--ver <version>`**: _(required when `--id` is provided)_ The semver version string for the new version (e.g. `1.1.0`).
- **`--namespace <namespace>`**: Target namespace (default: `default`).
- **`-c, --calm-hub-url <url>`**: URL to the CALM Hub instance.
- **`-f, --format <format>`**: Output format — `json` (default) or `pretty`.

#### Pull an architecture

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
