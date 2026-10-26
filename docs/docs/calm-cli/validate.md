---
id: validate
title: Validating Architectures
sidebar_label: validate
---

# Validating Architectures

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
- **`    --timeline <timeline>`**: Path to the timeline file to validate.
- **`-s, --schema-directory <path>`**: Path to the directory containing the meta schemas to use.
- **`-c, --calm-hub-url <url>`**: URL to CALMHub instance.
- **`--assets-path <path>`**: Local path to a CALM assets directory. Resolves `detailed-architecture` CURIEs from the filesystem without a Hub.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL to Local File Mapping](#url-to-local-file-mapping-validate) below).
- **`--strict`**: When enabled, the CLI will fail if any warnings are reported (default: false).
- **`-f, --format <format>`**: The format of the output (choices: "json", "junit", "pretty", default: "json").
- **`-o, --output <file>`**: Path location at which to output the validation results.
- **`-v, --verbose`**: Enable verbose logging to see detailed validation output.

## Example of Architecture Validation

Here is an example command that validates an architecture against a pattern and outputs the results in JSON format:

```shell
calm validate -p calm/pattern/api-pattern.json -a my-architecture.json -f json
```

This command will check if `my-architecture.json` conforms to the `api-pattern.json` and display any validation errors or warnings.

## Example of Timeline Validation

Here is an example command that validates a timeline and outputs the results in JSON format:

```shell
calm validate --timeline calm/architecture/calm.timeline.json -f json
```

This command will check if `calm.timeline.json` conforms to the timeline schema and display any validation errors or warnings.

## URL to Local File Mapping (Validate)

Refer to the [URL to Local File Mapping](generate.md#url-to-local-file-mapping) instructions for `calm generate`. The mapping behavior is identical.

## Validation Server

The separate `@finos/calm-server` package provides a network accessible [validation server](../working-with-calm/validation-server.md).
