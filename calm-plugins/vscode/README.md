# CALM Canvas for Visual Studio Code

CALM Canvas is a visual editor for CALM architecture models. Edit nodes and
relationships on a ReactFlow canvas alongside the JSON document.

## Open a model

Use VS Code 1.88 or newer and the
[FINOS CALM extension](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin).

1. Open a file ending in `.calm.json`, `.architecture.json`, `.template.json`,
   `.solution.json`, `.standard.json`, or `.guideline.json`.
2. Run **CALM: View in CALM Canvas** from the Command Palette, or use the editor
   title, editor context, or Explorer context menu.
3. You can also use **Ctrl+Shift+K** on Windows/Linux or **Cmd+Shift+K** on macOS,
   or the **View in CALM Canvas** CodeLens in a model document.

The canvas opens beside the JSON editor. Canvas changes update the editor
document; save it in VS Code to persist those changes to disk. Saved file changes
are sent back to the canvas.

## Features

- **Visual editing:** add nodes from the palette, connect them, and edit node
  and relationship properties.
- **Navigation:** pan, zoom, inspect selected elements, and drill into referenced
  building blocks with breadcrumb navigation.
- **Layout:** choose top-to-bottom or left-to-right automatic layout from the
  canvas toolbar.
- **Validation:** click **Validate** to check the model against the bundled CALM
  schema and semantic rules. Review the results in the canvas validation panel.
- **Reusable assets:** load building blocks, patterns, templates, standards,
  and guidelines from the workspace or an external assets folder.
- **SVG export:** click **Export SVG** in the canvas toolbar and choose a file
  in the VS Code save dialog.

## Configuration

These settings are declared in the extension manifest and can be set in
workspace or user settings:

| Setting | Purpose | Default |
| --- | --- | --- |
| `calm.externalAssetsPath` | Absolute path to an additional shared assets folder. | `""` |
| `calm.packs.enabled` | Palette pack IDs to show; an empty list shows all packs. | `[]` |
| `calm.packs.excludeNodes` | Node IDs to hide, in `packId:nodeType` format. | `[]` |

For example:

```json
{
  "calm.packs.enabled": ["core", "aws"],
  "calm.packs.excludeNodes": ["core:ldap"]
}
```

## Development and contributions

See [AGENTS.md](./AGENTS.md) for the current source layout and workspace commands,
and the [contribution guide](../../CONTRIBUTING.md) before opening a PR.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose).
