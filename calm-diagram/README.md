# @finos/calm-diagram

Renders a CALM architecture to an SVG string, and holds the node packs that give node types
their icons and colours. It has no UI framework and runs in Node or in a browser.

| Entry | Use |
|---|---|
| `@finos/calm-diagram` | `renderELKDiagram(architecture, { theme, flow, containers })`. ELK makes the layout |
| `@finos/calm-diagram/packs` | `initAllPacks`, `getAllPacks`, `resolvePackNode` and the pack definitions |

The [Docusaurus plugin](../calm-docusaurus-plugin) uses the renderer for the docs site. The
[VS Code extension](../calm-plugins/vscode) uses the packs for its node palette.

This package is not published. Build it before the packages that use it:

```bash
npm run build --workspace calm-diagram
```
