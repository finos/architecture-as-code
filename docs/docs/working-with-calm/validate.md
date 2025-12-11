---
id: validate
title: Validate
sidebar_position: 5
---

# Validate

The `validate` command is used to check if an architecture conforms to a given CALM pattern. Validation helps ensure that your architecture adheres to best practices and meets the required standards.

## Basic Usage

To validate an architecture against a pattern, use the `validate` command with the `--pattern` and `--architecture` options:

```shell
calm validate -p calm/pattern/api-pattern.json -a architecture.json
```

If the architecture does not match the pattern, the command will output a list of errors and warnings that need to be addressed.

## Command Options

- **`-p, --pattern <pattern>`**: Path to the pattern file. This can be a local file path or a URL.
- **`-a, --architecture <architecture>`**: Path to the architecture file to validate.
- **`-s, --schema-directory <path>`**: Path to the directory containing the meta schemas to use.
- **`-c, --calm-hub-url <url>`**: URL to CALMHub instance.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL Mapping](#url-to-local-file-mapping) below).
- **`--strict`**: When enabled, the CLI will fail if any warnings are reported (default: false).
- **`-f, --format <format>`**: The format of the output (choices: "json", "junit", "pretty", default: "json").
- **`-o, --output <file>`**: Path location at which to output the validation results.
- **`-v, --verbose`**: Enable verbose logging to see detailed validation output.

## Example of Validation

Here is an example command that validates an architecture against a pattern and outputs the results in JSON format:

```shell
calm validate -p calm/pattern/api-pattern.json -a my-architecture.json -f json
```

This command will check if `my-architecture.json` conforms to the `api-pattern.json` and display any validation errors or warnings.

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
calm validate -p pattern.json -a architecture.json -u url-mapping.json
```

### Relative Path Resolution

For patterns that don't have an `$id` field, the CLI automatically resolves relative `$ref` paths against the pattern file's directory. For example, if your pattern is at `patterns/my-pattern.json` and contains:

```json
{
  "$ref": "standards/my-standard.json"
}
```

The CLI will look for the standard at `patterns/standards/my-standard.json`.
