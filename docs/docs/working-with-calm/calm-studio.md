---
id: calm-studio
title: CALM Studio
---

# CALM Studio

CALM Studio is a visual architecture editor for CALM. You draw system diagrams on a canvas and get valid, machine-readable CALM 1.2 JSON automatically — or import existing CALM JSON and get an editable diagram. Every node you draw corresponds to a typed, validated CALM element, and every connection is a typed relationship, so the architecture stays the single source of truth instead of drifting away from the systems it describes.

Studio also works as a **multi-file project editor**: open a folder, switch diagrams in tabs, reference nodes across files, and keep project validation and naming in a `.calmrj` config.

The Files panel and project features use the browser [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Use **Chrome** or **Safari** (current or previous major version). Other browsers can still edit a single diagram with limited file features.

## Key Features

- **Visual canvas editor** — Drag-and-drop nodes and relationships with a rich palette of architecture building blocks
- **Project folder and tabs** — Browse a CALM tree, open up to 10 diagrams at once, save all, bulk-close tabs
- **Cross-file references** — Drag a node from another file onto the canvas; glasses icon opens the source diagram
- **Bidirectional sync** — Canvas and CALM JSON stay in sync for the **active tab**; edit either and the other updates
- **Project config (`.calmrj`)** — Extra Spectral rulesets, naming conventions, template and pattern folders
- **Templates and CLI patterns** — Bundled templates, project templates, and CALM CLI patterns via the shared generate pipeline
- **Extension packs** — Built-in support for AWS, Azure, GCP, Kubernetes, FluxNova, and AI services; write custom packs in TypeScript
- **MCP server** — Model Context Protocol tools let AI assistants create and query architectures via natural language
- **AIGF governance** — Integrated AI Governance Framework controls with CALM 1.2 compliance validation

## Running CALM Studio

CALM Studio runs from the [architecture-as-code](https://github.com/finos/architecture-as-code) monorepo. It requires [Node.js](https://nodejs.org/) 22 or later.

### Development server

From the repository root:

```bash
npm run dev --workspace=@calmstudio/studio
```

Open [http://localhost:5173](http://localhost:5173).

### Docker

From the **monorepo root**, one command builds and serves the Studio SPA:

```bash
docker compose -f calm-studio/docker-compose.yml up --build
```

Open [http://localhost:5173](http://localhost:5173). Nginx listens on port 80 inside the container (`5173:80` on the host) and exposes a healthcheck on `/`.

The image serves the UI only. **Opening a project still uses the browser File System Access API** on your machine — the container does not mount architecture repositories.

## The Interface

![CALM Studio interface showing the canvas, node palette, and CALM JSON editor](/img/calmstudio/calmstudio01.png)

CALM Studio has these main areas:

| Area | Location | Purpose |
|------|----------|---------|
| Palette / Files | Left sidebar | Toggle node types vs project file tree |
| Tabs | Below the toolbar | One tab per open diagram (max. 10) |
| Canvas | Centre | Visual diagram workspace |
| CALM JSON editor | Right panel | Raw CALM 1.2 JSON for the **active tab** |
| Properties panel | Right panel (context) | Edit selected node or relationship (read-only for references) |
| Toolbar | Top | File, layout, filter, templates, and export actions |

## Canvas Features

### Drag-and-Drop Editing

The canvas is built on [Svelte Flow](https://svelteflow.dev/) (the Svelte port of React Flow). You can:

- **Drag** nodes from the palette to create them
- **Move** nodes by dragging (plain drag does **not** change containment)
- **Alt+drop** a node onto another to nest it (`composed-of` or `deployed-in`); **Alt+drag out** to un-nest
- **Ctrl+drag** (Cmd on macOS) an existing node to duplicate it (new `unique-id`; optional relationship copy)
- **Resize** container nodes by dragging corners
- **Select multiple** nodes with a lasso drag or Shift+click
- **Zoom and pan** with scroll wheel or trackpad gestures
- **Double-click** a node to open inline label editing
- **Double-click the glasses icon** on a reference node to open the target diagram

### Bidirectional Sync

Every edit on the canvas is immediately reflected in the CALM JSON editor, and vice versa. The JSON panel always shows the **active tab**. Visual designers work in the canvas; engineers can edit JSON; both views stay in sync with no extra save step between them.

The first node you place from an extension pack writes CALM 1.2 `$schema` (and the pack schema URL) into the document header. New nodes and relationships get required fields from the schema, including scaffolded `metadata` where the pack defines it.

### Properties Panel

Clicking a node or relationship opens the Properties panel. You can edit:

- Name and description
- Node type (changes the visual badge and CALM type field)
- Structured **metadata** from the active extension schema (for example ArchiMate `owner`, layer, viewpoint)
- Interfaces (URL endpoints, host-port pairs, container images, port numbers)
- Controls (add, edit, or remove security and compliance requirements, shown as badges on the node)
- Custom metadata fields
- Relationship **direction** (reverse source and destination)
- Containment **member list** (`nodes[]`) for `composed-of` and `deployed-in`

Nodes with `details.detailed-architecture` are **reference proxies**. The properties panel is read-only for those nodes — edit the source diagram, or open it from the glasses icon / **Open source**. Changing the link target is done in JSON, or by deleting the reference and creating a new one.

## Projects and Files

### Open a folder

Use **Files** in the left sidebar, then **Open folder**. Studio lists `.json` files in a tree. CALM files expand to show nodes (`name` plus an icon from `node-type`). Double-click a file to open it in a tab.

**Reveal in tree** locates the active tab’s file in the tree (switches to Files if the palette is showing). After **Save**, the node list under that file refreshes in place.

### Tabs

Each unique file has at most one tab. Reopening the same file only activates that tab. The active tab drives the canvas, properties, and JSON editor.

- Closing a dirty tab prompts **Save / Don't save / Cancel**.
- Maximum **10** tabs. Opening an 11th **new** diagram closes the oldest tab (open order), with the same unsaved-change prompt.
- Undo/redo applies **only** to the active tab.
- Tab context menu: **Close**, **Close tabs to the left**, **Close tabs to the right**, **Close all**. Dirty tabs in that set share **one** summary dialog (**Save all** / **Don't save** / **Cancel**).
- Toolbar **Save all** writes every dirty tab (Untitled tabs get Save As in sequence).

### Project file (`.calmrj`)

When you open a folder, Studio loads exactly one `*.calmrj` in the folder root. If none exists, a **Create project** wizard offers a bundled naming profile; you can skip and work without project features until you create one. Multiple `.calmrj` files in the root is an error — keep a single file.

The project file stores:

- Extra **Spectral** ruleset paths (core CALM validation always runs; project rulesets supplement it)
- **Naming** patterns used as defaults for **Extract to diagram**
- **`templates.dir`** and **`patterns.dir`** for the template picker
- Optional **search roots** for Find neighbors / Find usage

Project settings use a **file picker** for ruleset paths and a **directory picker** for folders. Paths are stored relative to the project root. Naming pattern templates (`{{name}}` tokens) stay as text.

### Extract to diagram

Select a node that is not already a reference, then **Extract to diagram**. Confirm or edit the folder and file name (defaults come from `.calmrj` naming). Studio writes a child architecture (the node, nested descendants, and internal relationships), replaces the parent node with a stub that keeps the same `unique-id` and sets `details.detailed-architecture`, and opens the child in a tab.

## Cross-File References

Drag a node from **Files** onto the current canvas to add a reference. Studio copies `name`, `node-type`, and `description`, keeps the source `unique-id`, and sets `details.detailed-architecture` to a **relative path** from the open file to the source JSON:

```json
{
  "unique-id": "api-gateway",
  "node-type": "system",
  "name": "API Gateway",
  "description": "Reference to external architecture",
  "details": {
    "detailed-architecture": "../data/api-gateway.json"
  }
}
```

A **glasses** icon marks the node. Double-click the icon:

- **Inside the project** — open or activate the target tab and **focus** the node with the same `unique-id`.
- **Outside the project** (path outside the root, `http(s)://`, or not available via the file API) — infobox *Link leads outside project* and a link that opens in a new browser tab.

## Containment

`composed-of` and `deployed-in` are **not** drawn as canvas edges. Nesting is the visual: child boxes sit inside the container. JSON still stores the relationships. SVG/PNG export matches the canvas (no containment lines).

Each container has **at most one** `composed-of` and **at most one** `deployed-in`, with children in `nodes[]`. The properties panel lists members; removing the last member deletes that relationship.

Hold **Alt** (Option on macOS) to change containment:

| Action | Result |
|--------|--------|
| Alt+drop onto a node with no containment yet | Type picker: composed-of or deployed-in |
| Alt+drop onto a node that already has one type | Append the child to that `nodes[]` |
| Alt+drop when both types exist | Use the last-used type for that container (picker if none yet) |
| Alt+drag a child out | Remove it from the parent’s containment `nodes[]` |

Plain drag only moves nodes. A **container header icon** opens the hidden containment relationship in the properties panel (a small menu if both composed-of and deployed-in exist).

## Diagram Filter

A session-only filter (not written to disk) fogs nodes and edges that do not match. Modes are independent:

| Mode | Match |
|------|--------|
| **Focus neighbors** | Selected node plus 1-hop neighbors on the **current** diagram |
| **Metadata value** | One metadata key from the document schema, one value present on the diagram |
| **Node type** | Multi-select of `node-type` values on the current diagram |

Clear the filter to restore full opacity.

## Find Neighbors and Find Usage

Both commands need one selected node and an open project folder. They scan **other** project CALM files (not the active diagram).

**Find neighbors** lists 1-hop linked nodes (inbound and outbound), filterable by node type and relationship type. **Add** inserts missing neighbors as references and **copies** the relationship into the current diagram with the **same** `unique-id`. It does not change the source file. If the neighbor is already on the canvas, only a missing relationship is added.

**Find usage** lists where the selected `unique-id` appears as a reference stub or as a relationship endpoint. **Open** activates that diagram and focuses the hit (or the container, if the edge is a hidden containment relationship).

## Templates and Patterns

The template picker lists:

1. **Bundled** architecture templates (for example FluxNova / OpenGRIS)
2. **Project templates** — JSON under `.calmrj` `templates.dir` that include `_template` (`id`, `name`, `category`). Same `id` overwrites a bundled card.
3. **CALM CLI patterns** — JSON Schema patterns under `patterns.dir` (and CLI patterns that live next to templates). Cards use a **Pattern** badge.

Choosing a pattern runs the existing `@finos/calm-shared` generate pipeline in the browser (`flattenAllOf` / `selectChoices` / `instantiate` — not a spawned `calm` CLI). If the pattern has choices, a dialog asks for them. The result opens in a **new untitled** tab.

## Extension Packs

CALM Studio ships 7 built-in extension packs, giving you 60+ additional node types beyond the 9 CALM core types:

| Pack | Node types | Examples |
|------|-----------|---------|
| **CALM Core** | 9 | Actor, Service, Database, Network |
| **AWS** | 33 | Lambda, EC2, S3, DynamoDB, VPC, EKS, RDS, CloudFront, SQS |
| **GCP** | ~20 | Cloud Run, BigQuery, Pub/Sub, GKE, Cloud SQL |
| **Azure** | ~20 | App Service, Cosmos DB, Service Bus, AKS, Blob Storage |
| **Kubernetes** | ~15 | Pod, Deployment, Service, Ingress, ConfigMap, Namespace |
| **AI/Agentic** | ~10 | LLM, AI Agent, Vector Store, Tool, MCP Server |
| **FluxNova** | ~10 | FluxNova Engine, Connector, Workflow, Topic |

You can also create custom packs in TypeScript to add your own node types.

## Governance: AIGF Scoring

CALM Studio integrates the [FINOS AI Governance Framework (AIGF)](https://air-governance-framework.finos.org/) for AI system architectures. When your diagram contains AI nodes (LLM, AI Agent, Vector Store, etc.), CALM Studio can:

- Score your architecture against **23 AIGF risk categories**
- Surface **23 corresponding mitigations** from the AIGF catalogue
- Show a governance scorecard in the sidebar
- Suggest controls to attach to AI nodes

Governance scoring is opt-in — use the **Governance** panel to trigger a scan.

## Auto-Layout

CALM Studio uses [ELK.js](https://eclipse.dev/elk/) for automatic diagram layout. Layout uses measured node sizes so boxes do not overlap after long labels. Relationship lines route around node bounds (including after manual move or resize).

| Preset | Algorithm | Best for |
|--------|-----------|---------|
| **Hierarchical LR** | ELK Layered, left-to-right | Service dependency diagrams |
| **Hierarchical TB** | ELK Layered, top-to-bottom | Traditional architecture diagrams |
| **Force-directed** | ELK Force | Exploratory diagrams with many nodes |
| **Radial** | ELK Radial | Hub-and-spoke views; the selected node is the center when exactly one node is selected |

Auto-layout respects CALM containment — children stay inside containers. Trigger re-layout from **Diagram → Auto-layout** in the toolbar.

## Import and Export

| Format | Import | Export |
|--------|--------|--------|
| CALM JSON (`.json`, `.calm.json`) | Yes | Yes |
| SVG | No | Yes |
| PNG | No | Yes |

Import a CALM JSON file to start from an existing architecture (for example one generated by the MCP server or CALM CLI). Export saves the canonical CALM JSON, or renders the diagram as PNG or SVG. Nested relationships are included in JSON export; image export matches the canvas (containment is nesting, not extra lines).

## MCP Server Integration

CALM Studio ships a standalone MCP server (`@calmstudio/mcp`) that lets AI tools like Claude Code and GitHub Copilot create and modify CALM architectures programmatically. The server exposes 20 tools covering node CRUD, relationship management, rendering, and validation.

### Recommended workflow

Always call `read_calm_guide` before creating nodes or relationships. It returns the full node-type vocabulary and relationship forms that the other tools enforce.

```
1. read_calm_guide()                        ← node types, relationship forms, usage tips
2. read_calm_guide(topic="arb-conversion")  ← AI architecture mapping table (optional)
3. create_architecture(file, nodes, relationships)
4. validate_architecture(file)              ← fix errors before continuing
5. finalize_architecture(file)              ← validates + attaches AIGF if AI nodes present
6. export_calm(file, destination)
```

### Relationship form — nested object, not a string

`relationship-type` is an **object** keyed by variant. This is enforced by the CALM 1.2 schema and by `validate_architecture`. The flat string form (`"relationship-type": "connects"`) is invalid and will be rejected.

**connects** — point-to-point communication:

```json
{
  "unique-id": "api-to-db",
  "relationship-type": {
    "connects": {
      "source": { "node": "api-service" },
      "destination": { "node": "postgres-db" }
    }
  },
  "protocol": "JDBC"
}
```

**composed-of** — structural containment:

```json
{
  "unique-id": "platform-composed-of-services",
  "relationship-type": {
    "composed-of": {
      "container": "platform",
      "nodes": ["auth-service", "api-service"]
    }
  }
}
```

**interacts** — actor to system:

```json
{
  "unique-id": "user-interacts-app",
  "relationship-type": {
    "interacts": {
      "actor": "end-user",
      "nodes": ["web-frontend"]
    }
  }
}
```

**deployed-in** — deployment containment:

```json
{
  "unique-id": "service-in-cluster",
  "relationship-type": {
    "deployed-in": {
      "container": "k8s-cluster",
      "nodes": ["api-service"]
    }
  }
}
```

### Common mistakes

| Mistake | Fix |
|---|---|
| `"relationship-type": "connects"` (string) | Use nested object: `{ "connects": { "source": ..., "destination": ... } }` |
| `"source": "node-id"` as a sibling key | Move inside variant: `"connects": { "source": { "node": "node-id" } }` |
| Adding relationships before nodes | `add_relationship` validates refs — add nodes first |
| `export_calm` before `finalize_architecture` | Always finalize first; it runs final validation |
