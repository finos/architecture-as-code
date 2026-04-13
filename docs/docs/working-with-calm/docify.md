---
id: docify
title: Docify
sidebar_position: 8
---

# Docify

The `docify` command transforms a CALM architecture JSON file into human-readable documentation. It supports two primary output modes:

- **Website generation** — uses the built-in template bundle to produce a fully structured Markdown documentation site ready to publish with a static site generator.
- **Custom Markdown reports** — uses your own Handlebars (`.hbs`) or Markdown (`.md`) templates to render bespoke reports, conformance summaries, runbooks, or any other document format you need.

In both modes, `docify` processes your architecture model through a set of templates and writes the resulting files to an output directory. Template rendering is powered by [CALM Widgets](../core-concepts/widgets) — a Handlebars-based component system that provides built-in helpers for tables, lists, Mermaid diagrams, and more. You can use these widgets directly inside your own templates to produce rich, structured output from your architecture data.

## Basic Usage

### Generate a documentation website

To generate a documentation website using the built-in template bundle, provide the path to your architecture file and the directory where the output should be written:

```shell
calm docify -a architecture.json -o docs/output
```

This uses the default website template bundle and produces a fully structured Markdown documentation site in `docs/output`.

### Generate a custom Markdown report

To produce a tailored document — such as a compliance report or runbook — supply your own template:

```shell
calm docify -a architecture.json -o reports/ -t my-report-template.hbs
```

Or point to a directory of templates to generate multiple output files in one pass:

```shell
calm docify -a architecture.json -o reports/ -d my-templates/
```

## Command Options

- **`-a, --architecture <file>`**: _(required)_ Path to the CALM architecture JSON file.
- **`-o, --output <file>`**: _(required)_ Path to the output directory where the generated documentation will be written.
- **`--clear-output-directory`**: Clear the output directory before processing (default: false).
- **`-t, --template <path>`**: Path to a single `.hbs` or `.md` template file to use instead of the built-in bundle.
- **`-d, --template-dir <path>`**: Path to a directory of `.hbs`/`.md` templates to use instead of the built-in bundle.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths (see [URL Mapping](#url-to-local-file-mapping) below).
- **`--scaffold`**: Copy the built-in template files into the output directory without processing them. Use this to obtain a starting point for customisation or for live-reload workflows.
- **`-v, --verbose`**: Enable verbose logging.

Only one of `--template` or `--template-dir` may be specified. If neither is provided, the built-in website bundle is used.

## Examples

### Generate a documentation website with the built-in bundle

```shell
calm docify -a my-architecture.json -o docs/output
```

Processes `my-architecture.json` using the default template bundle and writes a ready-to-publish documentation site to `docs/output`.

### Generate a custom Markdown report from a single template

```shell
calm docify -a my-architecture.json -o reports/ -t templates/compliance-report.hbs
```

Renders the architecture against a single Handlebars template, producing a focused report (e.g. a compliance summary or runbook) in `reports/`.

### Generate multiple documents from a template directory

```shell
calm docify -a my-architecture.json -o reports/ -d my-templates/
```

Every `.hbs` and `.md` file found in `my-templates/` is rendered against the architecture and the results are written to `reports/`. This is useful when you need several different views of the same architecture — for example, a technical overview, a controls checklist, and a deployment guide — all generated in one command.

### Scaffold the built-in templates for customisation

```shell
calm docify -a my-architecture.json -o docs/output --scaffold
```

The built-in template files are copied to `docs/output` without being processed. You can then edit them and re-run `docify` with `-d docs/output` to render your customised templates.

### Clear the output directory before regenerating

```shell
calm docify -a my-architecture.json -o docs/output --clear-output-directory
```

Removes all existing files from `docs/output` before writing the new documentation, ensuring no stale files remain.

## URL to Local File Mapping

When your architecture references schemas or patterns via canonical URLs (e.g., `https://example.com/standards/node-standard.json`) but the actual files exist on your local filesystem, the `-u, --url-to-local-file-mapping` option lets you redirect those URLs to local paths.

### Mapping File Format

Create a JSON file that maps URLs to relative file paths:

```json
{
  "https://example.com/standards/node-standard.json": "standards/node-standard.json",
  "https://example.com/standards/relationship-standard.json": "standards/relationship-standard.json"
}
```

Paths are resolved relative to the mapping file's location.

### Example Usage

```shell
calm docify -a architecture.json -o docs/output -u url-mapping.json
```
