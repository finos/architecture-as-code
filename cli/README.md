# CALM CLI

A command line interface to interact with the CALM schema.
You can use these tools to create an architecture from a CALM pattern, or validate that an architecture conforms to a given pattern.

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
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

The most simple way to use this command is to call it with only the pattern option, which will generate an architecture with the default filename `architecture.json` in the current working directory.

```shell
% calm generate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json
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

Register a CALM document with the active workspace. By default the file is referenced at its current location on disk (no copying). Prompts interactively for document type and name if they cannot be determined automatically.

```
calm workspace add <file> [--id <id>] [--type <type>] [--namespace <namespace>] [--copy]
```

| Option | Description |
|--------|-------------|
| `--id <id>` | Explicit document ID. Overrides all automatic resolution. |
| `--type <type>` | Document type. If omitted, an interactive dropdown is shown. One of: `architecture`, `pattern`, `schema`, `interface`, `timeline`. |
| `--namespace <namespace>` | CalmHub namespace to associate with this file (used by `push`). |
| `--copy` | Copy the file into the bundle's `files/` directory instead of referencing it in place. |

**Name resolution** (when `--id` is not given):
1. The `title` field from the JSON file, if present.
2. Interactive prompt.

```shell
# Interactive — prompts for type and name
calm workspace add ./architectures/payment-service.json

# Fully specified
calm workspace add ./architectures/payment-service.json \
  --type architecture \
  --namespace com.example \
  --copy
```

#### `calm workspace new [type] [namespace] [name]`

Create a new stub CALM document in the current directory, then register it with the active workspace. Any argument not provided on the command line is requested interactively.

TODO: instantiate a starter document from a simple template.

```
calm workspace new [type] [namespace] [name]
```

The created file is named `<namespace>-<type>-<name>.json` and contains a minimal document with `$id` and `version` fields. The namespace is stored in the manifest so the document can be pushed to CalmHub without extra flags.

```shell
# Fully interactive
calm workspace new

# Partially specified
calm workspace new architecture com.example payment-gateway
```

#### `calm workspace populate`

Scan every document currently in the workspace for external references (`$ref`, `$schema`, `requirement-url`, `config-url`) and fetch any HTTP(S) URLs that are not already tracked, adding them to the bundle.

```
calm workspace populate [--verbose]
```

Useful after adding an architecture that references remote patterns or schemas you also want available locally.

```shell
calm workspace populate --verbose
```

#### `calm workspace push`

Push every document in the workspace manifest to a CalmHub instance, creating or updating resources as needed. Only files that have a namespace recorded in the manifest are pushed; others are skipped with a warning.

NOTE: Currently this pushes every document that's been changed; if you want to lock a file that is currently not supported. 

```
calm workspace push [--calm-hub-url <url>]
```

| Option | Description |
|--------|-------------|
| `--calm-hub-url <url>` | CalmHub base URL. If omitted, falls back to `calmHubUrl` in `~/.calm.json`. |

For each tracked document:
- **Not found on CalmHub** → creates a new resource.
- **Found, content differs** → pushes a new minor version.
- **Found, content identical** → skipped.

Content comparison ignores whitespace by minifying both the local and remote JSON before diffing.

```shell
# Using URL from ~/.calm.json
calm workspace push

# Overriding the URL
calm workspace push --calm-hub-url https://calmhub.example.com
```

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

# 2. Create a new architecture stub — prompts for type/namespace/name if omitted
calm workspace new architecture com.example payment-gateway

# 3. After editing payment-gateway.json, add an existing pattern you depend on
calm workspace add ./patterns/microservice-pattern.json \
  --type pattern \
  --namespace com.example

# 4. Fetch all remote schemas and patterns referenced inside tracked documents
calm workspace populate

# 5. Inspect the resulting dependency graph
calm workspace tree

# 6. Push everything to CalmHub (namespace comes from each file's manifest entry)
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
