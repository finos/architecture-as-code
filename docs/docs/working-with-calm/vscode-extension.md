---
id: vscode-extension
title: VS Code Extension
sidebar_label: CALM Canvas (VS Code)
sidebar_position: 2
---

# CALM Canvas — VS Code Extension

**CALM Canvas** (`FINOS.calm-vscode-plugin`) is a visual architecture editor for [CALM](https://calm.finos.org) models in Visual Studio Code. It renders your architecture as an interactive, editable ReactFlow diagram — add nodes, draw relationships, apply patterns, validate compliance, connect to CALM Hub, and export diagrams — all side-by-side with your JSON source.

:::info Theme
CALM Canvas follows your VS Code colour theme automatically. When you switch between light, dark, or high-contrast themes the canvas updates immediately — there is no separate theme setting.
:::

---

## Installation

CALM Canvas requires Visual Studio Code **1.88.0** or newer.

1. Open VS Code.
2. Open the Extensions view (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux).
3. Search for **CALM Canvas** (`FINOS.calm-vscode-plugin`).
4. Click **Install**.

Alternative install paths:

- **VS Code Marketplace:** [marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin)
- **VSIX package:** Download the `.vsix` asset from [GitHub Releases](https://github.com/finos/architecture-as-code/releases) and run **Extensions: Install from VSIX…** from the Command Palette.

The extension activates automatically when your workspace contains `*.calm.json` or `*.architecture.json` files.

---

## Opening the Canvas

<video controls width="100%">
  <source src="/video/vscode/your-first-architecture.mp4" type="video/mp4" />
</video>

*Your first architecture — drag nodes, draw relationships, and watch the JSON update in real time.*

Open any `.calm.json` or `.architecture.json` file and launch the visual editor using any of these methods:

- **CodeLens:** Click **View in CALM Canvas** at the top of the file (also appears above each node's `unique-id`).
- **Keyboard shortcut:** `Cmd+Shift+K` (macOS) / `Ctrl+Shift+K` (Windows/Linux).
- **Editor title bar:** Click the CALM Canvas icon in the editor title bar.
- **Context menu:** Right-click inside the editor or in the Explorer and select **View in CALM Canvas**.
- **Command Palette:** Run **CALM: View in CALM Canvas** (`calm.openCanvas`).

The canvas opens in a panel beside your JSON editor.

---

## Interface Layout

![CALM Canvas workspace layout](/img/vscode/Full_Workspace_Layout.png)

CALM Canvas is divided into four areas:

1. **Toolbar (top)** — Auto-layout (`↓ Layout` / `→ Layout`), **Validate**, **Apply Pattern**, **Export SVG**, **Import SVG**, and the overflow menu (`⋮`) for **New from Pattern** and **Create Node**.
2. **Node Palette (left)** — Drag-and-drop palette containing core CALM node types, extension packs, workspace standard nodes, and CALM Hub standard nodes.
3. **Interactive Canvas (centre)** — ReactFlow canvas with pan, zoom, minimap, background grid, and zoom controls.
4. **Properties Panel (right)** — Contextual inspector for the selected element. Collapsible and resizable.

---

## Adding Nodes

Drag nodes from the **Node Palette** on the left onto the canvas. The palette contains:

### Core Node Types

Built-in CALM node types: `actor`, `system`, `service`, `database`, `network`, `webclient`, `ecosystem`, `ldap`, `data-asset`, and `container`.

### Extension Packs

Domain-specific node libraries. Available packs: `core`, `fluxnova`, `ai`, `aws`, `gcp`, `azure`, `k8s`, `messaging`, `identity`, `opengris`.

Control which packs appear using the `calm.packs.enabled` and `calm.packs.excludeNodes` settings (see [Configuration Reference](#configuration-reference)).

### Workspace Standard Nodes

Reusable node definitions discovered from your workspace's `standard-nodes/` folder (and `calm.externalAssetsPath` if configured). Any `*.calm.json` or `*.architecture.json` file inside `standard-nodes/` with a `nodes` array is loaded as a draggable component. These appear in the palette under **NODES** with a **WS** badge.

### CALM Hub Standard Nodes

When connected to CALM Hub, published standard nodes appear in the palette under **HUB**, grouped by namespace. See [Connecting to CALM Hub](#connecting-to-calm-hub).

---

## Drawing Relationships

<video controls width="100%">
  <source src="/video/vscode/nodes-relationships-containers.mp4" type="video/mp4" />
</video>

*Nodes, relationships and containers — extension packs, bidirectional edges, line styles, and container nesting.*

Connect nodes by dragging from a **handle** (the small dots on node edges) to another node. New connections default to the `connects` relationship type.

You can reconnect an existing edge by dragging its endpoint to a different node.

---

## Editing Properties

Click any node or edge to open its properties in the right panel.

**Node properties:**
- Name, Type, Description
- Interfaces (add/remove)
- Controls (with validation constraints)
- Custom metadata (key-value pairs)
- Visual appearance (background/text colour overrides)

**Edge properties:**
- Relationship type (`connects`, `interacts`, `deployed-in`, `composed-of`, `options`, or custom)
- Direction (Source → Target, Bidirectional, No Arrows)
- Line style (Solid, Dashed, Dotted)
- Protocol
- Description (shown as edge label)
- Controls

**No selection (pane click):**
- Solution-level controls for the entire architecture

---

## Containers

Drop a **container** node to create a grouping region. Drag child nodes into it to establish `deployed-in` or `composed-of` containment relationships automatically.

To remove a node from its container, select it and press `Ctrl+Shift+U` (or `Cmd+Shift+U` on macOS), or click **Remove from Container** in the properties panel.

---

## Connecting to CALM Hub

<video controls width="100%">
  <source src="/video/vscode/calm-hub-integration.mp4" type="video/mp4" />
</video>

*CALM Hub integration — connect, browse namespaces, and drag Hub standard nodes onto the canvas.*

![CALM Hub connection and palette](/img/vscode/Hub_Palette_Section.png)

CALM Canvas integrates with CALM Hub to browse and reuse published standard nodes across namespaces:

1. Set `calm.hub.url` in your VS Code settings (e.g. `"http://localhost:8080"`), or run **CALM: Connect to Hub** from the Command Palette.
2. If `calm.hub.autoConnect` is `true` (default), the extension connects automatically on startup when a URL is configured.
3. Hub standard nodes appear in the palette under **HUB**, grouped by namespace.
4. Use `calm.hub.selectedNamespaces` to filter which namespaces appear.

:::tip Status Bar Indicator
The `CALM Hub` indicator in the bottom status bar confirms you are connected. Click it to open the Hub management menu — from there you can select namespaces, refresh, change the Hub URL, or disconnect.
:::

### Running CALM Hub Locally

To try Hub integration locally, run the CALM Hub container:

```bash
docker run -p 8080:8080 \
  -e JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager" \
  -e QUARKUS_OBSERVABILITY_ENABLED=false \
  -e QUARKUS_LAUNCH_DEVMODE=false \
  -e QUARKUS_DEVSERVICES_ENABLED=false \
  -e QUARKUS_PROFILE=standalone \
  -e CALM_DATABASE_MODE=github \
  -e CALM_GITHUB_CLONE_DIRECTORY=/tmp/calm-hub-clones \
  -e CALM_GITHUB_NAMESPACES="OSS-NY-Demo|byrash/oss-ny-demo|main|" \
  finos/calm-hub
```

Then set `calm.hub.url` to `http://localhost:8080` in your VS Code settings.

**Hub commands:**

| Command | Description |
| --- | --- |
| **CALM: Connect to Hub** | Connect to the configured Hub URL |
| **CALM: Disconnect from Hub** | Disconnect and remove Hub nodes from the palette |
| **CALM: Refresh from Hub** | Re-fetch standard nodes from Hub |

---

## Validation

<video controls width="100%">
  <source src="/video/vscode/standard-nodes-controls.mp4" type="video/mp4" />
</video>

*Standard nodes and controls — drag standard nodes, configure controls, and validate compliance.*

![Validation results panel with control errors](/img/vscode/Validation_Results_Panel.png)

Click **Validate** in the toolbar to check your architecture. Validation runs two checks:

1. **Schema and semantic validation** — checks for duplicate `unique-id` values, dangling node references, and structural issues.
2. **Control requirement validation** — validates controls against their JSON Schema requirements.

Results appear in the **Validation Results** panel at the bottom of the canvas, sorted by severity (error, warning, info). Validation badges appear on nodes with issues. Click an issue to select and focus the relevant node.

Validation uses bundled CALM schemas — no network access required.

---

## Patterns

<video controls width="100%">
  <source src="/video/vscode/patterns.mp4" type="video/mp4" />
</video>

*Patterns — apply a predefined architecture pattern to your canvas.*

Click **Apply Pattern** in the toolbar to merge a predefined architecture pattern into the current canvas. Existing nodes and relationships are preserved; new ones from the pattern are added.

![Pattern picker dialog](/img/vscode/Pattern_Picker_Dialog.png)

You can also use **⋮ menu → New from Pattern** to start a fresh architecture from a pattern.

Patterns are discovered from the `patterns/` folder in your workspace, `calm.externalAssetsPath`, or connected CALM Hub.

---

## Standard Node Creator

Use **⋮ menu → Create Node** to create a reusable standard node from scratch. Define its name, type, description, interfaces, and controls, then save it to your workspace's `standard-nodes/` folder for reuse across architectures.

---

## Drill-Down Navigation

Double-click a node that references a sub-architecture (`details.detailed-architecture`) or a standard node to **drill into** its detail. A breadcrumb trail appears at the top of the canvas showing your navigation path (e.g. `Root / Payment Service / Database Layer`). Click any breadcrumb segment to navigate back up.

![Drill-down breadcrumb and read-only banner](/img/vscode/Drill_Down_Breadcrumb.png)

When drilling into a standard node, the canvas opens in **read-only mode** (indicated by a yellow banner) to protect the shared definition.

---

## Import SVG

Right-click any `.svg` file in the Explorer and select **Import SVG as CALM Architecture** to convert an SVG diagram into a new CALM architecture file.

---

## Layout

The toolbar offers two auto-layout options:

- **↓ Layout** — top-to-bottom (vertical) arrangement
- **→ Layout** — left-to-right (horizontal) arrangement

You can also manually reposition nodes by dragging them. Positions are persisted in the CALM JSON's `metadata._layout` field.

---

## Export

Click **Export SVG** in the toolbar to export the current canvas as a vector image. The export uses the current theme background and preserves all node/edge styling.

---

## Real-Time Sync

The canvas stays in sync with the JSON file:

- **File → Canvas**: Edit the JSON and save — the canvas updates automatically.
- **Canvas → File**: Edit on the canvas — the JSON document buffer updates in real time.
- **External changes**: A file watcher detects changes from git, other editors, etc.

---

## Undo & Redo

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Undo | `Cmd+Z` | `Ctrl+Z` |
| Redo | `Cmd+Shift+Z` | `Ctrl+Shift+Z` or `Ctrl+Y` |

Up to 50 undo steps are retained per session.

---

## Configuration Reference

All settings live under the `calm.*` prefix in VS Code's `settings.json`.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `calm.externalAssetsPath` | `string` | `""` | Absolute path to an external folder containing shared `nodes/`, `standards/`, `patterns/`, and `templates/` folders. |
| `calm.packs.enabled` | `string[]` | `[]` | Extension pack IDs to show in the palette (e.g. `["aws", "k8s"]`). Empty = show all. Available: `core`, `fluxnova`, `ai`, `aws`, `gcp`, `azure`, `k8s`, `messaging`, `identity`, `opengris`. |
| `calm.packs.excludeNodes` | `string[]` | `[]` | Node type IDs to hide from the palette (e.g. `["core:ldap", "aws:s3"]`). Use `packId:nodeType` format. |
| `calm.hub.url` | `string` | `""` | CALM Hub endpoint URL (e.g. `https://calmhub.example.com`). |
| `calm.hub.autoConnect` | `boolean` | `true` | Automatically connect to CALM Hub on startup when a URL is configured. |
| `calm.hub.selectedNamespaces` | `string[]` | `[]` | Hub namespaces to show in the palette. Empty = show all namespaces. |

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open Canvas | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| Undo | `Cmd+Z` | `Ctrl+Z` |
| Redo | `Cmd+Shift+Z` | `Ctrl+Shift+Z` / `Ctrl+Y` |
| Unparent from Container | `Cmd+Shift+U` | `Ctrl+Shift+U` |
| Delete selected | `Backspace` / `Delete` | `Backspace` / `Delete` |
| Multi-select | Hold `Shift` | Hold `Shift` |

---

## Getting Help

- **Issues & feature requests:** [github.com/finos/architecture-as-code/issues](https://github.com/finos/architecture-as-code/issues)
- **Source:** [calm-plugins/vscode](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)
- **CLI equivalent:** [`calm` CLI](cli) for batch use outside the editor
