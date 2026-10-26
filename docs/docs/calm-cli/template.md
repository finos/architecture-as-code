---
id: template
title: Generating Files from Templates
sidebar_label: template
---

# Generating Files from Templates

The `template` command generates files from a CALM architecture with [Handlebars](https://handlebarsjs.com/) templates. Use it to make any text output from your model, for example configuration files, reports or infrastructure code. Templates can use [CALM Widgets](../core-concepts/widgets.md).

To generate a full documentation website, use [`docify`](docify.md). `docify` uses the same template engine with a built-in bundle.

## Basic Usage

Give the architecture, an output path, and exactly one template source:

```shell
# A single template file
calm template -a architecture.json -t report.md.hbs -o report.md

# A directory of templates
calm template -a architecture.json -d ./templates -o ./output

# A template bundle
calm template -a architecture.json -b ./my-bundle -o ./output
```

## Command Options

- **`-a, --architecture <file>`**: Path to the CALM architecture JSON file. Required.
- **`-o, --output <file>`**: Path to the output directory, or to the output file for a single template. Required.
- **`-t, --template <path>`**: Path to a single `.hbs` or `.md` template file.
- **`-d, --template-dir <path>`**: Path to a directory of `.hbs` or `.md` templates.
- **`-b, --bundle <path>`**: Path to a template bundle directory.
- **`--clear-output-directory`**: Delete all files and subdirectories in the output path before generation.
- **`-u, --url-to-local-file-mapping <path>`**: Path to a JSON file that maps URLs to local file paths. See [URL to Local File Mapping](generate.md#url-to-local-file-mapping).
- **`-v, --verbose`**: Enable verbose logging.

You must supply exactly one of `--template`, `--template-dir` or `--bundle`.

`template` creates the output directory if it does not exist. If the directory exists, `template` overwrites the files that it generates and does not change other files, unless you use `--clear-output-directory`.

## Template Bundles

A template bundle is a directory that has an `index.json` file, the templates, and an optional transformer. Use a bundle when you need more than one output file, one file for each node, or custom data for the templates.

```json
{
  "name": "Service Docs",
  "transformer": "my-transformer",
  "templates": [
    { "template": "index.md.hbs", "from": "document", "output": "index.md", "output-type": "single" },
    { "template": "node.md.hbs", "from": "document.nodes", "output": "nodes/{{id}}.md", "output-type": "repeated",
      "partials": ["partials/table.hbs"] }
  ]
}
```

| Field | Description |
|---|---|
| `name` | Name of the bundle |
| `transformer` | Optional. Name of a `.js` or `.ts` file in the bundle, without the extension. If you do not supply one, the templates get the canonical CALM model |
| `templates[].template` | Path of the template from the bundle root, with `/` separators |
| `templates[].from` | Path to the data in the transformed model, for example `document.nodes` |
| `templates[].output` | Output path. For `repeated`, `{{id}}` and `{{unique-id}}` are replaced with the item's ID |
| `templates[].output-type` | `single` (one file), `repeated` (one file for each item in `from`) or `copy` (copy the file with no Handlebars processing) |
| `templates[].partials` | Optional. Paths of partials to register. Call a partial by its path, for example `{{> partials/table.hbs}}` |
| `templates[].id-key` | Optional. The property that holds each item's ID for `repeated`. The default is `unique-id` |
| `templates[].front-matter` | Optional. Front matter for the generated files. It has `inject` (the default is `true` for `.md` and `.mdx`), `variables` and `widgetOptions` |

### Transformers

A transformer changes the CALM model into the data that the templates use. It exports a class with two methods:

```js
module.exports = class MyTransformer {
    registerTemplateHelpers() {
        return { upper: (s) => s.toUpperCase() };
    }

    getTransformedModel(calmCore) {
        return { document: calmCore.originalJson };
    }
};
```

- `getTransformedModel` receives the parsed architecture and returns the data for the `from` paths.
- `registerTemplateHelpers` returns Handlebars helpers to add to the templates.

## Example

```shell
calm template \
  -a ./cli/test_fixtures/template/model/document-system.json \
  -b ./cli/test_fixtures/template/template-bundles/doc-system \
  -u ./cli/test_fixtures/template/model/url-to-file-directory.json \
  -o ./one-pager
```

## Learn More

- [CALM Widgets tutorial](../tutorials/intermediate/12-calm-widgets.md)
- [Handlebars templates tutorial](../tutorials/intermediate/13-handlebars-templates.md)
