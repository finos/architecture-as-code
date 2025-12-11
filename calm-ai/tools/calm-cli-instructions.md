# CALM CLI Instructions

The CALM CLI provides command-line utilities for working with Common Architecture Language Model (CALM) files. This guide summarizes the primary commands and their usage.

## Installation and Help

Install globally via npm:

```shell
npm install -g @finos/calm-cli
```

Run `calm` with no arguments to see the top-level help:

```shell
calm
```

This displays available commands such as `generate`, `validate`, `copilot-chatmode`, `server`, `template`, and `docify`.

## Generate Architectures from Patterns

Create an architecture scaffold from a CALM pattern:

```shell
calm generate -p <pattern-file> [-o <output-file>] [--schema-directory <path>] [--url-to-local-file-mapping <json>] [--verbose]
```

- `-p, --pattern`: Path or URL to the pattern file (required).
- `-o, --output`: Where to write the generated architecture (defaults to `architecture.json`).
- `-s, --schema-directory`: Location of CALM meta schemas (defaults to `../calm/release`).
- `-c, --calm-hub-url`: URL to CALMHub instance for loading remote documents.
- `-u, --url-to-local-file-mapping`: Path to JSON file mapping URLs to local paths (see [URL Mapping](#using---url-to-local-file-mapping)).
- `-v, --verbose`: Enables verbose logging.

Example:

```shell
calm generate -p calm/pattern/api-gateway.json
```

## Validate Architectures and Patterns

Validate CALM architectures and/or patterns. At least one of `-p` (pattern) or `-a` (architecture) must be provided.

```shell
calm validate [-p <pattern-file>] [-a <architecture-file>] [-s <schema-directory>] [-c <calm-hub-url>] [--strict] [-f <format>] [-o <output>] [-v]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --pattern <file>` | Path or URL to the pattern file |
| `-a, --architecture <file>` | Path or URL to the architecture file |
| `-s, --schema-directory <path>` | Path to directory containing meta schemas |
| `-c, --calm-hub-url <url>` | URL to CALMHub instance for loading remote documents |
| `-u, --url-to-local-file-mapping <path>` | Path to JSON file mapping URLs to local paths (see [URL Mapping](#using---url-to-local-file-mapping)) |
| `--strict` | Treat warnings as failures (exit non-zero) |
| `-f, --format <format>` | Output format: `json` (default), `junit`, or `pretty` |
| `-o, --output <file>` | Write validation output to a file |
| `-v, --verbose` | Enable verbose logging |

### Validation Modes

The validate command operates in three modes depending on which flags are provided:

#### 1. Architecture Only (`-a`)

```shell
calm validate -a my-system.architecture.json
```

Validates the architecture file. If the architecture contains a `$schema` property pointing to a pattern, it will automatically load and validate against that pattern. Otherwise, runs Spectral rules on the architecture structure only.

#### 2. Pattern Only (`-p`)

```shell
calm validate -p my-pattern.json
```

Validates the pattern file by running Spectral rules and compiling it as a JSON schema to verify it is well-formed. Does not validate any architecture.

#### 3. Both Architecture and Pattern (`-a` and `-p`)

```shell
calm validate -p my-pattern.json -a my-system.architecture.json
```

Full validation mode. Runs Spectral rules on both files, then validates the architecture against the pattern as a JSON schema. This is the most comprehensive validation.

### Understanding Output

Validation produces two types of results:

- **`jsonSchemaValidationOutputs`**: Errors from validating architecture against pattern schema
- **`spectralSchemaValidationOutputs`**: Warnings/errors from Spectral linting rules

The command exits with code 1 if errors are found. Warnings do not cause failure unless `--strict` is used.

### Examples

```shell
# Validate architecture against its embedded $schema reference
calm validate -a trading-system.architecture.json

# Validate a pattern is well-formed
calm validate -p api-gateway.pattern.json

# Full validation with explicit pattern
calm validate -p api-gateway.pattern.json -a trading-system.architecture.json

# Strict mode with pretty output
calm validate -a my-arch.json --strict -f pretty

# Output to file in JUnit format (useful for CI)
calm validate -p pattern.json -a arch.json -f junit -o results.xml
```

## Copilot Chatmode Setup

Configure CALM-specific AI assistance inside a repo:

```shell
calm copilot-chatmode [--directory <path>] [--verbose]
```

This generates `.github/chatmodes/CALM.chatmode.md`, enabling GitHub Copilot Chat to use CALM-aware tools (nodes, relationships, interfaces, controls, flows, patterns, metadata).

## CLI Server (Experimental)

Expose CLI functionality over HTTP:

```shell
calm server --schema-directory <path>
```

Endpoints (default `http://127.0.0.1:3000`):

- `GET /health` for health checks
- `POST /calm/validate` with a CALM model payload to validate

## Template Command

Generate arbitrary files from CALM models using Handlebars bundles:

```shell
calm template -a <architecture> -o <output> [--bundle <path> | --template <file> | --template-dir <dir>] [--url-to-local-file-mapping <json>] [--clear-output-directory] [--verbose]
```

Useful for producing documentation, reports, or configs. Template bundles require an `index.json`, transformer implementation, and templates.

## Docify Command

Generate a documentation website from a CALM model:

```shell
calm docify -a <architecture> -o <output> [--template <file>] [--template-dir <dir>] [--url-to-local-file-mapping <json>] [--clear-output-directory] [--verbose]
```

Creates a browsable site that visualizes nodes, relationships, interfaces, and metadata.

### Using `--url-to-local-file-mapping`

The `validate`, `generate`, `docify`, and `template` commands support URL-to-local-file mapping. This resolves schema references or linked assets (Standards, flows, controls, ADRs) by replacing remote URLs with local paths during execution.

This is especially useful when:

- Patterns reference Standards via canonical URLs that aren't published yet
- Referenced resources live in the same repo but are not public yet
- You need reproducible offline builds in CI
- Documentation reviewers shouldn't depend on internal endpoints

**Mapping file format (JSON object):**

```json
{
    "https://example.com/standards/node-standard.json": "standards/node-standard.json",
    "https://calm.finos.org/docuflow/flow/document-upload": "flows/flow-document-upload.json"
}
```

Paths are resolved relative to the mapping file's location.

**Usage examples:**

```shell
# Validate a pattern that references Standards via URLs
calm validate -p pattern.json -a architecture.json -u url-mapping.json

# Generate architecture from a pattern with URL references
calm generate -p pattern.json -o arch.json -u url-mapping.json

# Docify with URL mapping
calm docify -a architecture.json -o docs/ --url-to-local-file-mapping url-mapping.json
```

**Relative path resolution:** For patterns without an `$id` field, the CLI automatically resolves relative `$ref` paths against the pattern file's directory. No mapping file is needed for relative references.

## Tips

- Keep schema files accessible via `--schema-directory` for offline use.
- Use `calm generate` + `calm validate` workflow to quickly iterate on architectures.
- Leverage warnings to replace placeholder values before production.
- Combine `calm copilot-chatmode` with VS Code for CALM-aware AI assistance.
