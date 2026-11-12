# CALM VS Code Extension Developer Guide

## Architecture

The extension has a TypeScript VS Code host and a React webview. ReactFlow
renders the architecture canvas, Zustand stores canvas state, and the host and
webview communicate through the typed contracts in
`src/extension/types/messages.ts`.

```text
src/
├── extension/
│   ├── extension.ts                 # Commands and activation
│   ├── webview/
│   │   ├── canvas-panel.ts          # Panel lifecycle, message dispatch, host services
│   │   └── html-provider.ts         # Webview HTML and initial settings
│   ├── services/                    # Workspace assets, sync, import/export, Hub
│   └── types/messages.ts            # Host/webview message contracts
├── webview/
│   ├── App.tsx                      # Core canvas and feature composition
│   ├── features/                    # Optional capabilities and toolbar contributions
│   ├── canvas/                      # ReactFlow nodes, edges, and canvas helpers
│   ├── panels/                      # Palette and shared property editors
│   ├── stores/                      # Canvas state and message bridge
│   ├── transforms/                  # CALM parsing and serialization
│   └── utils/                       # Canvas-specific helpers and validation
├── core/                            # CALM types, helpers, and schema validation
└── packs/                           # Declarative palette packs
```

The core canvas is always available. Optional feature definitions in
`src/webview/features/<feature-id>/feature.ts` are discovered and statically
bundled at build time. If `calm.canvas.enabledFeatures` is unset, all discovered
features are enabled. An explicit array selects feature IDs, and an empty array
disables all optional features. The manifest accepts strings without listing
feature IDs, so it does not expose build-specific features. Disabling a feature
hides its actions and UI, but must not remove that feature's data from a CALM
document during load, edit, or serialization.

Palette packs are separate from canvas features. Packs define node types and
visual metadata; `calm.packs.enabled` filters which registered packs appear in
the palette.

## Adding A Canvas Feature

1. Add the feature definition at
  `src/webview/features/<feature-id>/feature.ts`. Its ID must match the folder
  name; the build discovers and registers it automatically.
2. Add feature-owned UI in the same folder and contribute it through a generic
   surface slot. Add focused tests, including an App integration test if the
   feature changes editing or model preservation.

Do not add feature imports, IDs, or action handlers to `App.tsx`, the feature
registry, or `package.json`. The build discovers each `feature.ts`; the generic
registry filters by the setting and composes its actions, surfaces, and lifecycle
hooks. Keep host-only work behind the typed webview message bridge; do not import
`vscode` APIs into a feature. Host requests and responses belong in
`src/extension/types/messages.ts` and are dispatched by `CanvasPanel`.

### Minimal Example

Create `src/webview/features/example-feature/feature.ts`:

```ts
import type { CanvasFeatureDefinition } from '../types';
import { ExampleSummary } from './ExampleSummary';

export const exampleFeature: CanvasFeatureDefinition = {
  id: 'example-feature',
  toolbarActions: [
    {
      id: 'example-feature.count-nodes',
      label: 'Count Nodes',
      title: 'Log the current canvas node count',
      group: 'example-feature',
      order: 10,
      execute: ({ nodes }) => console.info(`Canvas nodes: ${nodes.length}`),
    },
  ],
  surfaces: { overlay: ExampleSummary },
};
```

Create `src/webview/features/example-feature/ExampleSummary.tsx`:

```tsx
import type { CanvasFeatureRuntime } from '../types';

export function ExampleSummary({ runtime }: { runtime: CanvasFeatureRuntime }) {
  return <output>{runtime.nodes.length} nodes on canvas</output>;
}
```

The feature ID is the folder name. Enable only it in local settings with
`"calm.canvas.enabledFeatures": ["example-feature"]`; setting the option to
`[]` disables optional features. Do not add the ID to the extension manifest.

Feature settings are injected by `html-provider.ts` when the webview is
initialized. A setting change takes effect the next time the canvas webview is
opened.

## Data Flow

- `CanvasPanel` sends the current document and workspace assets to the webview.
- Canvas edits return as `canvasChanged` messages and are applied with
  `vscode.WorkspaceEdit`; they do not save the document to disk.
- `SyncCoordinator` prevents file and canvas updates from echoing indefinitely.
- `WorkspaceAssetService` scans workspace roots and
  `calm.externalAssetsPath` for standard nodes, patterns, and controls.
- The webview parses and serializes CALM documents through `transforms/`; feature
  enablement must not change the document shape or discard unrendered data.

## Development

Use Node 26 as pinned by the repository's `.nvmrc`. Run commands from the
repository root:

```bash
npm run build --workspace calm-models
npm run build --workspace calm-plugins/vscode
npm test --workspace calm-plugins/vscode
npm run lint --workspace calm-plugins/vscode
npm run package --workspace calm-plugins/vscode
```

The extension host is bundled by `esbuild.mjs`. The webview is bundled from
`src/webview/main.tsx` by `vite.webview.config.mts`. Tests use Vitest and live
beside the affected source. For packaged-extension checks, install the VSIX in a
VS Code test profile and inspect the webview developer tools and CALM Canvas
output channel.

Release versioning and changelog generation are automated. Follow
`AGENTS.md` and the repository release workflow; do not edit the extension
version or generated changelog by hand.