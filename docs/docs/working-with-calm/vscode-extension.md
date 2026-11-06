---
id: vscode-extension
title: VS Code Extension
sidebar_label: CALM Canvas (VS Code)
sidebar_position: 2
---

# VS Code Extension (CALM Canvas)

**CALM Canvas** (`FINOS.calm-vscode-plugin`) is the visual architecture editor for [CALM](https://calm.finos.org) models in Visual Studio Code. It provides a ReactFlow canvas side-by-side with your JSON source so you can author nodes, relationships, [Controls](../core-concepts/controls), [Standards](../core-concepts/standards), and [Patterns](../core-concepts/patterns), validate against the CALM meta-schemas, connect to CALM Hub, and import or export SVG diagrams.

---

## Installation

CALM Canvas requires Visual Studio Code **1.88.0** or newer.

1. Open VS Code.
2. Open the Extensions view (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux).
3. Search for **CALM Canvas** (`FINOS.calm-vscode-plugin`).
4. Click **Install**.

Alternative installation methods:

- **VS Code Marketplace:** [marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin)
- **VSIX package:** Download the `.vsix` asset from [GitHub Releases](https://github.com/finos/architecture-as-code/releases) and run **Extensions: Install from VSIX…** from the Command Palette.

The extension activates automatically when your workspace contains `*.calm.json` or `*.architecture.json` files.

---

## Opening CALM Canvas

Open any file ending in `.calm.json` or `.architecture.json` and launch the visual editor using any of the following:

- **CodeLens:** Click **View in CALM Canvas** at the top of a `.calm.json` or `.architecture.json` file.
- **Keyboard shortcut:** `Cmd+Shift+K` (macOS) or `Ctrl+Shift+K` (Windows/Linux) while focused on a `.calm.json` or `.architecture.json` editor.
- **Editor title bar / context menu:** Click the **View in CALM Canvas** icon in the editor title bar, or right-click inside the editor or Explorer and select **View in CALM Canvas**.
- **Command Palette:** Run **CALM: View in CALM Canvas** (`calm.openCanvas`).

The canvas opens beside your JSON editor. Changes made on the canvas update the open JSON document buffer (persisting layout coordinates under `metadata._layout`), and saving edits in the JSON text editor updates the canvas automatically.

---

## Workspace Layout

CALM Canvas is divided into four areas:

1. **Toolbar (top)** — Automatic layout (`↓ Layout` top-to-bottom, `→ Layout` left-to-right), **Validate**, **Apply Pattern**, **Export SVG**, **Import SVG**, and the overflow menu (`⋮`) for **New from Pattern**, **Create Node**, **Create Control**, and **Export as Pattern**.
2. **Node Palette (left)** — Drag-and-drop palette containing core CALM node types (`actor`, `system`, `service`, `database`, `network`, `webclient`, `ecosystem`, `ldap`, `data-asset`), domain extension packs (`core`, `fluxnova`, `ai`, `aws`, `gcp`, `azure`, `k8s`, `messaging`, `identity`, `opengris`), and reusable **Standards** loaded from the workspace, `calm.externalAssetsPath`, or CALM Hub.
3. **Interactive Canvas (center)** — ReactFlow canvas supporting pan, zoom, minimap navigation, node resizing, container nesting (`deployed-in` and `composed-of`), relationship drawing (`connects`, `interacts`, `deployed-in`, `composed-of`, `options`), and drill-down navigation with breadcrumbs for nodes that reference a `details.detailed-architecture` document or Standard.
4. **Properties Panel (right)** — Contextual inspector for the selected element:
   - **Node selected:** Edit `unique-id`, `name`, `node-type`, `description`, `interfaces`, node-level `controls`, custom `metadata`, and visual appearance (`metadata['standard-node-style']`).
   - **Relationship selected:** Edit `unique-id`, `description`, `relationship-type` (`connects`, `interacts`, `deployed-in`, `composed-of`), `protocol` (from the CALM `protocol` enum), and relationship-level `controls`.
   - **No selection:** Inspect and edit architecture-level `controls`.

---

## Validation

Click **Validate** in the canvas toolbar to validate the active architecture. Validation runs two checks:

1. **CALM schema and semantic validation** — Validates the document against the bundled `@finos/calm-schema` meta-schemas (JSON Schema draft 2020-12) and checks semantic rules including duplicate `unique-id` values, dangling node references, self-loops, empty containers, and orphan nodes.
2. **Control requirement validation** — Validates architecture-level and node-level `controls` against their resolved JSON Schema requirement definitions (`requirement-url`) and inline `config` constraints (required properties, enums, regex patterns, and numeric/boolean types).

Validation issues are listed in the bottom **Validation Results** panel, sorted by severity (`error`, `warning`, `info`). Clicking an issue associated with a node selects and focuses that node on the canvas.

---

## Standards, Controls, and Patterns

CALM Canvas works directly with core CALM governance primitives:

### Standards

- Reusable [Standards](../core-concepts/standards) discovered in your workspace, `calm.externalAssetsPath`, or connected CALM Hub namespaces appear in the **Node Palette**.
- Dragging a Standard onto an empty area of the canvas instantiates a node pre-populated with the Standard's controls and metadata (`source-standard-node`).
- Dragging a Standard onto an existing node merges the Standard's controls onto that target node.
- Use **Create Node** from the toolbar overflow menu (`⋮`) to author a new reusable node definition.

### Controls

- Add and configure [Controls](../core-concepts/controls) on individual nodes or at the architecture level (when no node or relationship is selected).
- Each control entry references a JSON Schema requirement via `requirement-url` (a URL or Hub CURIE) and stores configuration values in `config` or `config-url`.
- Use **Create Control** from the toolbar overflow menu (`⋮`) to author a new JSON Schema control requirement (`*.requirement.json`) in your workspace.

### Patterns

- **New from Pattern** (`⋮` menu): Create a new architecture pre-populated from a [Pattern](../core-concepts/patterns) in your workspace, external assets path, or CALM Hub.
- **Apply Pattern** (toolbar): Apply a pattern to the current architecture and set the document's top-level `$schema` to the pattern's schema URI.
- **Export as Pattern** (`⋮` menu): Export the current canvas architecture as a reusable CALM Pattern JSON Schema.

---

## Connecting to CALM Hub

CALM Canvas integrates with CALM Hub to browse and reuse published Standards, Controls, and Patterns across namespaces:

1. Set `calm.hub.url` in your VS Code settings (for example, `"https://calmhub.example.com"`), or run **CALM: Connect to Hub** (`calm.connectToHub`) from the Command Palette.
2. Authenticate when prompted. A status bar item indicates the current Hub connection state.
3. Use `calm.hub.selectedNamespaces` to filter which Hub namespaces are shown in the palette, or leave it empty to include all namespaces.
4. Run **CALM: Refresh from Hub** (`calm.refreshFromHub`) to fetch updated assets (cached locally by SHA for offline use), or **CALM: Disconnect from Hub** (`calm.disconnectFromHub`) to end the session.

---

## SVG Import and Export

### Importing an SVG Diagram

You can convert existing architecture diagrams (such as Draw.io `.svg` exports or generic SVG diagrams) into CALM JSON architectures:

- Right-click an `.svg` file in the VS Code Explorer and select **Import SVG as CALM Architecture**, or
- Run **CALM: Import SVG as CALM Architecture** (`calm.importSvg`) from the Command Palette, or
- Click **Import SVG** in the CALM Canvas toolbar.

The importer maps SVG shapes and containers to CALM node types, creates `connects` relationships from edges and `deployed-in` relationships from container geometry, preserves node coordinates in `metadata._layout`, and records fill/text colours in `metadata['standard-node-style']`.

### Exporting to SVG

Click **Export SVG** in the canvas toolbar and choose a destination path in the save dialog to export the rendered diagram as an `.svg` file.

---

## Commands Reference

All commands contributed by `calm-plugins/vscode/package.json`:

| Command ID | Title | Description |
| --- | --- | --- |
| `calm.openCanvas` | **CALM: View in CALM Canvas** | Open the active `.calm.json` or `.architecture.json` file in the visual canvas editor. |
| `calm.connectToHub` | **CALM: Connect to Hub** | Connect to a configured CALM Hub instance and load Hub assets. |
| `calm.disconnectFromHub` | **CALM: Disconnect from Hub** | Disconnect from the active CALM Hub session. |
| `calm.refreshFromHub` | **CALM: Refresh from Hub** | Refresh Standards, Controls, and Patterns from CALM Hub. |
| `calm.importSvg` | **CALM: Import SVG as CALM Architecture** | Convert an `.svg` diagram into a `.calm.json` architecture file. |

---

## Configuration Reference

All settings contributed under `calm.*` in `settings.json` (`Cmd+,` / `Ctrl+,`):

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `calm.externalAssetsPath` | `string` | `""` | Absolute path to an external folder containing shared `nodes/`, `standards/`, `patterns/`, and `templates/` folders. |
| `calm.packs.enabled` | `string[]` | `[]` | List of extension pack IDs to show in the palette (e.g. `["aws", "k8s"]`). Leave empty to show all packs. Available packs: `core`, `fluxnova`, `ai`, `aws`, `gcp`, `azure`, `k8s`, `messaging`, `identity`, `opengris`. |
| `calm.packs.excludeNodes` | `string[]` | `[]` | List of node type IDs to hide from the palette (e.g. `["core:ldap", "aws:s3"]`). Use the `packId:nodeType` format. |
| `calm.hub.url` | `string` | `""` | CalmHub endpoint URL (e.g. `https://calmhub.example.com`). |
| `calm.hub.autoConnect` | `boolean` | `true` | Automatically connect to CalmHub on startup when URL is configured. |
| `calm.hub.selectedNamespaces` | `string[]` | `undefined` | Selected Hub namespaces to show in the palette. Empty or not set shows all namespaces. |

Example `.vscode/settings.json`:

```json
{
  "calm.externalAssetsPath": "/path/to/shared-calm-assets",
  "calm.packs.enabled": ["core", "aws", "k8s"],
  "calm.packs.excludeNodes": ["core:ldap"],
  "calm.hub.url": "https://calmhub.example.com",
  "calm.hub.autoConnect": true,
  "calm.hub.selectedNamespaces": ["platform", "security"]
}
```

---

## Keyboard Shortcuts

| Action | Command | macOS | Windows / Linux | When |
| --- | --- | --- | --- | --- |
| View in CALM Canvas | `calm.openCanvas` | `Cmd+Shift+K` | `Ctrl+Shift+K` | `resourceFilename =~ /\.(calm\|architecture)\.json$/` |
| Delete selected node / edge | Canvas action | `Backspace` / `Delete` | `Backspace` / `Delete` | Canvas focused (editable mode) |
| Multi-select on canvas | Canvas action | `Shift` + drag | `Shift` + drag | Canvas focused |

---

## Getting Help

- **Issues & feature requests:** [github.com/finos/architecture-as-code/issues](https://github.com/finos/architecture-as-code/issues)
- **Extension source:** [calm-plugins/vscode](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)
- **Beginner walkthrough:** [Install the CALM VS Code Extension](../tutorials/beginner/04-vscode-extension)
- **CLI companion:** [`calm` CLI](cli) for command-line validation and automation
