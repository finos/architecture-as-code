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
calm generate -p <pattern-file> [-o <output-file>] [--schema-directory <path>] [--verbose]
```

- `-p, --pattern`: Path or URL to the pattern file (required).
- `-o, --output`: Where to write the generated architecture (defaults to `architecture.json`).
- `-s, --schema-directory`: Location of CALM meta schemas (defaults to `../calm/release`).
- `-v, --verbose`: Enables verbose logging.

Example:

```shell
calm generate -p calm/pattern/api-gateway.json
```

## Validate Architectures

Validate that an architecture conforms to a pattern:

```shell
calm validate -p <pattern-file> -a <architecture-file> [--schema-directory <path>] [--strict] [--format <format>] [-o <output>] [--verbose]
```

- `-p, --pattern`: Path or URL to the pattern (required).
- `-a, --architecture`: Path or URL to the architecture (required).
- `--strict`: Treat warnings as failures.
- `-f, --format`: Output format (`json` or `junit`).
- `-o, --output`: Write the validation output to a file.
- `-v, --verbose`: Verbose logging.

Warnings highlight potential issues (like placeholder values) but only errors cause a non-zero exit unless `--strict` is used.

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

`docify` resolves schema references or linked assets (flows, controls, ADRs) by default via HTTP(S). If your architecture references resources that are not yet published, provide a mapping file so Docify can replace remote URLs with local paths during generation.

**Mapping file format (JSON object):**

```json
{
    "https://calm.finos.org/docuflow/flow/document-upload": "flows/flow-document-upload.json",
    "https://internal-policy.example.com/security/tls": "docs/policies/tls.json"
}
```

**Usage example:**

```shell
calm docify \
    -a architectures/ecommerce-platform.json \
    -o docs/ecommerce \
    --url-to-local-file-mapping docs/url-map.json
```

During generation, each referenced URL is swapped with the corresponding local file path so Docify can inline the referenced content without network access. This is especially helpful when:

- Referenced resources live in the same repo but are not public yet
- You need reproducible offline builds in CI
- Documentation reviewers shouldn’t depend on internal endpoints

## Tips

- Keep schema files accessible via `--schema-directory` for offline use.
- Use `calm generate` + `calm validate` workflow to quickly iterate on architectures.
- Leverage warnings to replace placeholder values before production.
- Combine `calm copilot-chatmode` with VS Code for CALM-aware AI assistance.
