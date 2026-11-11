# @finos/calm-docusaurus-plugin

Embed [FINOS CALM](https://calm.finos.org) architecture diagrams in
Docusaurus MDX pages — like Mermaid, but driven by your real, validatable
architecture files.

Diagrams are pre-rendered to static SVG at build time by
[`@finos/calm-diagram`](../calm-diagram) (SEO-friendly, works without
JavaScript, instant paint). In the browser they get zoom, pan and node
tooltips.

## Install

This package is not published. The docs site in this repository uses it as an npm workspace.

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
| `containers` | `'nested' \| 'edges'` | `'nested'` | How `composed-of`/`deployed-in` render: nested boxes or dashed arrows. Non-default values apply after hydration (build-time SVG uses the default). |
| `interactive` | `boolean` | `true` | `false` keeps the static SVG, with no zoom, pan or tooltips. `data`, URL `src`, `flow` and `containers` then have no effect. |

## Error behavior

- Invalid or unrenderable `.calm.json` files **fail the docs build** with
  the offending file path — broken diagrams are caught in CI, not by readers.
- If a client-side render fails, the static SVG stays in place. A diagram
  with no static SVG (`data` or URL `src`) shows the error.

## License

Apache-2.0. Part of the [FINOS architecture-as-code](https://github.com/finos/architecture-as-code) project.
