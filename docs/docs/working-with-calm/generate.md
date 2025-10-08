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
- **`-g, --generateAll`**: Generates all properties, ignoring the "required" field (default: false).

## Example of Generating an architecture

Here is an example command that generates an architecture from a CALM pattern file and saves it with a custom filename:

```shell
calm generate -p calm/pattern/microservices.json -o my-architecture.json
```

This command uses the `microservices.json` pattern and outputs the result to `my-architecture.json`.
