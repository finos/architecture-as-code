---
id: calm-hub-extension-navigation
title: Extension Navigation Reference
sidebar_label: Extension Navigation
sidebar_position: 4
---

# Extension Navigation Reference

A link in an extension reply names a **destination**, not a URL. CALM Hub maps the destination to
its own routes, so a link keeps working when the routes change. Blocks, search results and chat
citations use the same destination. For the blocks that hold links, see the
[extension blocks reference](extension-blocks.md).

## Destinations

A destination has exactly one of these fields. A block link also has a `label`.

| Field | Opens | Example |
|---|---|---|
| `href` | An external page, in a new tab. Only `http://` and `https://` | `{ "href": "https://example.org/runbook" }` |
| `hub` | A version of a Hub resource | `{ "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0", "element": "web-app" } }` |
| `screen` | A top-level extension screen | `{ "screen": { "extension": "release-tracker", "screen": "releases", "params": { "status": "released" } } }` |

The JSON Schema is `$defs/destination` (no label) and `$defs/link` (with a label) in
`GET /api/calm/extensions/schema/0/blocks.schema.json`. The UI shows a link that is not valid as
plain text.

### hub

| Field | Required | Rule |
|---|---|---|
| `namespace`, `type`, `id`, `version` | Yes | The exact resource and version. Not empty, `.` or `..` |
| `element` | No | The `unique-id` of a node or relationship. Hub selects it and opens its details. In a pattern, it is a node or relationship that the pattern declares, also as one choice of a `oneOf` or `anyOf` |
| `extension` | No | An extension id. Hub opens the section of that extension in the **Extensions** tab, and clears an extension filter that hides it. Each link, and Back or Forward to one, opens it again, also a link to the extension that is open |

When a plain URL, such as a catalogue link, opens the latest version of an architecture with a
timeline, Hub opens the current moment of the timeline. The URL of a Hub link has `exact=1`, so Hub
opens the version that the link names. A change of tab or lens keeps `exact=1` in the URL.

### screen

| Field | Required | Rule |
|---|---|---|
| `extension`, `screen` | Yes | The extension id and the `id` of its `screen` contribution |
| `context` | No | The resource that the screen is for: `namespace`, `type`, `id`, `version` and an optional `element` |
| `params` | No | View parameters of the screen, such as a filter, a sort order or a page |

The screen route gets `context` as the usual [context](extension-points.md#context) query
parameters: `namespace`, `resource`, `resourceType`, `resourceId`, `version` and
`selectedElement`. The screen shows the resource above its heading, with a link to it.

`params` holds two kinds of name:

| Kind | Name | Limits | Sent to the route |
|---|---|---|---|
| Screen parameter | `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, not a context name | At most 8. A value has at most 256 characters | Yes, in the query |
| Table state | `<table>.filter`, `<table>.q` or `<table>.page`, where `<table>` matches `^[a-z][a-z0-9-]{0,63}$` | At most 12. `filter` has at most 100 characters, `q` at most 200, and `page` is 2 to 10000 | No. Hub tables read it |

All of these stay in the screen URL. A change of a screen parameter loads the screen again. A
change of table state does not.

The screen route gets the context and the screen parameters in its query. Together they can have at
most 2048 characters when form-encoded. This is the budget for the extension's query inside Hub's
limit of 4096 bytes for the whole request line, which also holds the route path. A character outside
ASCII takes up to twelve encoded characters, so this budget can apply before the limit of 256
characters for each value. A namespace, type, id or version has at most 256 characters.

Each limit counts characters as Unicode code points, as JSON Schema `maxLength` does. An emoji is one
character.

### Links that Hub passes on

The schema bounds `params` only to 20 names in total. Hub checks the two counts and the query length
in code, as the UI does. A search result link and a chat citation go through the same check,
`ExtensionDestinations`, before Hub sends them on. Hub also drops a link to a namespace that the user
cannot read, and an `href` that a browser cannot open, such as one with a port above 65535. For a host
that is not a DNS name, such as one with `_`, Hub is stricter than a browser and drops the link.

## Return to the page

When a user follows a Hub or screen link, Hub keeps the page that they left as a **return point**.
The next page shows **Back to &lt;page&gt;** above its content. It opens that page with its query as it
was: the filters, sort and page of a list, or the tab, lens and selected node of an architecture.

- Hub keeps the return points in the browser history, not in the URL. Back, Forward and a refresh
  keep them. A copied link has none.
- Hub keeps the last 5 return points. A detailed-architecture link and a breadcrumb keep them.
- A link to the same page, such as a filter link of a screen or a lens node that links to the
  version that it shows, changes only the view. It keeps the return points and adds none.
- Back and Forward to an architecture or pattern page select the node that the user selected there
  again. Hub keeps that selection for each history entry in the session storage of the browser tab,
  not in the URL. A change of tab and a close of the details clear it. A change of lens on the page
  keeps it. A new visit to the same URL, such as a pasted link, is a new history entry and selects
  nothing. Back, Forward and a jump of more than one entry select only the node of the entry that
  they open, also between two entries at the same URL.
- A Hub link and a return to an architecture or a pattern open the exact version. Their URL has
  `exact=1`, so a copied link, a new tab and a refresh also open that version.
- The page name in **Back to** has at most 200 characters. Hub shortens a longer title.
- A return point holds only the page and its query. Form input and credentials are never in a URL,
  so they are never in a return point.
- The pages that make return points are extension screens, architecture and pattern pages, search
  results and chat.

## Unavailable destinations

A page shows what it can, and says what it cannot show.

| Case | The Hub UI shows |
|---|---|
| The resource or the version does not exist | "Architecture not found", with the return link |
| The element is not in the version | The architecture or pattern, and a notice that names the element |
| The extension is not enabled, or has no view for the resource | The page, and a notice that names the extension |
| The screen is not enabled, or the extension has no such screen | "Extension screen unavailable.", with the extension and screen ids |
| The screen link has an incomplete context, or too many parameters | A message. Hub does not call the screen route |

## Access

A link is not a permission. Hub checks access when each page loads: the namespace permissions for a
resource, and the route `scope` for a screen. A user can edit any value in a URL, so a screen route
must check that the user may see the data for the context that it gets (see
[Extension access](extension-access.md#what-hub-checks)). An extension that returns links to other
namespaces must also check that the user may read them, because a link shows its label.
