# CALM Canvas - AI Assistant Guide

Read the [root AGENTS.md](../../AGENTS.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md) first. Keep changes focused and use the
repository PR template.

## Architecture

CALM Canvas has a TypeScript VS Code extension host and a React webview.
ReactFlow renders the canvas, Zustand holds its state, and the two sides exchange
typed messages. This replaces the old Tree View and Model/Docify/Template preview.

```text
src/
├── extension/
│   ├── extension.ts              # Activation, calm.openCanvas, CodeLens
│   ├── webview/
│   │   ├── canvas-panel.ts       # Panel lifecycle and message dispatch
│   │   └── html-provider.ts      # Webview HTML and bundled assets
│   ├── services/                 # Workspace assets, sync, export, CodeLens
│   └── types/messages.ts         # Extension/webview message contracts
├── webview/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Canvas, editing, layout, validation, export
│   ├── stores/                   # Zustand canvas state and sync bridge
│   ├── transforms/               # CALM parsing and editor transformations
│   ├── canvas/                   # ReactFlow node and edge components
│   ├── panels/                   # Palette, properties, assets, templates
│   └── utils/                    # Webview validation and helpers
├── core/                         # CALM types, helpers, bundled schemas
├── extensions/                   # Palette pack definitions and registry
└── test/__mocks__/vscode.ts       # VS Code API mock for unit tests
```

## Commands and settings

`package.json` is the source of truth for the public surface:

- Command: `calm.openCanvas` (**CALM: View in CALM Canvas**).
- Supported document suffixes: `.calm.json`, `.architecture.json`,
  `.template.json`, `.solution.json`, `.standard.json`, `.guideline.json`.
- Settings: `calm.externalAssetsPath`, `calm.packs.enabled`,
  `calm.packs.excludeNodes`.

The editor title, context menus, keybinding, and CodeLens open the same canvas.
Do not add guidance for removed preview tabs or settings such as `calm.urlMapping`.

## Data flow

- `CanvasPanel` loads the current document and workspace assets, then sends them
  to the webview using the contracts in `src/extension/types/messages.ts`.
- Canvas edits return as `canvasChanged` messages and are applied with
  `vscode.WorkspaceEdit`. They update the document; they do not save it to disk.
- `SyncCoordinator` suppresses the echo of a canvas write to prevent a sync loop.
  File watchers and save events send file changes back to the canvas.
- `WorkspaceAssetService` scans workspace roots and `calm.externalAssetsPath`
  for building blocks, patterns, templates, standards, and guidelines.
- Webview validation uses `src/webview/utils/validation.ts` and the schema and
  semantic checks in `src/core/validation.ts`. Results appear in the canvas.
- SVG export starts in `App.tsx` and is saved by `DiagramExportService`.

When adding a feature, update the appropriate host or webview module and the
message contract when necessary. Keep VS Code API access in the extension host
and preserve the file/canvas synchronization guards.

## Development commands

Use Node 26 as specified by the root `.nvmrc`. Run npm commands from the
repository root, with workspace selectors:

```bash
npm ci
npm run build --workspace calm-models
npm run build --workspace calm-plugins/vscode
npm run watch --workspace calm-plugins/vscode
npm test --workspace calm-plugins/vscode
npm run lint --workspace calm-plugins/vscode
npm run package --workspace calm-plugins/vscode
```

The root also provides `npm run test:vscode` and `npm run package:vscode`, which
run `build:shared` before the extension command. Watch mode builds the extension
host; rebuild the webview after changes to React components.

`esbuild.mjs` bundles `src/extension/extension.ts` into `dist/extension.js`.
`vite.webview.config.ts` bundles `src/webview/main.tsx` into `dist/webview/`.
Tests use `vitest.config.ts`, discover `*.test.ts` and `*.test.tsx`, and mock
the VS Code API. Add focused tests beside the affected source file.

To test the packaged extension, install the generated VSIX in a VS Code test
profile and open a synthetic CALM model. Use **Developer: Open Webview Developer
Tools** to inspect the React webview and the **CALM Canvas** output channel for
extension-host logs.

## Bundled Schemas

`src/core/validation.ts` imports the CALM meta-schemas from the `@finos/calm-schema` npm package,
and the build inlines them. The root `package.json` sets the version. A new schema release comes in
through the PR that updates `@finos/calm-schema`.

## Common pitfalls

- Keep command IDs and configuration keys consistent with `package.json`.
- Do not bypass `SyncCoordinator` when changing synchronization.
- Respect read-only navigation when drilling into referenced assets.
- Keep the webview and extension message types aligned.
- Update the current canvas modules rather than adding code to the removed
  `src/features/preview/` or Tree View structure.
- Use the current build and test configuration files; this package does not use
  the old tsup build or `*.spec.ts` test layout.
