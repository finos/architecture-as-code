---
id: calm-hub-extension-blocks
title: Extension Blocks Reference
sidebar_label: Extension Blocks
sidebar_position: 4
---

# Extension Blocks Reference

A `screen`, `designer-tab`, `landing-card` or `detail-panel` route returns **blocks**: JSON that the
Hub UI draws. No extension code runs in the browser. For where each contribution shows and the
context it gets, see the [extension point reference](extension-points.md).

The JSON Schema of a reply is at `GET /api/calm/extensions/schema/0/blocks.schema.json`, for a
signed-in user. CALM Hub does not check a reply against it: the UI checks only `hubApi` and
`blocks` (see [Errors](#errors-and-unknown-blocks)).

## The reply

```json
{
  "hubApi": 0,
  "title": "Releases",
  "blocks": [{ "type": "markdown", "text": "## Release status" }]
}
```

| Field | Required | Rule |
|---|---|---|
| `hubApi` | Yes | Must equal the `hubApi` of the manifest, now `0` |
| `title` | No | Shows under the heading. The heading stays the contribution `title` |
| `blocks` | Yes | A list of blocks, drawn in order |

## Block types

### markdown

```json
{ "type": "markdown", "text": "### How releases work\nEach release goes through **review** and **canary**. See [the runbook](https://example.org/runbook)." }
```

GitHub-flavoured Markdown. Hub ignores raw HTML, shows an image as its alt text, and shows a link
that is not `http` or `https` as plain text. Links open in a new tab. A Markdown heading goes
one level below the slot heading, so `#` in a node details panel is not a page title. HTML has
no level below `h6`, so in a node details panel, where the slot heading is `h6`, each Markdown
heading is an `h6`. The size of the text still follows the Markdown level.

### keyValue

```json
{ "type": "keyValue", "items": [{ "label": "Owner", "value": "web-team" }, { "label": "Open reviews", "value": 2 }] }
```

Label and value pairs. A `value` is a string or a number.

### stats

```json
{ "type": "stats", "items": [{ "label": "Releases this month", "value": 3 }, { "label": "Success rate", "value": "83%" }] }
```

Large figures. A `value` is a string or a number. A landing card shows the first three items of its
first `stats` block.

### table

```json
{
  "type": "table",
  "columns": ["Version", "Status", "Commits", "Notes"],
  "rows": [
    ["2.4.0", { "badge": "in-progress", "tone": "info" }, 42, { "label": "Release notes", "href": "https://example.org/2.4.0" }],
    ["2.3.0", { "badge": "rolled-back", "tone": "negative" }, 17, { "label": "Architecture", "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0" } }]
  ]
}
```

Each cell has one of these forms:

| Form | Example | Shows |
|---|---|---|
| Text | `"2.4.0"` | The text |
| Number | `42` | The number |
| Badge | `{ "badge": "released", "tone": "positive" }` | A coloured badge. `tone` is optional; the default is `neutral` |
| External link | `{ "label": "Runbook", "href": "https://example.org" }` | A link that opens in a new tab, marked `↗` |
| Hub link | `{ "label": "Architecture", "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0" } }` | A link to a Hub page. All four fields are required: a link without one shows its label as text |

A link has a `label` and exactly one of `href` or `hub`. An `href` must start with `http://` or
`https://`. The UI shows other URLs as plain text.

### cards

```json
{ "type": "cards", "items": [{ "title": "2.4.0 rolling out", "subtitle": "order-service at 40%", "link": { "label": "Details", "href": "https://example.org/2.4.0" } }] }
```

Small cards. `subtitle` and `link` are optional. A `link` has the same rules as a table link.

### alert

```json
{ "type": "alert", "tone": "warning", "text": "Release 2.4.0 is rolling out." }
```

A message with a coloured background. `tone` is optional; the default is `info`. With no `stats`
block, a landing card shows the text of its first `alert`.

### links

```json
{
  "type": "links",
  "items": [
    { "label": "Release runbook", "href": "https://example.org/runbooks/release" },
    { "label": "Demo architecture", "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0" } }
  ]
}
```

A row of link buttons, with the same rules as a table link.

## Tones

| Tone | Colour |
|---|---|
| `positive` | Green |
| `negative` | Red |
| `warning` | Amber |
| `info` | Blue |
| `neutral` | Grey. A `neutral` alert has no colour |

An unknown `tone` shows as the default of its block.

The `keyValue`, `stats` and `cards` blocks set their columns from the width of the slot, not of
the screen. In a narrow node details panel they show in one or two columns.

## Errors and unknown blocks

An error stays in the slot of its extension. It does not break the Hub page around it.

| Case | The Hub UI shows |
|---|---|
| The call fails: no scope, the backend is down, or Hub returns `4xx` or `5xx` | "Extension request failed." |
| The reply has no `blocks` list, or its `hubApi` is not the manifest `hubApi` | "Extension request failed." |
| A block has an unknown `type` | "This screen has a block type that this CALM Hub cannot show." in place of that block. The other blocks show |
| A block that the UI cannot draw, for example a `table` with no `rows` | "This extension sent content that CALM Hub cannot show." in place of the whole contribution |
| A landing card call fails or has a bad reply | The card shows no headline |

An unknown block type is not valid against the schema. Hub shows a placeholder, so that a newer
backend still works with an older Hub.

The CLI and MCP do not draw blocks. When a command names a block route, they return the reply JSON
as it is. For the errors that the proxy returns, see
[Calling an extension](index.md#calling-an-extension).
