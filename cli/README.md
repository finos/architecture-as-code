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