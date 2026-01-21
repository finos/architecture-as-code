---
id: generate
title: Generate
sidebar_position: 4
---

# Generate

The `generate` command allows you to create an architecture of an architecture from a predefined CALM pattern. This command helps you quickly set up the structure of your architecture using reusable patterns, which can then be customized to fit your specific needs.

## Basic Usage

To generate an architecture, you will need a pattern file that defines the architecture template. You can use the `generate` command with the `--pattern` option to specify the path to the pattern file:

```shell
calm generate -p calm/pattern/api-gateway.json
```

This will create an architecture in the current working directory with the default filename `architecture.json`.

## Command Options

- **`-p, --pattern <source>`**: Path to the pattern file to use. This can be a file path or a URL.
- **`-o, --output <output>`**: Path to the location where the generated file will be saved (default is `architecture.json`).
- **`-s, --schema-directory <path>`**: Path to the directory containing schemas to use in architecture.
- **`-c, --calm-hub-url <url>`**: URL to CALMHub instance.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL Mapping](#url-to-local-file-mapping) below).
- **`-v, --verbose`**: Enable verbose logging.

## Example of Generating an architecture

Here is an example command that generates an architecture from a CALM pattern file and saves it with a custom filename:

```shell
calm generate -p calm/pattern/microservices.json -o my-architecture.json
```

This command uses the `microservices.json` pattern and outputs the result to `my-architecture.json`.

## URL to Local File Mapping

When developing patterns locally, you may want to reference Standards or other schemas via canonical URLs (e.g., `https://example.com/standards/node-standard.json`) while the actual files exist on your local filesystem. The `-u, --url-to-local-file-mapping` option allows you to map these URLs to local paths.

### Mapping File Format

Create a JSON file that maps URLs to relative file paths:

```json
{
  "https://example.com/standards/node-standard.json": "standards/node-standard.json",
  "https://example.com/standards/relationship-standard.json": "standards/relationship-standard.json"
}
```

Paths in the mapping file are resolved relative to the mapping file's location.

### Example Usage

```shell
calm generate -p pattern.json -o architecture.json -u url-mapping.json
```

### Relative Path Resolution

For patterns that don't have an `$id` field, the CLI automatically resolves relative `$ref` paths against the pattern file's directory. For example, if your pattern is at `patterns/my-pattern.json` and contains:

```json
{
  "$ref": "standards/my-standard.json"
}
```

The CLI will look for the standard at `patterns/standards/my-standard.json`.
