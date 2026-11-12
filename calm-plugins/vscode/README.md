# CALM Canvas for Visual Studio Code

CALM Canvas is a visual editor for CALM architecture models. Edit nodes and
relationships on a ReactFlow canvas alongside the JSON document.

## Open a model

Use VS Code 1.88 or newer and the
[FINOS CALM extension](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin).

1. Open a file ending in `.calm.json` or `.architecture.json`.
2. Run **CALM: View in CALM Canvas** from the Command Palette, or use the editor
   title, editor context, or Explorer context menu.
3. You can also use **Ctrl+Shift+K** on Windows/Linux or **Cmd+Shift+K** on macOS,
   or the **View in CALM Canvas** CodeLens in a model document.

The canvas opens beside the JSON editor. Canvas changes update the editor
document; save it in VS Code to persist those changes to disk. Saved file changes
are sent back to the canvas.

## Features

The core canvas is always available. Optional features are discovered from the
bundled feature folders and enabled by default. Set
`calm.canvas.enabledFeatures` in workspace or user settings to enable only the
listed feature IDs; set it to `[]` to disable all optional features. The setting
does not control palette pack visibility.

For example, if your build bundles a feature with ID `example-feature`:

```json
{
  "calm.canvas.enabledFeatures": ["example-feature"]
}
```

Feature IDs are build-specific and are not listed in the extension manifest.

- **Visual editing:** add nodes from the palette, connect them, and edit node
  and relationship properties.
- **Navigation:** pan, zoom, inspect selected elements, and drill into referenced
  standard nodes with breadcrumb navigation.
- **Layout:** choose top-to-bottom or left-to-right automatic layout from the
  canvas toolbar.
- **Validation:** click **Validate** to check the model against the bundled CALM
  schema and semantic rules. Review the results in the canvas validation panel.
- **Reusable assets:** load standard nodes, patterns, and controls
  from the workspace, an external assets folder, or CALM Hub.
- **Flows:** create and edit ordered transitions in the Solution panel.
  Select a flow and use Play or the step buttons to highlight transitions in
  either view, including reverse and parallel steps. Pause keeps the current
  step highlighted; Stop clears playback. The highlight checkbox controls
  the architecture overview when playback is idle, not playback highlighting.
  Switch to **Sequence Diagram** to view the messages between participants.
  Flow edits update the same architecture document in either view.
- **Patterns:** export and apply patterns with their flows, controls, and
  standard-node appearance.
- **SVG export:** click **Export SVG** in the canvas toolbar and choose a file
  in the VS Code save dialog. The export uses the current architecture or
  sequence view.

### 📦 Bundle Export and Import
Package a CALM architecture with all its dependencies into a portable ZIP archive, or import an existing bundle.

**Export CALM Bundle:**
- **Command Palette**: Run **CALM: Export CALM Bundle** from any CALM JSON file or `index.md`
- **CALM Canvas**: Click the **Export Bundle** button in the toolbar

Creates a ZIP containing:
- The architecture JSON file
- Associated OKF documentation
- Referenced standard nodes and patterns
- A manifest with SHA-256 checksums for integrity

The extension exports the selected document's directory. If the directory has an `index.md`, the bundle contains that index and the files it references. If not, the extension adds a generated OKF `index.md` to the ZIP only (the source directory is not changed) and bundles all regular files in the directory. The open document is saved before export; save any other edited files first. The ZIP must be saved outside the source directory.

**Import CALM Bundle:**
- **Command Palette**: Run **CALM: Import CALM Bundle**
- **CALM Canvas**: Click the **Import Bundle** button in the toolbar

The extension prompts for a ZIP file, verifies its manifest file list, sizes, and SHA-256 hashes before extraction, preserves the file structure, and optionally opens the architecture in CALM Canvas. These checks detect corruption, not the identity of the bundle's publisher.

Both features run inside the extension. You do not need to install the CALM CLI. They use the same shared code as the CLI `calm export` and `calm import` commands, so bundles work with both.

## Adding node icons and mapping them

The canvas uses a two-step pattern for icons:

1. Add the SVG string for the node type in the pack icon registry.
2. Map that node type to its card visual settings so the icon renders in the shared detail-card layout.

### 1) Add the SVG icon

Built-in CALM node types live in `src/packs/icons/core.ts`.

```ts
export const coreIcons: Record<string, string> = {
  actor: `<svg ...>...</svg>`,
  system: `<svg ...>...</svg>`,
  'data-asset': `<svg ...>...</svg>`,
};
```

For a custom pack, add the icon in the relevant pack file, such as `src/packs/icons/aws.ts` or another pack's icon registry.

### 2) Register the node type

The node must also exist in the pack definition so the registry can resolve it by type ID.

```ts
export const corePack: PackDefinition = {
  id: 'core',
  nodes: [
    node('data-asset', 'Data Asset', 'A named data asset'),
  ],
};
```

This is the same flow used for `corePack`, AWS, Azure, GCP, and other packs.

### 3) Map the visual card style

The shared detail-card renderer uses `src/webview/canvas/nodes/nodeVisuals.ts`.

```ts
export const DETAIL_NODE_VISUALS: Record<string, DetailNodeVisual> = {
  actor: {
    defaultBackground: '#f8fafc',
    defaultBorder: '#333333',
    defaultIconColor: '#333333',
    iconSize: 48,
    width: 190,
    height: 118,
  },
  system: DEFAULT_DETAIL_NODE_VISUAL,
};
```

- Add a new type key here if you want custom sizing or colors.
- Leave it out if you want the shared default detail-card style.
- `getDetailNodeVisual(type)` will fall back to `DEFAULT_DETAIL_NODE_VISUAL` automatically.

### 4) Rendering note

The generic detail-card renderer picks up both icon and visual settings through:

- `src/webview/canvas/nodes/GenericNode.tsx`
- `src/webview/canvas/nodes/SharedCardNode.tsx`
- `src/webview/canvas/nodes/CanvasNodeIcon.tsx`

This keeps icon logic in one place and makes adding a new node type a small, consistent change.

## Configuration

These settings are declared in the extension manifest and can be set in
workspace or user settings:

| Setting | Purpose | Default |
| --- | --- | --- |
| `calm.externalAssetsPath` | Absolute path to an additional shared assets folder. | `""` |
| `calm.packs.enabled` | Palette pack IDs to show; an empty list shows all packs. | `[]` |
| `calm.packs.excludeNodes` | Node IDs to hide, in `packId:nodeType` format. | `[]` |
| `calm.canvas.enabledFeatures` | Optional feature IDs to enable. IDs are discovered from bundled feature folders and are not listed in the manifest. | All bundled features |

For example:

```json
{
  "calm.packs.enabled": ["core", "aws"],
  "calm.packs.excludeNodes": ["core:ldap"]
}
```

Set `calm.canvas.enabledFeatures` to an array of feature IDs to enable only those
features, or to `[]` to disable all optional features. The extension manifest
does not enumerate feature IDs.

## Development and contributions

See [AGENTS.md](./AGENTS.md) for the current source layout and workspace commands,
and the [contribution guide](../../CONTRIBUTING.md) before opening a PR.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose).
