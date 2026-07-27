# @finos/calm-docusaurus-plugin

Embed [FINOS CALM](https://calm.finos.org) architecture diagrams in
Docusaurus MDX pages — like Mermaid, but driven by your real, validatable
architecture files.

Diagrams are pre-rendered to static SVG at build time (SEO-friendly, works
without JavaScript, instant paint) and upgrade in the browser to the
interactive [`@calmstudio/diagram`](https://www.npmjs.com/package/@calmstudio/diagram)
web component: zoom, pan, node tooltips, and animated flow highlighting.

## Install

```bash
npm install @finos/calm-docusaurus-plugin
```

## Configure

`docusaurus.config.js`:

```js
import calmRemark from '@finos/calm-docusaurus-plugin/remark';

export default {
  plugins: ['@finos/calm-docusaurus-plugin'],
  presets: [
    [
      'classic',
      {
        docs: {
          // Enables <CalmDiagram src="./relative/path.calm.json" />
          beforeDefaultRemarkPlugins: [calmRemark],
        },
      },
    ],
  ],
};
```

(CJS configs: `beforeDefaultRemarkPlugins: [require('@finos/calm-docusaurus-plugin/remark')]` —
add `.default` if your bundler surfaces the module namespace object.)

The plugin registers a webpack loader that pre-renders `*.calm.json`
imports to SVG. The remark plugin rewrites relative `src` paths into those
imports; Docusaurus has no API for a plugin to extend another plugin's
remark chain, hence the one extra config line.

## Use

```mdx
import { CalmDiagram } from '@finos/calm-docusaurus-plugin'

# My System

<CalmDiagram src="./architectures/loan-approval.calm.json" />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `src` | `string` | — | Relative path to a `.calm.json` file (pre-rendered at build time), or an `https://` URL (fetched client-side, no static SVG). |
| `data` | `object` | — | Inline CALM architecture. Client-rendered only. |
| `theme` | `'light' \| 'dark'` | follows `html[data-theme]` | Force a theme. |
| `flow` | `string` | — | Flow `unique-id` to highlight (applied after hydration). |
| `interactive` | `boolean` | `true` | `false` keeps the static SVG and skips the client-side JavaScript entirely. |

## Error behavior

- Invalid or unrenderable `.calm.json` files **fail the docs build** with
  the offending file path — broken diagrams are caught in CI, not by readers.
- If the interactive component fails to load at runtime, the static SVG
  simply stays in place.

## License

Apache-2.0. Part of the [FINOS architecture-as-code](https://github.com/finos/architecture-as-code) project.
