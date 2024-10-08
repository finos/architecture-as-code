---
id: validate
title: Validate
sidebar_position: 5
---

# Validate

The `validate` command is used to check if an instantiation conforms to a given CALM pattern. Validation helps ensure that your architecture adheres to best practices and meets the required standards.

## Basic Usage

To validate an instantiation against a pattern, use the `validate` command with the `--pattern` and `--instantiation` options:

```shell
calm validate -p calm/pattern/api-pattern.json -i instantiation.json
```

If the instantiation does not match the pattern, the command will output a list of errors and warnings that need to be addressed.

## Command Options

- **`-p, --pattern <pattern>`**: Path to the pattern file. This can be a local file path or a URL.
- **`-i, --instantiation <instantiation>`**: Path to the instantiation file to validate.
- **`-f, --format <format>`**: The format of the output (choices: "json", "junit", default: "json").
- **`-v, --verbose`**: Enable verbose logging to see detailed validation output.

## Example of Validation

Here is an example command that validates an instantiation against a pattern and outputs the results in JSON format:

```shell
calm validate -p calm/pattern/api-pattern.json -i my-architecture.json -f json
```

This command will check if `my-architecture.json` conforms to the `api-pattern.json` and display any validation errors or warnings.
