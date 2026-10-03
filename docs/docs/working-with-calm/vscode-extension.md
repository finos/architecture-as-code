---
id: vscode-extension
title: VS Code Extension
sidebar_label: CALM Canvas (VS Code)
sidebar_position: 2
---

# VS Code Extension — CALM Canvas

The **CALM Canvas** VS Code extension is a visual architecture editor for CALM models. It renders your architecture as an interactive, editable diagram — add nodes, draw relationships, apply standards, validate compliance, and export diagrams — all without leaving VS Code.

---

## Installation

The extension is published to the Visual Studio Code Marketplace.

1. Open VS Code.
2. Open the Extensions view (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux).
3. Search for **CALM Canvas**.
4. Click **Install**.

Alternative install paths:

- **Marketplace web page:** [marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin)
- **VSIX file:** download the latest `.vsix` from the [GitHub releases](https://github.com/finos/architecture-as-code/releases) and run **Extensions: Install from VSIX…** in the Command Palette.

Once installed, open any supported CALM file and the extension activates automatically.

### Supported File Formats

The CALM Canvas opens for files matching these naming patterns:

| Pattern | Example |
| --- | --- |
| `*.calm.json` | `payments.calm.json` |
| `*.architecture.json` | `platform.architecture.json` |
| `*.solution.json` | `checkout.solution.json` |
| `*.template.json` | `microservice.template.json` |
| `*.standard.json` | `tls-policy.standard.json` |
| `*.guideline.json` | `naming.guideline.json` |
| `*.pattern.json` | `event-driven.pattern.json` |

Right-click any matching file in the explorer and select **CALM: Open Canvas** to launch the visual editor.

---

## Interface Layout

The canvas opens in a panel beside your JSON editor. The interface consists of:

- **Node Palette** (left) — drag-and-drop components, standards, and guidelines onto the canvas
- **Canvas** (center) — interactive ReactFlow diagram showing nodes and relationships
- **Properties Panel** (right) — edit selected node/edge properties, controls, and metadata
- **Toolbar** (top) — layout, validate, apply patterns, export, and more

### Demo Video

<video controls width="100%" poster="/img/vscode/canvas-poster.png">
  <source src="/video/calm-canvas-demo.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

*Watch the CALM Canvas in action: drag-and-drop nodes, draw relationships, apply standards, validate, and export.*

---

## Visual Canvas Editor

The canvas renders your CALM architecture as an interactive diagram that you can edit directly.

### Adding Nodes

Drag nodes from the **Components** palette on the left:

- **Infrastructure nodes** — services, databases, actors, web clients, containers
- **Workspace building blocks** — reusable components from your workspace's `building-blocks/` folder
- **Standards & Guidelines** — drag onto a node to attach compliance controls

You can also drop nodes from **Extension Packs** if configured.

### Drawing Relationships

Connect nodes by dragging from a handle (the small dots on node edges) to another node. New connections default to a `connects` relationship type.

### Editing Properties

Click any node or edge to open its properties in the right panel:

**Node properties:**
- Name, Type, Description
- Interfaces (add/remove)
- Controls (with validation constraints)
- Custom metadata
- Visual appearance (background/text colour overrides)

**Edge properties:**
- Relationship type (`connects`, `interacts`, `deployed-in`, `composed-of`)
- Direction (Source → Target, Bidirectional, No Arrows)
- Line style (Solid, Dashed, Dotted)
- Protocol (for `connects` and `interacts`)
- Description (shown as edge label)


### Containers

Drop a container node to create a grouping region. Drag child nodes into it to establish `deployed-in` or `composed-of` relationships. Container roles include:

- Default, Region (Primary/Secondary), Cluster, Availability Zone, Solution

---

## Standards & Guidelines

The palette shows standards and guidelines discovered from your workspace's `standards/` and `guidelines/` folders (markdown files with YAML front-matter defining controls).

### Dropping Standards onto Nodes

Drag a standard from the palette and drop it directly onto an existing node:

1. The standard's **controls are merged** into the target node
2. A **standards node** is created on the canvas (or reused if already present)
3. A **dotted "adheres to" edge** connects the target node to the standards node

This creates a visible compliance relationship in your architecture diagram. In CALM JSON, it produces a standard `connects` relationship with `metadata: { "line-style": "dotted" }`.

---

## Bidirectional Relationships

To model a bidirectional connection between two nodes:

1. Select the edge between them
2. In the Properties panel, change **Direction** to "Bidirectional ↔"

In the CALM JSON, this produces two `connects` relationships (A→B and B→A) — fully schema-compliant. The canvas merges paired relationships into a single visual edge with arrows on both ends.

---

## Line Styles

Edges support three line styles:

| Style | Appearance | Use case |
| --- | --- | --- |
| **Solid** | ——— | Standard connections |
| **Dashed** | - - - | Optional or planned connections |
| **Dotted** | · · · | Compliance/governance references |

Change line style in the edge Properties panel. Non-default styles are stored in the relationship's `metadata["line-style"]`.

---

## Theming

The canvas automatically follows your VS Code colour theme. When you switch between light and dark themes, the canvas background, panels, toolbars, and text update immediately — no configuration needed.

Node diagram colours (service green, database green, webclient blue, etc.) remain fixed as they represent semantic node types.

---

## Layout

The toolbar offers two auto-layout options:

- **↓ Layout** — top-to-bottom (vertical) arrangement
- **→ Layout** — left-to-right (horizontal) arrangement

You can also manually reposition nodes by dragging them. Positions are persisted in the CALM JSON's `metadata._layout` field.

---

## Validation

Click **Validate** in the toolbar to check your architecture against the CALM schema. Results appear in a panel at the bottom of the canvas:

- Errors (red) and warnings (yellow) are listed with messages
- Click an issue to highlight the relevant node on the canvas
- A green "Architecture is valid" message confirms compliance

Validation uses bundled CALM schemas — no network access required.


---

## Patterns & Templates

### Apply Pattern

Click **Apply Pattern** to merge a predefined architecture pattern into your current canvas. Patterns are loaded from your workspace.

### New from Pattern

Use the **⋮ menu → New from Pattern** to start a fresh architecture from a pattern template.

### Templates

Use **⋮ menu → Templates** to apply a template that scaffolds a complete architecture structure.

---

## Building Block Creator

Use **⋮ menu → Create Node** to create a reusable building block from scratch. Define its name, type, description, interfaces, and controls, then save it to your workspace's `building-blocks/` folder for reuse across architectures.

---

## Drill-Down Navigation

Double-click a node that references a building block or sub-architecture to **drill into** its detail. A breadcrumb trail appears at the top showing your navigation path. Click any breadcrumb segment to navigate back.

Building blocks open in **read-only mode** (indicated by a yellow banner).

---

## Export

Click **Export SVG** in the toolbar to export the current canvas as a vector image. The export uses the current theme background and preserves all node/edge styling.

---

## Generate Spec

Click **Generate Spec** to invoke the CALM Agent (via Copilot Chat) to produce a Solution Design Specification document from your architecture. The agent reads your architecture file and any referenced standards to generate a comprehensive 13-section design document.

---

## Real-Time Sync

The canvas stays in sync with the JSON file:

- **File → Canvas**: Edit the JSON and save — the canvas updates automatically
- **Canvas → File**: Edit on the canvas — the JSON file updates in real time
- **External changes**: File watcher detects changes from git, other editors, etc.

---

## Configuration Reference

All settings live under the `calm.*` prefix in `settings.json`.

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `calm.urlMapping` | string | `""` | Path to a JSON file mapping URLs to local files for multi-document navigation. |
| `calm.schemas.additionalFolders` | string[] | `[]` | Extra folders to load CALM schemas from for validation. |

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Open Canvas | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |

---

## Getting Help

- **Issues & feature requests:** [github.com/finos/architecture-as-code/issues](https://github.com/finos/architecture-as-code/issues)
- **Source:** [calm-plugins/vscode](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)
- **CLI equivalent:** [`calm` CLI](cli) for batch use outside the editor
