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
one level below the slot heading, so `#` in the inspector is not a page title. HTML has
no level below `h6`, so a Markdown heading that goes below `h6` is an `h6`. The text size still follows the Markdown level for `#`, `##` and `###`; `####` to `######` have the size of `###`.

### keyValue

```json
{ "type": "keyValue", "items": [{ "label": "Owner", "value": "web-team" }, { "label": "Open reviews", "value": 2 }] }
```

Label and value pairs. A `value` is a string or a number.

### stats

```json
{ "type": "stats", "items": [{ "label": "Releases this month", "value": 3 }, { "label": "Success rate", "value": "83%" }] }
```

Large figures. A `value` is a string or a number. For what a landing card shows from this block, see
[landing-card](extension-points.md#landing-card).

A stat with a `filter` is a button that filters a [table](#filter-a-table) of the same reply. A stat
without a `filter` shows only its figure, as before.

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
| Hub link | `{ "label": "Architecture", "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0", "element": "web-app" } }` | A link to a version of a Hub resource. `element` is optional and selects a node or relationship |
| Screen link | `{ "label": "Releases", "screen": { "extension": "release-tracker", "screen": "releases", "params": { "releases.filter": "released" } } }` | A link to an extension screen, with an optional resource context and view parameters |

A link has a `label` and exactly one of `href`, `hub` or `screen`: a
[destination](extension-navigation.md#destinations). An `href` must start with `http://` or
`https://`. The UI shows a link that is not valid, such as a Hub link without one of its four
required fields, as plain text. A Hub or screen link shows **Back to &lt;page&gt;** on the page that it
opens (see [Return to the page](extension-navigation.md#return-to-the-page)).

#### Filter a table

Give the table an `id`, and give a stat a `filter` that names it. Hub then shows the table with a
result line, a **Clear filters** button and, with `search`, a text filter.

```json
{
  "hubApi": 0,
  "blocks": [
    { "type": "stats", "items": [
      { "label": "All architectures", "value": 6, "filter": { "table": "reviews" } },
      { "label": "Needs review", "value": 2, "filter": { "table": "reviews", "id": "needs-review", "column": "Status", "value": "Needs review" } },
      { "label": "Approved", "value": 3, "filter": { "table": "reviews", "id": "approved", "column": "Status", "value": "Approved" } }
    ] },
    { "type": "table", "id": "reviews", "columns": ["Architecture", "Owner", "Status"],
      "rows": [["Payments platform", "Payments", { "badge": "Needs review", "tone": "warning" }]],
      "search": { "label": "Filter by name or owner", "columns": ["Architecture", "Owner"] } }
  ]
}
```

| Field | Rule |
|---|---|
| Table `id` | Matches `^[a-z][a-z0-9-]{0,63}$`. Unique in the reply: a second table with the same `id` cannot be filtered |
| `filter.table` | The `id` of a table in the same reply. Otherwise the stat shows only its figure |
| `filter.id` | Names the filter, at most 100 characters. A stat without `id` shows all rows |
| `filter.column`, `filter.value` | For a table with `rows`: a row matches when the text of its cell in `column` is `value`. The text of a badge is its `badge`, and of a link its `label` |
| `search.label` | The label of the text filter. The default is "Filter rows" |
| `search.columns` | The columns that the text filter searches, without case. The default is all columns |

- The selected stat is pressed (`aria-pressed`). Press it again, or the stat without `id`, to show
  all rows.
- A tile filter and the search text combine: a row must match both.
- The stat `value` is the figure of the extension, for the whole dataset. Hub never changes it.
  The result line gives the rows that match, for example `1 of 6 rows · Needs review · "pay"`.
- `rows` must be the whole dataset: Hub filters them in the browser. For more rows than one reply
  can hold, use a `source`.

#### Load a table one page at a time

A table with a `source` gets its rows from a route of the extension, one page at a time. The route
filters the whole dataset. Hub never filters a page in the browser.

```json
{
  "hubApi": 0,
  "blocks": [
    { "type": "stats", "items": [
      { "label": "All deployments", "value": 23, "filter": { "table": "deployments" } },
      { "label": "Failed", "value": 4, "filter": { "table": "deployments", "id": "failed" } }
    ] },
    { "type": "table", "id": "deployments", "columns": ["Deployment", "Service", "Result"], "rows": [],
      "search": { "label": "Filter by deployment or service" },
      "source": { "route": "deployments", "pageSize": 5 } }
  ]
}
```

- `source.route` is the `id` of a `GET` route with `readOnly`. Hub refuses another route and
  shows "Table source route unavailable."
- `source.pageSize` is 1 to 100. The default is 20.
- Hub sends the context of the slot and these query parameters: `filter` (the `filter.id` of the
  selected stat, if there is one), `q` (the search text, if there is one), `page` (from 1) and
  `pageSize`. Hub sends `q` when typing stops.
- A stat filter for a table with a source needs only `table` and `id`.
- Hub shows `rows` only if it cannot read `source`, such as an older Hub.

The route returns one page and the number of rows that match. The blocks schema defines this reply
as `$defs/tableRowsReply`:

```json
{ "hubApi": 0, "rows": [["deploy-003", "api-gateway", { "badge": "failed", "tone": "negative" }]], "total": 4 }
```

Hub shows only the reply for the latest filters and page, and ignores a late reply. When a page
does not load, Hub keeps the filters and shows "The rows could not be loaded." with **Try again**.

#### Filters in the page address

On a `screen`, Hub keeps the filters of each table in the page address:
`<table id>.filter`, `<table id>.q` and `<table id>.page`, for example
`?reviews.filter=needs-review&reviews.q=pay`. Hub leaves out a default value. So Back from an
architecture, a reload and a shared link show the same rows. A filter change replaces the address,
so it adds no history entry.

The address holds at most 12 table keys for all the tables of a screen. A change that needs more
keeps the filters of that table in the page only, and the table shows "These filters are not kept
in the page address." A link or Back shows the filters of its address, not those in the page.

A `designer-tab` or a `detail-panel` keeps its filters in the page only, while the slot shows.

#### Refresh after a write

When an [action](extension-points.md#action) that is not `readOnly` succeeds, Hub loads each block
slot of that extension again, and each of its tables with a `source`. The filters stay. The earlier
reply shows until the new one comes. If the reload fails, Hub shows the earlier reply with "Could
not refresh. This shows the data from before." and **Try again**. A failed write does not reload.

### cards

```json
{ "type": "cards", "items": [{ "title": "2.4.0 rolling out", "subtitle": "order-service at 40%", "link": { "label": "Details", "href": "https://example.org/2.4.0" } }] }
```

Small cards. `subtitle` and `link` are optional. A `link` has the same rules as a table link.

### alert

```json
{ "type": "alert", "tone": "warning", "text": "Release 2.4.0 is rolling out." }
```

A message with a coloured background. `tone` is optional; the default is `info`. For when a landing
card shows it, see [landing-card](extension-points.md#landing-card).

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

### form

```json
{ "type": "form", "form": "review-node" }
```

A form that the extension declares in `contributes.form` (see
[form](extension-points.md#form)). Hub draws its fields and sends the input. The reply gives only
the form `id`, so a reply cannot change the fields or the target. A form shows in a `screen`,
`designer-tab` or `detail-panel`, not in a `landing-card`.

- In a `designer-tab` or `detail-panel`, the target is the open resource or the selected node.
- On a `screen`, a form with a `resource` or `element` target shows a target chooser: namespace,
  type, resource, version and, for `element`, node. A screen link with a context fills it.
- The input stays when the slot reloads, its section closes, or the user goes to another page in
  Hub. The browser asks before it leaves or reloads Hub with unsent input, or with a submission
  that may have been saved.
- A form that the manifest does not have, for example a write form on a read-only Hub, shows
  "This form is not available on this CALM Hub."

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
the screen. In the inspector beside the diagram they show in one or two columns.

## Errors and unknown blocks

An error stays in the slot of its extension. It does not break the Hub page around it.

| Case | The Hub UI shows |
|---|---|
| The call fails: no scope, the backend is down, or Hub returns `4xx` or `5xx` | "Extension request failed." |
| The reply has no `blocks` list, or its `hubApi` is not the manifest `hubApi` | "Extension request failed." |
| A block has an unknown `type` | "This screen has a block type that this CALM Hub cannot show." in place of that block. The other blocks show |
| A block that the UI cannot draw, for example a `table` with no `rows` | "This extension sent content that CALM Hub cannot show." in place of the whole contribution |
| A landing card call fails or has a bad reply | The card shows no headline |
| A reload after a write fails | The earlier reply, with "Could not refresh" and **Try again** |
| A table `source` names a route that is not a `GET` route with `readOnly` | "Table source route unavailable." in place of the table |
| A table `source` call fails, or its reply has no `rows` list or no whole `total` | "The rows could not be loaded." with **Try again**. The filters stay |

An unknown block type is not valid against the schema. Hub shows a placeholder, so that a newer
backend still works with an older Hub.

The CLI and MCP do not draw blocks. When a command names a block route, they return the reply JSON
as it is. For the errors that the proxy returns, see
[Calling an extension](index.md#calling-an-extension).
