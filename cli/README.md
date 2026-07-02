# CALM CLI

A command line interface to interact with the CALM schema.
You can use these tools to create an architecture from a CALM pattern, or validate that an architecture conforms to a given pattern.

## Config file reference

The CLI will load user config from `~/.calm.json` to allow profile-level config of CalmHub and other details.
These properties can also be loaded from environment variables; if set they will override the config file.

Note that if they're set on the command line, e.g. `--calm-hub-url`, this will override both the file and env vars.

| Config file property | Environment variable        | Description  |
| -------------------- | --------------------------- | ------------ |
| `allowedRemoteHosts` | `CALM_ALLOWED_REMOTE_HOSTS` | List of allowed hosts to use when loading files directly from raw URLs. Note that in env variable form this should be a comma-separated list. | 
| `authPluginPath`     | `CALM_AUTH_PLUGIN_PATH`     | Path to authentication plugin (should be a JS file.) See [Authentication Plugins](#authentication-plugins). |
| `calmHubUrl`         | `CALM_HUB_URL`              | CalmHub instance to use. Note that setting this property will automatically configure CalmHub as a loading mechanism for commands such as validate. |

## Using the CLI

### Getting Started

Install the CLI on to your machine with this command:

```shell
% npm install -g @finos/calm-cli
```

or if you use [Homebrew](https://brew.sh):
```shell
brew install calm-cli
```

Type `calm` into your terminal, and you should see the help text printed out.

```shell
% calm
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model (CALM)

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  generate [options]          Generate an architecture from a CALM pattern file.
  validate [options]          Validate that an architecture conforms to a given CALM pattern.
  diff [options]              Compare two CALM documents (architectures or patterns) and report what changed.
  template [options]          Generate files from a CALM model using a Handlebars template bundle.
  docify [options]            Generate a documentation website off your CALM model.
  init-ai [options]           Augment a git repository with AI assistance for CALM
  help [command]              display help for command
```

### Generating an architecture from a CALM pattern file

This command lets you create a shell of an architecture from a pattern file.
You can try it out using the example patterns provided in this repo under `calm/pattern`.

```shell
calm
Usage: calm generate [options]

Generate an architecture from a CALM pattern file.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -o, --output <file>           Path location at which to output the generated file. (default: "architecture.json")
  -s, --schema-directory <path>  Path to the directory containing the meta schemas to use. (default: "../calm/release")
  -c, --calm-hub-url <url>      URL to CalmHub to use when loading documents.
  --option-choices <choices>    Pre-defined option choices as a JSON object mapping option unique-ids to choice descriptions. Skips interactive prompts.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

The most simple way to use this command is to call it with only the pattern option, which will generate an architecture with the default filename `architecture.json` in the current working directory.

```shell
% calm generate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json
```

#### Pattern options

Some CALM patterns define **options** — decision points where the architecture can vary. When a pattern contains options, the `generate` command will prompt you interactively to make your selections. At the end of the prompts, the CLI prints the choices you made in a format you can save and reuse:

```
info: Selected choices (reusable with --option-choices): {"connection-options":"Application A connects to Application C","node-options":["Node 1","Node 2"]}
```

To skip the interactive prompts, pass your choices via `--option-choices` as an inline JSON string or a path to a JSON file.

- For a **`oneOf`** option (pick exactly one), supply a string value.
- For an **`anyOf`** option (pick one or more), supply a string or an array of strings.

```shell
# Inline JSON — single oneOf choice
% calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C"}'

# Inline JSON — mixed oneOf and anyOf
% calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C", "node-options": ["Node 1", "Node 2"]}'

# From a saved choices file
% calm generate -p pattern.json --option-choices ./my-choices.json
```

### Validating a CALM architecture

This command will tell you if an architecture matches a pattern that you provide.
If it doesn't, then it will output a list of problems that you can address to help your architecture conform to the pattern.

```shell
% calm validate --help
Usage: calm validate [options]

Validate that an architecture conforms to a given CALM pattern.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -a, --architecture <file>     Path to the pattern architecture file to use. May be a file path or a URL.
  -s, --schema-directory <path> Path to the directory containing the meta schemas to use. (default: "../calm/release")
  -c, --calm-hub-url <url>      URL to CalmHub to use when loading documents.
  --strict                  When run in strict mode, the CLI will fail if any warnings are reported. (default: false)
  -f, --format <format>         The format of the output (choices: "json", "junit", default: "json")
  -o, --output <file>           Path location at which to output the generated file.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

This command can output warnings and errors - the command will only exit with an error code if there are errors present in the output.
Warnings are sometimes provided as hints about how to improve the architecture, but they are not essential for the architecture to match the pattern.

If you were to try and generate an architecture from the conference pattern, and then validate the architecture against that pattern like this

```shell
% calm generate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json -o ./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json
% calm validate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json -a ./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json
```

You would get an output which includes a warning like this:

```json
...
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/conference-website/interfaces/conference-website-url/url",
          "schemaPath": "",
          "line_start": 11,
          "line_end": 11,
          "character_start": 17,
          "character_end": 28
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/load-balancer/interfaces/load-balancer-host-port/host",
          "schemaPath": "",
          "line_start": 23,
          "line_end": 23,
          "character_start": 18,
          "character_end": 30
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/load-balancer/interfaces/load-balancer-host-port/port",
          "schemaPath": "",
          "line_start": 24,
          "line_end": 24,
          "character_start": 18,
          "character_end": 20
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/attendees/interfaces/attendees-image/image",
          "schemaPath": "",
          "line_start": 36,
          "line_end": 36,
          "character_start": 19,
          "character_end": 32
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/attendees/interfaces/attendees-port/port",
          "schemaPath": "",
          "line_start": 40,
          "line_end": 40,
          "character_start": 18,
          "character_end": 20
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/attendees-store/interfaces/database-image/image",
          "schemaPath": "",
          "line_start": 52,
          "line_end": 52,
          "character_start": 19,
          "character_end": 32
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/attendees-store/interfaces/database-port/port",
          "schemaPath": "",
          "line_start": 56,
          "line_end": 56,
          "character_start": 18,
          "character_end": 20
        }
    ],
    "hasErrors": false,
    "hasWarnings": true
}
...
```

You can also request pretty text output, which shows the same paths and the exact source lines/columns:

```shell
Summary
- Errors: no (0)
- Warnings: yes (7)
- Info/Hints: 0

WARN  issues:
- In conference-signup.arch.json (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json):
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/conference-website/interfaces/conference-website-url/url
    at line 11, col 18 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    11 |           "url": "[[ URL ]]"
       |                  ^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/load-balancer/interfaces/load-balancer-host-port/host
    at line 23, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    23 |           "host": "[[ HOST ]]",
       |                   ^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/load-balancer/interfaces/load-balancer-host-port/port
    at line 24, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    24 |           "port": -1
       |                   ^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/attendees/interfaces/attendees-image/image
    at line 36, col 20 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    36 |           "image": "[[ IMAGE ]]"
       |                    ^^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/attendees/interfaces/attendees-port/port
    at line 40, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    40 |           "port": -1
       |                   ^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/attendees-store/interfaces/database-image/image
    at line 52, col 20 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    52 |           "image": "[[ IMAGE ]]"
       |                    ^^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/attendees-store/interfaces/database-port/port
    at line 56, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    56 |           "port": -1
       |                   ^^
```

which is just letting you know that you have left in some placeholder values which might have been generated with the generate command.
This isn't a full break, but it implies that you've forgotten to fill out a detail in your architecture.

### Diffing two CALM documents

This command compares two versions of a CALM document and reports what changed between them. It works on both **architectures** and **patterns**, matching nodes and relationships by their `unique-id` and classifying each as added, removed, modified, or renamed. The document type is auto-detected; use `--type` to override detection.

```shell
% calm diff --help
Usage: calm diff [options]

Compare two CALM documents (architectures or patterns) and report what changed.

Options:
  -a, --document-a <file>   Path to the first (baseline) CALM document.
  -b, --document-b <file>   Path to the second CALM document to compare against the baseline.
  -f, --format <format>     Output format (choices: "json", "summary", default: "json")
  -t, --type <type>         Force the document type instead of auto-detecting it. (choices: "architecture", "pattern")
  -o, --output <file>       Path location at which to write the diff output. If omitted, prints to stdout.
  --exit-code               Exit with a non-zero status code when changes are detected. Useful in CI to gate version bumps.
  -v, --verbose             Enable verbose logging. (default: false)
  -h, --help                display help for command
```

For a quick human-readable overview, use `--format summary`:

```shell
% calm diff -a ./baseline.arch.json -b ./updated.arch.json --format summary
CALM architecture diff
----------------------
Nodes:         +1  -0  ~1  ↔0  =3
Relationships: +1  -0  ~0  ↔0  =2

Nodes added:
  - audit-service
...
```

The same command compares two patterns — pass the pattern files instead:

```shell
% calm diff -a ./v1.pattern.json -b ./v2.pattern.json --format summary
```

The `--exit-code` flag makes the command exit non-zero when any change (including items skipped for a missing `unique-id`) is detected, so it can gate version bumps in CI:

```shell
% calm diff -a ./baseline.arch.json -b ./updated.arch.json --exit-code
```

## CALM init-ai

The `init-ai` command sets up AI-powered development assistance for CALM architecture modeling by configuring specialized prompt files with comprehensive tool prompts. At present four AI Assistant providers are supported: GitHub Copilot, Claude Code, AWS Kiro, and Codex.

```shell
calm init-ai --help
Usage: calm init-ai [options]

Augment a git repository with AI assistance for CALM

Options:
  -p, --provider <provider>  AI provider to initialize (choices: "copilot", "kiro", "claude", "codex")
  -d, --directory <path>     Target directory (defaults to current directory) (default: ".")
  -v, --verbose              Enable verbose logging. (default: false)
  -h, --help                 display help for command
```

This command creates a custom chat prompt configuration for the specified <provider> that provides AI assistance with specialized knowledge about CALM architecture modeling, including:

- **Schema-accurate guidance**: Complete JSON schema definitions for all CALM components
- **Critical validation requirements**: Emphasis on oneOf constraints and other validation rules
- **Best practice enforcement**: Naming conventions, relationship patterns, and proper structure
- **Comprehensive examples**: Realistic architecture examples based on actual CALM patterns
- **Tool specialization**: Separate tools for nodes, relationships, interfaces, controls, flows, patterns, and metadata

### Setting up CALM AI assistance

To set up AI assistance for your CALM project:

```shell
# In your project directory
calm init-ai -p <provider>

# Or specify a different directory
calm init-ai -p <provider> --directory /path/to/your/calm-project
```

This will create the necessary assistant-specific configuration files to enable CALM-specific AI assistance. Once set up, your selected assistant can use specialized CALM tools that understand schema requirements, validation rules, and best practices. For Codex, this creates a CALM skill under `.agents/skills/calm` and does not create or modify root `AGENTS.md`.

### Tool Prompts

The agent includes specialized tools for each CALM component:

- **Node Creation**: Guide for creating nodes with proper validation and interface definitions
- **Relationship Creation**: Guide for creating relationships with correct types and constraints
- **Interface Creation**: Critical guidance for interface oneOf constraints and schema compliance
- **Control Creation**: Guide for security controls, requirements, and configurations
- **Flow Creation**: Guide for business process flows and transitions
- **Pattern Creation**: Guide for reusable architectural patterns using JSON schema constructs
- **Metadata Creation**: Guide for metadata structure options (single object vs. array)
- **Standards Creation**: Guide for creating JSON Schema 2020-12 Standards that extend CALM components with organizational requirements

Each tool includes complete schema definitions, validation rules, realistic examples, and cross-references to related tools.



## CALM Template

The CALM Template system allows users to generate different machine or human-readable outputs from a CALM model by providing a **template bundle**.

```shell
calm template --help
Usage: calm template [options]

Generate files from a CALM model using a Handlebars template bundle.

Options:
  -a, --architecture <path>               Path to the CALM model JSON file.
  -o, --output <path>                     Path to output directory.
      --clear-output-directory            Completely delete the contents of the output path before generation.
  -b, --bundle <path>                     Path to the template bundle directory.
  -t, --template <path>                   Path to a single .hbs or .md template file
  -d, --template-dir <path>               Path to a directory of .hbs/.md templates
  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
  -v, --verbose                           Enable verbose logging. (default: false)
  -h, --help                              display help for command
```

`calm template` will create the output directory if it does not exist.

If the output directory exists, files will be modified if they already
exist. Files that are not in the template bundle will be unmodified.
The `--clear-output-directory` option changes this behaviour to delete all
files and subdirectories from the output path first.

### Creating a Template Bundle

A template bundle consists of:

- `index.json`: Defines the structure of the template and how it maps to CALM model elements.
- A **CalmTemplateTransformer** implementation: Transforms the CALM model into a format that can be rendered by Handlebars.
- Handlebar templates define the final output format.
- The `--url-to-local-file-mapping` option allows you to provide a JSON file that maps external URLs to local files.  
   This is useful when working with files that are not yet published but are referenced in the model.

    Example content

            ```json
            {
                "https://calm.finos.org/docuflow/flow/document-upload": "flows/flow-document-upload.json"
            }
            ```

    Sample usage would be as follows (assuming at root of project)

```shell
calm template -a ./cli/test_fixtures/template/model/document-system.json   -b cli/test_fixtures/template/template-bundles/doc-system   -o one_pager   -u cli/test_fixtures/template/model/url-to-file-directory.json -v
```

## CALM Docify

The **CALM Docify** command generates documentation from a CALM model.

```shell
calm docify --help
Usage: calm docify [options]

Generate a documentation website off your CALM model.

Options:
  -a, --architecture <path>               Path to the CALM model JSON file.
  -o, --output <path>                     Path to output directory.
      --clear-output-directory            Completely delete the contents of the output path before generation.
      --scaffold                          Generate scaffold only (templates with placeholders, no rendering).
  -t, --template <path>                   Path to a single .hbs or .md template file
  -d, --template-dir <path>               Path to a directory of .hbs/.md templates
  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
      --export-diagrams <svg|png>         Render mermaid diagrams to image files using a local Chromium-based browser (adds roughly 10-40s depending on diagram count).
      --browser-path <path>               Path to a Chromium-based browser executable, only needed if automatic detection fails.
      --diagram-render-timeout <ms>       Per-diagram render timeout in milliseconds, only used with --export-diagrams (default: 30000).
  -v, --verbose                           Enable verbose logging. (default: false)
  -h, --help                              display help for command
```

`calm docify` will create the output directory if it does not exist.

If the output directory exists, files will be modified if they already
exist. Other files will be unmodified.
The `--clear-output-directory` option changes this behaviour to delete all
files and subdirectories from the output path first.

### Two-Stage Workflow (Scaffold Mode)

Scaffold mode enables a two-stage documentation workflow where you can review and edit generated templates before final rendering:

```shell
# Stage 1: Generate scaffold with widget placeholders
calm docify --scaffold -a ./architecture.json -o ./website

# Edit generated MDX files in ./website/docs/ as needed

# Stage 2: Render final website from scaffolded templates
calm docify -a ./architecture.json --template-dir ./website -o ./final-site
```

This allows architects to customize the documentation before deployment, ensuring that what's previewed in the VSCode extension matches the final output.

### Single-Stage Workflow

Sample usage for you to try is as follows (assuming at root of project)

```shell
calm docify -a ./cli/test_fixtures/template/model/document-system.json -o ./output/documentation -u ./cli/test_fixtures/template/model/url-to-file-directory.json
```

### Exporting Diagrams as Images

By default, generated documentation contains Mermaid diagrams as ` ```mermaid ` code
blocks. The `--export-diagrams <svg|png>` option renders these diagrams to image
files using a local Chromium-based browser, replacing each code block with a
centered image reference (e.g. `<p align="center"><img src="_diagrams/my-page-1.svg" alt="Diagram 1" /></p>`).

```shell
calm docify -a ./architecture.json -o ./output/documentation --export-diagrams svg
```

This requires Google Chrome or Microsoft Edge to be installed locally (both are
detected automatically). If neither is found, the command prints guidance for
locating another Chromium-based browser, and the documentation is still generated
with the Mermaid code blocks left as-is.

- `--browser-path <path>`: use a specific Chromium-based browser (e.g. Brave,
  Vivaldi, Chromium) instead of relying on automatic detection.
- `--diagram-render-timeout <ms>`: per-diagram render timeout, useful for very
  large or complex diagrams (default: `30000`).

Rendering adds roughly 10-40 seconds to the command depending on the number of
diagrams. If an individual diagram fails to render (e.g. a timeout or invalid
syntax), it is left as a Mermaid code block and a warning is logged — the rest of
the documentation is unaffected.

### Default options for widgets in templates

Frontmatter can be used in templates to provide default options for any widgets used:

```
---
widget-options:
  block-architecture:
    render-node-type-shapes: true
---
These two are the same:
{{ block-architecture }}
and
{{ block-architecture render-node-type-shapes=true }}

This differs:
{{ block-architecture render-node-type-shapes=false }}
```

## Authentication plugins

The CLI supports an external authentication plugin to allow authentication to CalmHub in enterprise environments, where seamless auth will likely require specific logic.

### Writing an authentication plugin

Authentication plugins are JavaScript files. You can find an example in [the test fixtures](./test_fixtures/test-auth-plugin.js).

Plugins must export a default class implementing the [`AuthPlugin`](../shared/src/auth/auth-plugin.ts) interface, i.e. a `getAuthHeaders(url, requestBody)` method that returns a `Promise<Record<string, string>>`.

The function `getAuthHeaders` will be invoked with the request URL and body for every request made to CalmHub by the CLI.

### Using an authentication plugin

To configure your CLI to use an auth plugin, use `~/.calm.json` in the same fashion as configuring a CalmHub URL:

```
{
  "calmHubUrl": "http://calmhub.com",
  "authPluginPath": "~/plugins/auth-plugin.js"
}
```

## CALM Workspace

The `calm workspace` commands give you a local development environment for working with a set of CALM documents. A workspace tracks which documents you care about, keeps copies (or references) of those files in a single bundle directory, and can sync them to a CalmHub instance.

### Concepts

**Workspace** — a named collection of CALM documents living inside a git repository. Metadata lives under `.calm-workspace/` at the repository root; the active workspace is recorded in `.calm-workspace/workspace.json`.

**Bundle** — the on-disk directory for a workspace (`<repo-root>/.calm-workspace/bundles/<name>/`). It contains:
- `workspace-manifest.json` — an index of every tracked document, keyed by document ID, with each entry recording its file path, document type, and (optionally) its CalmHub namespace.
- `files/` — documents copied into the bundle (when `--copy` is used). Referenced documents are stored at their original location.

**Document ID** — the key used to identify a document within a workspace. Resolved in order: `--id` flag → `title` field in the JSON → user prompt.

### Commands

#### `calm workspace init <name>`

Create or update a workspace. Creates the bundle directory and sets it as the active workspace.

```
calm workspace init <name> [--dir <path>]
```

| Option | Description |
|--------|-------------|
| `--dir <path>` | Directory in which to create the workspace. Defaults to the repository root (detected via git). |

```shell
calm workspace init my-system
# Workspace 'my-system' created/updated at .calm-workspace
# Bundle directory ensured at .calm-workspace/bundles/my-system
```

#### `calm workspace add <file>`

Register a CALM document with the active workspace. By default the file is referenced at its current location on disk (no copying). Prompts interactively for document type and (manifest) name if they cannot be determined automatically.

```
calm workspace add <file> [--id <id>] [--type <type>] [--namespace <namespace>] [--copy]
```

| Option | Description |
|--------|-------------|
| `--id <id>` | Explicit manifest registration id. Overrides automatic resolution. |
| `--type <type>` | Document type. If omitted, an interactive dropdown is shown. One of: `architecture`, `pattern`, `schema`, `interface`, `timeline`. |
| `--namespace <namespace>` | CalmHub namespace to record in the manifest. If omitted, it is derived from the document `$id`. |
| `--copy` | Copy the file into the bundle's `files/` directory instead of referencing it in place. |

**Document `$id` handling.** `add` inspects the file's CalmHub `$id`:
- **No `$id`** → you are prompted interactively to build one from its components (see below); the `$id` is written into the file and the document is added.
- **Conformant `$id`** → left untouched; the manifest namespace is derived from it.
- **Non-conformant `$id`** → you are prompted to rebuild it, the corrected `$id` is written back, and the command **fails** (non-zero exit) so the change is surfaced before you re-run `add`.

**Manifest name resolution** (when `--id` is not given): the `title` field from the JSON file, else an interactive prompt.

```shell
# Interactive — prompts for type, builds the $id if needed, then the manifest name
calm workspace add ./architectures/payment-service.json

# Reference an already-conformant document without copying
calm workspace add ./architectures/payment-service.json --type architecture
```

#### `calm workspace new [type] [name] [template]`

Create a new stub CALM document in the current directory, then register it with the active workspace. The document's CalmHub `$id` is **always built interactively**. Any other argument not provided on the command line is requested interactively.

```
calm workspace new [type] [name] [template]
```

The created file is named `<slug>.<type>.json` (where `<slug>` is the mapping id, or the control/config name) and contains a minimal document whose `$id` is the one you built and whose `title` is the name you provide. The namespace (for namespace resources) is stored in the manifest so the document can be pushed to CalmHub without extra flags.

```shell
# Fully interactive
calm workspace new

# Provide the type and title up front; still prompts for the $id components
calm workspace new architecture "Payment Gateway"
```

#### Building a CalmHub `$id` interactively

When `new` (always) or `add` (when needed) builds a `$id`, it asks for the resource scope and then each component, defaulting the **version to `1.0.0`** and the **base URL to your configured CalmHub URL** (`calmHubUrl` in `~/.calm.json`). The result is one of:

```
namespace resource:    $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING/versions/$VERSION
control requirement:   $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/requirement/versions/$VERSION
control configuration: $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/configurations/$CONFIG/versions/$VERSION
```

where `$TYPE` is one of `patterns`, `architectures`, `standards`, `interfaces`.

#### `calm workspace push`

Push every document in the workspace manifest to a CalmHub instance. Each document's identity — namespace, type, mapping id and **version** — comes from its `$id` (of the form `$BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION`). Push **does not auto-bump**: it creates exactly the version each document declares. Documents without a well-formed mapping `$id` (or whose type has no CalmHub resource type) are skipped with a warning.

```
calm workspace push [--calm-hub-url <url>] [--fail-if-modified]
```

| Option | Description |
|--------|-------------|
| `--calm-hub-url <url>` | CalmHub base URL. If omitted, falls back to `calmHubUrl` in `~/.calm.json`. |
| `--fail-if-modified` | Fail the push if a document that already exists in CalmHub at its declared version has changed on disk. Overrides `push.failIfModified` in the workspace config. |

For each tracked document, push looks up the existing versions in CalmHub:
- **Version does not exist** → creates it.
- **Version already exists, content unchanged** → skips it (idempotent; good for local re-runs).
- **Version already exists, content changed on disk** → behaviour depends on `push.failIfModified` (default `false`):
  - `false` — logs and skips.
  - `true` — reports the conflict and fails the push (strict; good for merge-time CI). Run `bump` first to create a new version.

```shell
calm workspace push                              # URL from ~/.calm.json
calm workspace push --calm-hub-url https://calmhub.example.com
calm workspace push --fail-if-modified           # strict merge-time mode
```

#### `calm workspace check`

Check whether any tracked document has changed on disk relative to CalmHub but has **not** been version-bumped. Intended as a CI/PR gate — it **exits non-zero** when a bump is required, so a PR cannot merge with unversioned changes.

```
calm workspace check [--calm-hub-url <url>]
```

A document is flagged when its on-disk `$id` version still matches a version in CalmHub but its content differs. Brand-new documents (not yet in CalmHub) and already-bumped documents (whose version is ahead of CalmHub) are not flagged.

#### `calm workspace bump`

Bump the version of every document that has changed on disk relative to CalmHub, and update every reference to those documents across the workspace so everything stays in sync.

```
calm workspace bump [--calm-hub-url <url>] [--major | --patch]
```

| Option | Description |
|--------|-------------|
| `--calm-hub-url <url>` | CalmHub base URL. If omitted, falls back to `calmHubUrl` in `~/.calm.json`. |
| `--major` | Apply a major bump (e.g. `1.2.3` → `2.0.0`). |
| `--patch` | Apply a patch bump (e.g. `1.2.3` → `1.2.4`). |

By default a **minor** bump is applied (override the default via `bump.defaultIncrement` in the workspace config, or per-run with `--major`/`--patch`). For each changed document the new version is computed relative to CalmHub's latest version, the file's `$id` is rewritten, and any `$ref` / `$schema` / `requirement-url` / `config-url` in **all** tracked documents that pointed at the old version is repointed to the new one (fragments preserved).

Bump is **idempotent**: editing → bumping → editing again → bumping again only moves the version by a single increment, because once a document's on-disk version is ahead of CalmHub it is left alone until that version is pushed.

#### Workspace config — `.calm-workspace/config.json`

Central, committed configuration that applies to every workspace in the repository (visible to CI):

```json
{
  "push": { "failIfModified": false },
  "bump": { "defaultIncrement": "MINOR" }
}
```

| Field | Values | Default | Meaning |
|-------|--------|---------|---------|
| `push.failIfModified` | `true` \| `false` | `false` | When `true`, `push` fails if a document already published at its declared version has changed on disk. Set `true` for strict merge-time pushes. |
| `bump.defaultIncrement` | `MAJOR` \| `MINOR` \| `PATCH` | `MINOR` | Default increment for `bump` when no flag is given. |

A typical CI workflow: `calm workspace check` gates PRs (contributors run `calm workspace bump` to record an intentional version bump), and merge-time runs `calm workspace push` with `push.failIfModified: true` so a merge introduces exactly the new versions it claims.

#### `calm workspace tree`

Print the dependency tree of documents in the active workspace, showing how documents reference one another.

```
calm workspace tree
```

```
payment-service (architecture)
├── payment-pattern (pattern)
│   └── https://calm.finos.org/draft/2025-03/meta/core.json (schema)
└── https://calm.finos.org/draft/2025-03/meta/interface.json (schema)
```

#### `calm workspace list`

List all workspaces in the current repository. The active workspace is marked with `*`.

```
calm workspace list
```

```
* my-system
  legacy-platform
  experimental
```

#### `calm workspace show`

Print the name of the currently active workspace.

```
calm workspace show
```

#### `calm workspace switch <name>`

Switch the active workspace.

```
calm workspace switch <name>
```

```shell
calm workspace switch legacy-platform
# Switched to workspace 'legacy-platform'.
```

#### `calm workspace clean`

Remove downloaded files from a workspace bundle and reset its manifest. The bundle directory itself is preserved.

```
calm workspace clean [--all]
```

| Option | Description |
|--------|-------------|
| `--all` | Clean all workspaces and reset `workspace.json`. |

```shell
# Clean the active workspace
calm workspace clean

# Clean everything
calm workspace clean --all
```

### Example workflow

Below is an end-to-end example: creating a workspace, adding documents, pulling in dependencies, and syncing to CalmHub.

```shell
# 1. Initialise a workspace in the current git repo
calm workspace init payments

# 2. Create a new architecture stub — builds the $id interactively, prompts for title
calm workspace new architecture "Payment Gateway"

# 3. After editing the stub, add an existing pattern you depend on
#    (prompts to build a $id if the file doesn't already have a conformant one)
calm workspace add ./patterns/microservice-pattern.json --type pattern

# 4. Inspect the resulting dependency graph
calm workspace tree

# 5. Push everything to CalmHub (namespace comes from each file's manifest entry)
calm workspace push --calm-hub-url https://calmhub.example.com
```

If you work across multiple concerns in the same repo, you can maintain separate workspaces:

```shell
calm workspace init platform
calm workspace switch platform
calm workspace add ./platform/infra.json --type architecture --namespace com.example
calm workspace push

calm workspace switch payments   # back to the original
```

### CalmHub integration

To avoid passing `--calm-hub-url` every time, add the URL to `~/.calm.json`:

```json
{
  "calmHubUrl": "https://calmhub.example.com"
}
```

For `push` to work, each document must have a namespace recorded in the manifest. This is set automatically by `new`. For files added with `add`, pass `--namespace <ns>` at add time. Any file without a namespace is skipped during push with a message explaining how to fix it.
