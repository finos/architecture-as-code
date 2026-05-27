---
id: vscode-extension
title: VS Code Extension
sidebar_position: 2
---

# VS Code Extension

The **CALM Tools** VS Code extension turns your editor into a live workbench for CALM architecture models. It validates documents on the fly, renders an interactive preview, and surfaces model elements in a navigable sidebar — all without leaving the file you're editing.

This page is a feature reference for users who already know what CALM is. If you're new to the extension, the [Install the CALM VS Code Extension](../tutorials/beginner/04-vscode-extension) tutorial walks through your first model step-by-step.

---

## Installation

The extension is published to the Visual Studio Code Marketplace.

1. Open VS Code.
2. Open the Extensions view (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux).
3. Search for **CALM Tools**.
4. Click **Install**.

Alternative install paths:

- **Marketplace web page:** [marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin)
- **VSIX file:** download the latest `.vsix` from the [GitHub releases](https://github.com/finos/architecture-as-code/releases) and run **Extensions: Install from VSIX…** in the Command Palette.

Once installed, open any CALM JSON file (one whose `$schema` points at `https://calm.finos.org/.../meta/calm.json`) and the extension activates automatically.

---

## Interface Layout

The extension contributes a dedicated **CALM** entry to the activity bar. Selecting it opens the **Model Elements** view, which lists the contents of the active CALM document.

![CALM activity bar entry](/img/vscode/01-activity-bar.png)

The right-hand preview panel is opened explicitly — see [Interactive Preview](#interactive-preview) below.

---

## Tree View Navigation

The **Model Elements** view groups the active document's contents into three top-level branches: **Nodes**, **Relationships**, and **Flows**. Expanding a branch reveals every element of that type defined in the document.

![Model Elements tree expanded](/img/vscode/02-tree-view.png)

Clicking any element focuses the corresponding range in the JSON editor. The view stays in sync with the active document — switching tabs updates the tree.

### Search & Filter

For larger architectures, use **Search CALM Architecture Elements** (the magnifier icon at the top of the view, or the command of the same name) to filter the tree to elements matching a substring.

![Model Elements tree filtered by 'api'](/img/vscode/03-tree-search.png)

A **Filtering by …** banner appears at the bottom of the view while a filter is active. Click its clear button (or run **Clear Search**) to restore the full tree.

---

## Interactive Preview

The preview panel renders the active CALM document as an interactive diagram next to the JSON source.

![Live preview of a three-tier architecture](/img/vscode/04-preview-hero.png)

**Open the preview** with any of:

- Keyboard: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows / Linux)
- Command Palette → **CALM: Open Preview**
- Right-click in the editor → **CALM: Open Preview**

**Diagram interactions:**

- Click any node to focus its definition in the JSON editor.
- The preview re-renders automatically when you save the file.
- Use the floating controls in the top-right of the diagram to zoom or reset the view.

The preview has three tabs at the top:

- **Docify** — the default rendered view of the architecture (shown above).
- **Template** — see [Documentation Generation](#documentation-generation) below.
- **Model** — the raw model data as the extension sees it.

---

## Themes

The preview's colour palette is controlled by the `calm.docify.theme` setting. Four explicit themes are available, plus `auto` which follows your VS Code colour theme.

<div className="vscode-extension-theme-gallery">

| Light | Dark |
| --- | --- |
| ![Preview rendered with the light theme](/img/vscode/05-theme-light.png) | ![Preview rendered with the dark theme](/img/vscode/05-theme-dark.png) |
| **High Contrast Light** | **High Contrast Dark** |
| ![Preview rendered with the high-contrast light theme](/img/vscode/05-theme-hc-light.png) | ![Preview rendered with the high-contrast dark theme](/img/vscode/05-theme-hc-dark.png) |

</div>

Configure in `settings.json`:

```json
"calm.docify.theme": "auto"
```

Acceptable values: `light`, `dark`, `high-contrast-light`, `high-contrast-dark`, `auto`.

---

## Layout Engines

The diagram supports two layout engines, configured by `calm.preview.layout`:

| ELK (default) | Dagre |
| --- | --- |
| ![Preview with ELK layout](/img/vscode/06-layout-elk.png) | ![Preview with Dagre layout](/img/vscode/06-layout-dagre.png) |

- **ELK** (Eclipse Layout Kernel) — better automatic placement for complex diagrams; improved edge routing and hierarchy handling. Recommended for most architectures.
- **Dagre** — the classic Mermaid layout engine. Choose this if you prefer Mermaid's traditional layout behaviour.

The setting applies workspace-wide. Individual templates can override it from the widget's frontmatter — see [widget configuration](../core-concepts/widgets) — for example:

```yaml
---
widget-options:
  block-architecture:
    layout-engine: dagre
---
```

Or inline in a Handlebars template:

```handlebars
{{block-architecture this layout-engine="dagre"}}
```

---

## Real-Time Validation

Open or save a CALM document and the extension validates it against the bundled CALM schemas. Errors and warnings appear in the **Problems** panel; clicking an entry jumps to the offending line.

![Problems panel showing validation errors](/img/vscode/07-validation-problems.png)

Validation is triggered on:

- Opening a CALM document
- Saving (`Cmd+S` / `Ctrl+S`)
- Switching to a different editor tab

The extension identifies a file as CALM by its `$schema` reference, so non-CALM JSON files are left untouched. Schemas are bundled with the VSIX — validation works offline.

---

## Hover Information

Hovering over a node identifier in the JSON editor surfaces the node's name, type, and description in a tooltip without taking you out of the source. This is most useful when reading a relationship block and you want to confirm what `web-frontend` or `api-server` actually refers to.

:::note
A screenshot of the hover tooltip is a known follow-up — see [issue #2531](https://github.com/finos/architecture-as-code/issues/2531). The feature itself is fully functional.
:::

---

## Timeline Navigation

When your workspace contains a `calm-timeline.json` document alongside multiple versioned architecture files, the extension treats it as the source of truth for architecture evolution. Click any milestone to open the architecture file it references; the **current moment** is marked with a star.

The timeline document follows the same shape as a CALM Hub timeline — see [Explicit vs. Implied Timelines](../core-concepts/timelines#explicit-vs-implied-timelines) for the underlying concept.

:::note
A timeline screenshot is a known follow-up — see [issue #2531](https://github.com/finos/architecture-as-code/issues/2531).
:::

---

## Multi-Document Navigation

CALM models often span multiple files connected by `detailed-architecture` references. The extension can resolve these references to local files via a URL-mapping document.

1. Create a mapping file (any name; convention is `calm-mapping.json`) anywhere in the workspace:

   ```json
   {
     "https://specs.internal/payment-service": "./services/payment-service.json",
     "https://specs.internal/inventory": "./services/inventory.json"
   }
   ```

2. Point the extension at it via `settings.json`:

   ```json
   "calm.urlMapping": "calm-mapping.json"
   ```

Now clicking a `detailed-architecture` reference in the preview opens the local file directly, rather than failing to resolve a URL.

---

## Documentation Generation

The preview's **Template** tab is a live Handlebars renderer. You author a Markdown template that references CALM widgets like `{{block-architecture}}`; the extension renders it against the active architecture and updates the output every time you save.

![Template tab in the preview](/img/vscode/10-docify.png)

Two related commands generate static output:

- **CALM: Create Documentation Website** (`calm.createWebsite`) — render the workspace's templates into an HTML site.
- The equivalent CLI command — see [`calm docify`](cli#documenting-architectures-docify) — for batch generation outside the editor.

Pair this with the [Handlebars Templates](../tutorials/intermediate/13-handlebars-templates) tutorial if you're new to template authoring.

---

## Configuration Reference

All settings live under the `calm.*` prefix in `settings.json` (`Cmd+,` / `Ctrl+,`).

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `calm.cli.path` | string | `./cli` | Path to the CALM CLI entry. Falls back to internal validation when absent. |
| `calm.files.globs` | string[] | `["calm/**/*.json", "calm/**/*.y?(a)ml"]` | Glob patterns the extension uses to discover CALM model files. |
| `calm.template.globs` | string[] | `["**/*.md", "**/*.markdown", "**/*.hbs", "**/*.handlebars"]` | Glob patterns for template files that may reference architectures. |
| `calm.docify.theme` | enum | `auto` | Diagram colour theme. See [Themes](#themes). |
| `calm.preview.layout` | enum | `elk` | Layout engine for the diagram. See [Layout Engines](#layout-engines). |
| `calm.urlMapping` | string | `""` | Path to a JSON file mapping URLs to local files. See [Multi-Document Navigation](#multi-document-navigation). |
| `calm.schemas.additionalFolders` | string[] | `[]` | Extra folders to load CALM schemas from. See [Schema Development](#schema-development). |

---

## Schema Development

If you're authoring custom CALM schemas (extending the official ones, or experimenting with a new domain), the extension can load schemas from arbitrary folders so your models validate against your in-progress definitions:

```json
"calm.schemas.additionalFolders": ["./my-schemas", "./custom-calm-schemas"]
```

Each file in those folders is indexed by its `$id`. Reference the `$id` from your CALM documents' `$schema` field and the extension uses your local copy without a round-trip to the network.

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open preview | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| Show Hover | `Cmd+K Cmd+I` | `Ctrl+K Ctrl+I` |
| Show Problems Panel | `Cmd+Shift+M` | `Ctrl+Shift+M` |

---

## Getting Help

- **Issues & feature requests:** [github.com/finos/architecture-as-code/issues](https://github.com/finos/architecture-as-code/issues)
- **Source:** [calm-plugins/vscode](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)
- **Beginner walkthrough:** [Install the CALM VSCode Extension](../tutorials/beginner/04-vscode-extension)
- **CLI equivalent:** [`calm` CLI](cli) for batch use outside the editor
