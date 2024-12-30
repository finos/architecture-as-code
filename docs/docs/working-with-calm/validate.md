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
- **`-f, --format <format>`**: The format of the output (choices: "json", "junit", default: "json").
- **`-v, --verbose`**: Enable verbose logging to see detailed validation output.

## Example of Validation

Here is an example command that validates an architecture against a pattern and outputs the results in JSON format:

```shell
calm validate -p calm/pattern/api-pattern.json -a my-architecture.json -f json
```

This command will check if `my-architecture.json` conforms to the `api-pattern.json` and display any validation errors or warnings.
