---
id: docify
title: Documenting Architectures (Docify)
sidebar_label: docify
---

# Documenting Architectures (Docify)

The `docify` command transforms a CALM architecture JSON file into human-readable documentation. It supports two primary output modes:

- **Website generation** — uses the built-in template bundle to produce a fully structured Markdown documentation site ready to publish with a static site generator.
- **Custom Markdown reports** — uses your own Handlebars (`.hbs`) or Markdown (`.md`) templates to render bespoke reports, conformance summaries, runbooks, or any other document format you need.

In both modes, `docify` processes your architecture model through a set of templates and writes the resulting files to an output directory. Template rendering is powered by [CALM Widgets](../core-concepts/widgets) — a Handlebars-based component system that provides built-in helpers for tables, lists, Mermaid diagrams, and more.

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
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths.
- **`--scaffold`**: Copy the built-in template files into the output directory without processing them. Use this to obtain a starting point for customisation or for live-reload workflows.
- **`--export-diagrams <svg|png>`**: Render Mermaid diagrams in the generated documentation to image files using a local Chromium-based browser, replacing each diagram's code block with an image reference. Adds roughly 10-40 seconds depending on the number of diagrams.
- **`--browser-path <path>`**: Path to a Chromium-based browser executable. Only needed if automatic detection (Chrome, then Edge) fails when using `--export-diagrams`.
- **`--diagram-render-timeout <ms>`**: Per-diagram render timeout in milliseconds, only used with `--export-diagrams` (default: `30000`).
- **`-v, --verbose`**: Enable verbose logging.

## Examples

### Generate website with the built-in bundle

```shell
calm docify -a my-architecture.json -o docs/output
```

### Generate a custom Markdown report from a single template

```shell
calm docify -a my-architecture.json -o reports/ -t templates/compliance-report.hbs
```

### Generate multiple documents from a template directory

```shell
calm docify -a my-architecture.json -o reports/ -d my-templates/
```

### Scaffold the built-in templates for customisation

```shell
calm docify -a my-architecture.json -o docs/output --scaffold
```

### Export Mermaid diagrams as images

```shell
calm docify -a my-architecture.json -o docs/output --export-diagrams svg
```

This requires Google Chrome or Microsoft Edge to be installed locally (detected
automatically), or a Chromium-based browser path supplied via `--browser-path`. If
no browser is found, documentation is still generated with diagrams left as
Mermaid code blocks.
