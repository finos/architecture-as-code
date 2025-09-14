# CALM V- Interactive CALM Preview (webview)
    - Live documentation generation with block-architecture rendering
    - Intelligent validation with detailed error reportingugin (Experimental)

Status: Experimental — APIs, behavior, and visuals may change. Use at your own risk.

Live-visualize CALM architecture models while you edit them. See structure, navigate quickly, validate with a local CLI, and generate docs — all offline.

## Features

- Interactive CALM Preview (webview)
    - Graph powered by Cytoscape with configurable layouts (dagre, fcose, cose)
    - Containment: “deployed-in” and “composed-of” render as nested compound containers (dashed boxes), with multi-level nesting supported
    - Edges: connectivity relationships and flows are shown; containment edges are hidden to avoid clutter
    - Smooth, incremental updates without camera jumps; preserves pan/zoom and node positions between edits
    - Toolbar: Fit to view, Reset layout/positions
    - Labels & descriptions toggles (per document), theme-aware styling matching your VS Code theme
    - Click to inspect details; double-click to jump to source in editor
    - Resizable panel split (drag divider)
- Sidebar tree view
    - Lists Nodes, Relationships, and Flows from the active model
    - Reveal selection and jump to source
- Editing helpers
    - Hovers and CodeLens for quick navigation across model elements
    - File watching and auto-refresh on save (no manual refresh needed)
    - Basic diagnostics surfaced in Problems (when available)
- Optional CLI integration (future)
    - Planned: run validation and generate docs using a local CALM CLI
- Offline-first
    - No network access required; no language server needed

## Usage

1. Open a CALM model file (JSON or YAML). By default, the extension watches files under `calm/**/*.json` and `calm/**/*.y?(a)ml`.

2. Run the command “CALM: Open Preview” to open the live graph view.

3. Interact with the graph:
    - Drag nodes to position them (positions are persisted per document)
    - Use Fit to reframe; Reset to clear positions and run the layout
    - Toggle Labels and Descriptions independently
    - Double-click a node or edge to reveal its definition in the editor

4. Use the “CALM” activity bar to open the Model Elements tree and navigate across Nodes, Relationships, and Flows.

5. Optional (future): a CLI path setting exists but commands are not exposed yet.

## Commands

- CALM: Open Preview — open the interactive graph

## Configuration

These settings can be adjusted in Settings (search for “CALM”) or in settings.json:

- calm.cli.path (string): Path to the CALM CLI entry. Default: `./cli`
- calm.preview.autoOpen (boolean): Auto-open the preview when a CALM file is opened. Default: false
- calm.preview.layout (string): `dagre` | `fcose` | `cose`. Default: `dagre`
- calm.preview.showLabels (boolean): Show labels by default. Default: true
- calm.files.globs (string[]): File globs to watch for models. Default: [`calm/**/*.json`, `calm/**/*.y?(a)ml`]

Notes:

- The preview also persists per-document toggles (Labels, Descriptions), positions, and viewport.
- Containment (“deployed-in”, “composed-of”) renders as nested compound parents; containers missing from the node list are synthesized so nesting remains intact.

## Install / Load locally

Option A — Run from source (recommended for development):

1. Prereqs: VS Code (1.88+), Node.js 18+

2. In this folder (`calm-plugins/vscode`), install deps and start the watcher:
    - npm install
    - npm run watch

3. Press F5 in VS Code to launch the “Run Extension” target. A new Extension Development Host window will open with the plugin loaded.

Option B — Install from VSIX:

1. Build and package:
    - npm run build
    - npm run package
      This produces a `.vsix` file in the folder.
2. In VS Code, open the Extensions view menu (…)
3. Choose “Install from VSIX…” and select the generated `.vsix`.

## VS Code Launch Configuration

For convenience, add the following entries to `.vscode/launch.json` to run and test the extension. The `preLaunchTask` keeps the build running in watch mode so changes are picked up automatically.

```jsonc
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run CALM Extension",
            "type": "extensionHost",
            "request": "launch",
            "runtimeExecutable": "${execPath}",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}/calm-plugins/vscode",
            ],
            "outFiles": ["${workspaceFolder}/calm-plugins/vscode/dist/**/*.js"],
            "preLaunchTask": "calm-plugin: watch",
        },
        {
            "name": "Extension Tests",
            "type": "extensionHost",
            "request": "launch",
            "runtimeExecutable": "${execPath}",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}/calm-plugins/vscode",
                "--extensionTestsPath=${workspaceFolder}/calm-plugins/vscode/dist/test",
            ],
            "outFiles": ["${workspaceFolder}/calm-plugins/vscode/dist/**/*.js"],
            "preLaunchTask": "calm-plugin: watch",
        },
    ],
}
```

Supporting task in `.vscode/tasks.json`:

```jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "calm-plugin: watch",
            "type": "shell",
            "command": "npm run watch",
            "options": { "cwd": "${workspaceFolder}/calm-plugins/vscode" },
            "isBackground": true,
        },
    ],
}
```

Workflow:

1. Press F5 (Run CALM Extension) to launch an Extension Development Host.
2. Edit code; tsup watch rebuilds automatically.
3. Use the Extension Tests config to debug test executions if needed.

## Model formats

- JSON or YAML CALM documents are supported. The parser normalizes common field variants:
    - Node IDs via `id` or `unique-id`; node type via `type` or `node-type`
    - Relationships via `type` or `relationship-type` shapes (supports `connects`, `deployed-in`, `composed-of`)
    - Flows via `flows[]`

## Limitations

- Experimental: behavior and visuals may change, and some features are incomplete.
- No language server (LSP) yet; validation relies on the optional local CLI.
- Very large models may require tuning the chosen layout or manual positioning.

## Troubleshooting

- Preview is empty or missing nodes:
    - Check your file matches the configured globs (see calm.files.globs)
    - Click Reset in the preview to clear positions and re-layout
- Validation/Docs commands do nothing:
    - Set `calm.cli.path` to your local CLI entry and ensure it’s executable
- Still stuck?
    - Open the “CALM” Output channel for logs

## License

See the repository LICENSE file.
