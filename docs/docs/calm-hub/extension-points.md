---
id: calm-hub-extension-points
title: Extension Point Reference
sidebar_label: Extension Points
sidebar_position: 3
---

# Extension Point Reference

An extension manifest lists its extension points in `contributes`, and its CLI and MCP commands in
`commands`. This page gives each one. For a full example, follow the
[extension tutorial](../tutorials/advanced/hub-extension.md). For the settings, see
[Extensions](index.md#extensions).

| Extension point | Used by | Route method | Context |
|---|---|---|---|
| [`screen`](#screen) | Hub UI | `GET` | None |
| [`designer-tab`](#designer-tab) | Hub UI | `GET` | Resource |
| [`landing-card`](#landing-card) | Hub UI | `GET` | None |
| [`detail-panel`](#detail-panel) | Hub UI | `GET` | Resource and node |
| [`action`](#action) | Hub UI | Any | Resource |
| [`form`](#form) | Hub UI, in a `form` block | `POST`, `PUT` or `PATCH` | None, resource, or resource and node |
| [`decorator-views`](#decorator-views) | Hub UI | No route | Decorators |
| [`diagram-lens`](#diagram-lens) | Hub UI | `GET` | Resource |
| [`search-provider`](#search-provider) | Hub UI search | `POST`, `readOnly` | The query |
| [`chat`](#chat) | Hub UI, one chat that the operator chooses | `POST` | A resource, only when the user shares it |
| [`commands`](#commands) | CLI and MCP | Any | Command input |

## Shared fields

Each extension point, except `decorator-views`, `diagram-lens` and `form`, is a list of entries with these fields:

| Field | Required | Rule |
|---|---|---|
| `id` | Yes | Lowercase letters, digits and `-`, starting with a letter. Unique in its extension point |
| `title` | Yes | The label that the UI shows. It is the heading of the slot. A blocks reply `title` shows under it |
| `route` | Yes | The `id` of a route in `routes` |

CALM Hub does not start if an entry names a route that is not declared, or if a `screen`,
`designer-tab`, `landing-card` or `detail-panel` names a route that is not `GET`.

The UI calls the route through `/api/calm/extensions/<id>/api/<path>`, with the caller's
credentials. The route `scope` decides who can call it (see
[Extension access](extension-access.md)). A user who does not have the scope sees the
contribution, but the call fails.

### Context

The UI sends the context as query parameters. A route path can also use these names as
placeholders, for example `/namespaces/{namespace}/{resourceType}/{resourceId}`. A placeholder
value must not be empty or `.`, or contain `..`, `/`, `\`, `%`, `@`, a look-alike of `/`, `\`, `.`, `%`,
`@` or `;`, a code point whose NFKC form contains `/` or `\` (such as U+2100, `a/c`), a control character or a lone surrogate, because CALM Hub refuses these in a path. A context value must
not contain a control character or a lone surrogate, because the UI sends it in the query. The UI
hides an action whose path gets such a value. Thus use `resource` only as a query parameter.

| Parameter | Value | Sent to |
|---|---|---|
| `namespace` | The namespace of the open resource | `designer-tab`, `diagram-lens`, `detail-panel`, `action` |
| `resource` | `<type>/<id>`, for example `architectures/1` or `patterns/2`. Not for a path | `designer-tab`, `diagram-lens`, `detail-panel`, `action` |
| `resourceType` | `architectures` or `patterns` | `designer-tab`, `diagram-lens`, `detail-panel`, `action` |
| `resourceId` | The resource id, for example `1` | `designer-tab`, `diagram-lens`, `detail-panel`, `action` |
| `version` | The version on screen, for example `1.0.0` | `designer-tab`, `diagram-lens`, `detail-panel`, `action` |
| `selectedElement` | The `unique-id` of the selected node or relationship | `designer-tab` and `action`, when you select an element or a link names one with `?node=<unique-id>`. `detail-panel`, for a selected node only. A change of tab or version clears a clicked selection. `diagram-lens` gets it only when its route path names `{selectedElement}`, because the lens marks a selection with no request |

CALM Hub checks the format of a `{namespace}` or `{domain}` path value, and checks the route `scope`
against the value that the scope needs. It checks no other path value. A user can send any value,
so check that the user may see the data that you return (see [Extension access](extension-access.md#what-hub-checks)).

## screen

A full page, at `/extensions/<extension id>/<screen id>`. An extension can have more than one
screen. Declare them in one manifest, not as one extension for each screen, so that they show
together under the extension `name`.

```json
"contributes": {
  "screen": [
    { "id": "releases", "title": "Releases", "route": "screen" },
    { "id": "calendar", "title": "Release calendar", "route": "calendar" }
  ]
}
```

- The route returns [blocks](extension-blocks.md).
- From the menu or the home page, a screen gets no context. A
  [screen link](extension-navigation.md#screen) can give it a resource context and view
  parameters. The route gets them in the query.
- The side menu has a group for each extension that has a screen, with the extension `name` as its
  label and a link to each screen. The home page card of the extension has the same links.
- The menu and the home page show the extensions in the order of `calm.extensions."<id>".order`, and
  the screens in the order of the manifest. Two extensions can use the same screen `title`: each
  link is in the group of its extension.
- The page address keeps the filters of its tables, so Back, a reload and a link show the same rows
  (see [Filters in the page address](extension-blocks.md#filters-in-the-page-address)).

## The inspector

Actions, designer tabs and detail panels show in the **inspector** beside the diagram of an
architecture or a pattern. Open it with the **Details & extensions** handle on the right edge of the
diagram. The handle has its own rail and does not cover view controls. On a wide screen, a click on a node also opens it, and the close button closes it. On a narrow screen, it fills the screen, and **Back to diagram** or Escape closes it.
The diagram, its viewport and the selection stay when the inspector opens and closes.

The inspector has one view menu, with **Details** first. Each extension name groups its resource
views (`designer-tab`), then its node views (`detail-panel`), in manifest order within each kind.
The menu has a filter when there are more than five extension views. Select one view at a time;
the extension's actions stay above it. An extension with only actions has an **Actions** entry.
The chosen view of each extension stays in memory while the inspector is mounted, not in the URL.

- With no selection, the inspector shows the whole resource. **Clear selection** goes back to it.
- A view sends no request until it shows. A view that you leave, and a closed inspector,
  keep their state and send no request. They load again when they show, if the context changed or an
  action changed their data.
- When the selection changes, the visible view loads again. It shows "Loading" until the new reply, not
  the data of the element that you selected before.
- A view that fails shows its error and **Try again** in its own section. The other views stay.
- The inspector shows no extension for a document that you drop on the page, because it has no
  resource.
- A link opens the inspector on an extension with `?extension=<extension id>`, or on the first
  extension with `?extension=`. A fresh load shows its first view. Hub changes an old `?tab=extensions` link to `?extension=`, and keeps
  the other parameters, such as `node`.

## designer-tab

A view of the resource in the [inspector](#the-inspector).

```json
"contributes": { "designer-tab": [{ "id": "releases", "title": "Releases", "route": "tab" }] }
```

- The route returns blocks. It gets the selected node or relationship, if there is one.
- The UI hides a designer tab whose route path needs a placeholder other than `namespace`,
  `resourceType`, `resourceId`, `version` and `selectedElement`, such as `{resource}`. CALM Hub logs a
  warning for such a tab at start up.

## landing-card

A compact card in the **Extensions** section of the home page.

```json
"contributes": { "landing-card": [{ "id": "health", "title": "Release health", "route": "card" }] }
```

- Hub calls only the first `landing-card` of an extension whose route path has no placeholder.
- The card shows the extension `name` and `provider`, and a headline from the reply: the first
  three valid items of the first `stats` block. A valid item has a string `label` and a string or number
  `value`. Hub ignores other items. If a card cannot render, it shows an error and the other cards stay.
  With no valid item in the first `stats` block, it shows the text of the first
  `alert` block, on one line. Hub does not show other blocks on the card.
- A card gets no context. If the call fails, the card shows no headline.
- Under the headline, the card has a link to each [screen](#screen) of the extension. A card with
  no screen has no link.
- An extension with a `screen` and no `landing-card` also gets a card, with no headline.

## detail-panel

A view of the selected node in the [inspector](#the-inspector). With no node selected, the panel
shows its title and a hint to select a node.

```json
"contributes": { "detail-panel": [{ "id": "release", "title": "Release info", "route": "element" }] }
```

- The route returns blocks. `selectedElement` is the `unique-id` of the node.
- Hub calls the route again when you select another node.

## action

A button in the extension's section of the [inspector](#the-inspector). Actions show only there, not on the home page, so each call has a resource context.

```json
"routes": [{ "id": "request-review", "method": "POST", "path": "/reviews", "scope": "authenticated" }],
"contributes": { "action": [{ "id": "request-review", "title": "Request release review", "route": "request-review" }] }
```

- The route can use any method. For a method other than `GET` and `DELETE`, the context also goes
  in the JSON body.
- Hub asks the user to confirm when the route is not `readOnly`. The dialog shows the namespace,
  resource, version and element that the call will send. These are the values at the time of the
  click, also when the page changes before the user confirms. Cancel has the focus when the dialog
  opens, so Enter does not run the call.
- Hub does not cancel a confirmed call when the user changes the selection or leaves the page. The
  button stays disabled until the call ends, also when its section closes and opens again.
- The action shows only when the context gives a value for each placeholder in the route path.
  An action that needs only `{selectedElement}` shows disabled, with a hint, until you select a node. It also shows disabled when Hub refuses the node id in a path, for example an id with `/`, `@` or `%`.
- An action does not accept user input, and Hub does not show its reply. For user input, use a
  [form](#form). A call in flight
  shows `<title>: running…`. A call that succeeds
  shows `<title>: done.`, and a failed call shows "Extension request failed." The message stays
  when the section closes and opens again. For a `readOnly` route, it goes when the context changes.
  For a write, it stays until the action runs again, and names its target when the context has
  changed, for example `Request release review: done (demo architectures/1 1.0.0).`
- A read-only Hub leaves out an action whose route changes data and is not `readOnly`.

## form

A form that Hub draws from the manifest. A `screen`, `designer-tab` or `detail-panel` reply places
it with a [`form` block](extension-blocks.md#form). No extension code runs in the browser.

```json
"routes": [{ "id": "review-node", "method": "POST", "path": "/forms/reviews", "scope": "authenticated" }],
"contributes": {
  "form": [{
    "id": "review-node",
    "title": "Request a node review",
    "route": "review-node",
    "target": "element",
    "submitLabel": "Request review",
    "fields": [
      { "id": "reviewType", "type": "choice", "label": "Review type", "required": true,
        "options": [{ "value": "security", "label": "Security" }, { "value": "cost", "label": "Cost" }] },
      { "id": "note", "type": "multiline", "label": "What to check", "required": true, "minLength": 10, "maxLength": 500 },
      { "id": "days", "type": "number", "label": "Due in days", "integer": true, "minimum": 1, "maximum": 30, "default": 5 },
      { "id": "urgent", "type": "checkbox", "label": "Urgent" }
    ]
  }]
}
```

| Field | Required | Rule |
|---|---|---|
| `id`, `title`, `route` | Yes | As the [shared fields](#shared-fields). The route must be `POST`, `PUT` or `PATCH`, without `hubData`. Only this form can name it |
| `description` | No | Shows under the title |
| `target` | No | `none` (the default), `resource` or `element`. A route path can use only the [context](#context) names that the target gives: none, `namespace`, `resourceType`, `resourceId` and `version`, and also `selectedElement` for `element` |
| `submitLabel` | No | The label of the send button. The default is `Submit` |
| `fields` | Yes | 1 to 20 fields |

Each field has an `id` (a letter, then up to 63 letters, digits, `_` or `-`), a `type` and a
`label`. `help`, `required` and `default` are optional. The other rules depend on the type:

| Type | Control | Rules | Hub sends |
|---|---|---|---|
| `text` | One line | `minLength`, `maxLength`, at most 1000 | A string with no control character |
| `multiline` | A text area | `minLength`, `maxLength`, at most 10000 | A string. Tab and line breaks are allowed |
| `number` | A number box | `minimum`, `maximum`, `integer` | A JSON number. With `integer`, a whole number from -9007199254740991 to 9007199254740991, the range that JavaScript holds exactly. The limits and the `default` must be in this range too. Each limit and `default` must be the number that JavaScript writes for it, so that the UI and CALM Hub check one number: CALM Hub refuses `0.30000000000000001`, which JavaScript writes as `0.3`, and `4.9e-324`, which it writes as `5e-324` |
| `choice` | A list | `options`: 1 to 50 `{ value, label }`, each value once | One of the option values |
| `checkbox` | A check box | None. `required` means the box must be ticked | `true` or `false` |

CALM Hub does not start if a form breaks these rules, for example a rule that does not fit its
type, a `minimum` above the `maximum`, or a `default` that the field refuses.

### What the backend gets

The UI sends the form to `POST /api/calm/extensions/<id>/forms/<form>`, not through the generic
proxy. Hub checks the target and the input with the rules of the manifest, then calls the form
route with this body:

```json
{
  "submission": "6f1c1d0e-3b0a-4c43-9d6c-2b0a8f8d1a10",
  "context": { "namespace": "demo", "resource": "architectures/1", "resourceType": "architectures", "resourceId": "1", "version": "1.0.0", "selectedElement": "database" },
  "input": { "reviewType": "security", "note": "Check the failover", "days": 5, "urgent": false }
}
```

- `input` holds only the declared fields that have a value, in field order. User input never goes
  in `context`, in the path or in the query.
- `context` is the target. Hub derives `resource`. A `none` form gets `{}`. The UI keeps the
  target that the user started to edit: when the selection changes, the form names both targets
  and asks before it sends to the new one. On a `screen`, the user chooses the target. A screen
  link with a context fills the choice.
- The route `scope`, `readOnly`, the confirmation dialog, the audit record and the limit of calls in
  flight are the same as for an [action](#action). A read-only Hub refuses a form whose route is not
  `readOnly`.
- A command or another contribution cannot name a form route, and the generic proxy refuses it
  with `404`. Thus the CLI, MCP and other clients cannot skip these checks.

### Replies

Reply `2xx` only when the backend saved the input. The UI shows `message` from a JSON reply. For a
route that is not `readOnly`, it then loads the other contributions of the extension again.

| Reply | The UI shows | Input |
|---|---|---|
| `2xx` | "Sent", and `message` | Cleared |
| `4xx`, with `title` or `error`, and `detail` | "Not saved", and the message | Kept |
| `422` with `fields`, for example `{ "fields": { "note": "Name the release." } }` | Each message on its field | Kept |
| `5xx`, a timeout, or no reply | "It may have been saved". The button changes to **Send again** | Kept |

Hub sets the `Calm-Extension-Dispatch` header on each reply: `not-sent` when Hub refused the call,
`sent` for a backend reply, and `unknown` when the backend failed or did not reply in time. A
backend cannot set it. A **Send again** with the same input and target keeps the `submission`
id. Use it to find a duplicate, and reply as for the first submission. While the outcome is unknown,
the form does not send changed input or another target. The user can change the input back, or
check the backend and then forget the earlier submission. After that, the changed input gets a new
id. If Hub refuses a **Send again** before it sends it, for example because the extension is busy,
the outcome of the first send stays unknown and the id stays the same. Hub never sends a form again
by itself.

## decorator-views

Badges and legend rows on the diagram, drawn from decorators. A decorator view has no route and no
backend.

```json
"contributes": {
  "decorator-views": [{
    "id": "release-risk",
    "match": { "type": "release-risk" },
    "label": "Release risk",
    "overlay": { "status": "/risk", "map": { "low": "ok", "medium": "warn", "high": "error" }, "default": "info", "label": "/summary" }
  }]
}
```

See [Decorator views](decorator-views.md) for the fields and the built-in views.

## diagram-lens

Another picture of the architecture on the **Diagram** tab, such as a C4 or an
ArchiMate® view. The lens shows in the lens list of the tab, under
**Extensions**, with the extension name. Its route returns a graph, and CALM
Hub lays it out and draws it with the shapes of the lens **notation**. No
extension code runs in the browser. The
[C4 extension](https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions/c4)
is a full example, with its manifest, notation and service. The
[ea-layers extension](https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions/ea-layers)
is a smaller one, in the ArchiMate® notation.

```json
"diagram-lens": [{
  "id": "c4", "title": "C4", "route": "lens",
  "appliesTo": { "resourceTypes": ["architectures"] },
  "params": {
    "level": { "values": ["context", "container", "component", "deployment"], "default": "context" },
    "scope": { "pattern": "^[^\\p{Cc}]{1,128}$" }
  },
  "notation": "notation.json"
}]
```

| Field | Required | Rule |
|---|---|---|
| `id` | Yes | Lowercase letters, digits and `-`, starting with a letter. Unique in all enabled extensions, and not `calm` or `json`, which are the lenses of CALM Hub. The URL names the lens with `?lens=<id>` |
| `title` | Yes | The name in the lens list |
| `description` | No | The tooltip in the lens list |
| `route` | Yes | A `GET` route, or a `POST` route with [`hubData`](extension-access.md#let-calm-hub-send-the-data). Its path can use only the parameters that a designer tab can fill |
| `appliesTo` | No | `resourceTypes`: `architectures`, `patterns` or both. The default is both |
| `params` | No | The view parameters of the lens, each with `values` or a `pattern`, and an optional `default`. A `pattern` is a regular expression in Unicode mode, so a class such as `\p{Cc}` works. CALM Hub keeps them in the URL and sends them in the query. `tab`, `lens`, `node`, `extension`, `exact`, `type`, `schema`, `q` and the context names are reserved |
| `notation` | Yes | The name of a JSON file in the extension folder, next to `extension.json`, with the shapes, edge markers and styles. See below |

### Notation

The notation file ships with the extension. CALM Hub checks it against
`GET /api/calm/extensions/schema/0/notation.schema.json` when it starts, and
does not start if it is missing or not valid. The UI reads it from
`GET /api/calm/extensions/<id>/lenses/<lens>/notation` when the lens first
opens.

```json
{
  "shapes": { "Person": { "viewBox": [0, 0, 200, 220], "parts": [ … ], "slots": { … } } },
  "styles": { "elements": [{ "tag": "Person", "shape": "Person", "background": "#08427b", "color": "#ffffff" }] }
}
```

| Part | Content |
|---|---|
| `shapes` | Your shapes. A `viewBox`, and `parts`: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline` or `polygon`. A part paints with `background`, `stroke`, `color`, `accent`, `none` or a hex colour, and can be `pin`ned to a corner so that it keeps its size. `resize` is `stretch`, `aspect` or `nine-slice` with `insets`. `slots` are boxes for the `label`, `metadata`, `description`, custom `fields`, or a `list` of `sections`. `ports` are `outline` or named points |
| `markers` | Your edge ends, drawn pointing right |
| `styles` | `elements`, `relationships` and `groups`, each keyed by `tag`. Styles apply in order, and a later style overrides what it sets. An element style sets `shape`, `background`, `color`, `stroke`, `accent`, `strokeWidth`, `border`, `opacity`, `icon`, `metadata`, `description`, a `label` for the diagram key, and `dark` colours. A relationship style sets `color`, `thickness`, `style`, `routing`, `start` and `end` markers |

Every notation can also name the shapes and markers of the **core notation** of
CALM Hub (`GET /api/calm/extensions/notations/core`): the shape `Box`, and the
markers `arrow`, `open-arrow`, `hollow-triangle`, `diamond`, `hollow-diamond`,
`dot` and `hollow-dot`. Use `core/<name>` when your notation has its own shape
or marker with that name. A shape has no text, image, link, style sheet or filter: text
goes in slots, and an `icon` is a `data:` PNG, JPEG or SVG image up to 32 KB.

### The reply

The route returns JSON that matches
`GET /api/calm/extensions/schema/0/lens.schema.json`:

```json
{
  "hubApi": 0, "kind": "graph", "layout": { "algorithm": "layered", "direction": "down" },
  "graph": {
    "groups": [{ "id": "shop", "label": "Shop", "tags": ["Boundary"] }],
    "nodes": [
      { "id": "customer", "label": "Customer", "tags": ["Person"], "calm": ["customer"] },
      { "id": "api", "label": "Orders API", "metadata": "[Container: Java]", "tags": ["Container"], "group": "shop",
        "calm": ["orders-api"], "link": { "params": { "level": "component", "scope": "api" } } }
    ],
    "edges": [{ "id": "e1", "source": "customer", "target": "api", "label": "Places orders" }]
  },
  "controls": [{ "type": "segmented", "param": "level", "items": [{ "value": "context", "label": "Context" }] }],
  "panels": [{ "title": "Notes", "blocks": [{ "type": "alert", "tone": "warning", "text": "…" }] }]
}
```

- `tags` choose the styles of a node, an edge or a group.
- `calm` names the CALM `unique-id`s that the element stands for. A click
  selects the first one on the CALM diagram.
- A `link` sets view parameters, opens a CALM Hub page or opens an `https` URL. A link to a CALM
  Hub page shows **Back to &lt;page&gt;** on that page.
- A control can name its `value`: the value that the reply was drawn with,
  when the request named none. For example, the C4 service draws the first
  system when the URL names no `scope`, and its list shows that system.
- `layout` is `layered`, `tree`, `radial`, `force`, `stress`, `rectpacking`,
  `box`, or `fixed` with a `position` on each node.
- A reply has at most 500 nodes, 2,000 edges and 200 groups.

CALM Hub checks the reply before it lays it out. A reply that is not valid, or
that has a control for a parameter that the lens does not declare, shows the
first fault in the lens. A `4xx` reply with `application/problem+json` shows
its `title` and `detail`. When CALM Hub draws the graph:

- A part with no `fill` is not filled. A part with no `stroke` uses the
  `stroke` of the style.
- A `grow` slot and each `list` slot take the height of their text, and the
  shape grows inside the band of that slot. An `aspect` shape does not grow.
- A shape with a slot named `icon` shows the `icon` of the style there. Other
  shapes show it at the top left.
- An edge with no `end` in its style ends with `arrow`. Set `"end": "none"`
  for an edge with no end, such as an association. Its `technology` shows
  in brackets under the `label`.
- `fixed` positions are in pixels, and each group fits around its members.
  An edge to a group, and an edge with `direct` routing, is a straight line.
- A click on a node follows its `link` and selects its first `calm` id. A link
  can set only the parameters that the lens declares, with allowed values.
- A click on an entry of the diagram key dims the elements with that tag.

## search-provider

Adds a group of results from the extension to the CALM Hub search page. The page shows the
catalogue results first, then one group for each provider, with the entry `title` as its heading.

```json
"routes": [{ "id": "search", "method": "POST", "path": "/search", "scope": "authenticated", "readOnly": true }],
"contributes": { "search-provider": [{ "id": "releases", "title": "Releases", "route": "search" }] }
```

The route must be a `readOnly` `POST` with no path parameters and no `hubData`. Only CALM Hub calls
it, through `GET /api/calm/extensions/<id>/search/<provider>?q=<query>&cursor=<cursor>`. The generic
proxy and MCP get `404` for this route, and CALM Hub does not start if a command or another entry
also names it. Thus a caller cannot skip the checks below. The search endpoint is a `GET`, so it
also works on a read-only Hub.

CALM Hub sends this body:

| Field | Value |
|---|---|
| `hubApi` | The `hubApi` of the manifest |
| `query` | The search text: 1 to 200 characters, with no control characters |
| `limit` | `10`. A reply with more results is not valid |
| `cursor` | The `next` value of the page before. Not sent for the first page. It comes from the browser, so check it |

The provider replies `200` with this body:

```json
{
  "hubApi": 0,
  "results": [{
    "id": "2.4.0",
    "title": "Release 2.4.0",
    "summary": "order-service at 40%",
    "namespace": "demo",
    "link": { "hub": { "namespace": "demo", "type": "architectures", "id": "1", "version": "1.0.0" } }
  }],
  "next": "10"
}
```

| Field | Required | Rule |
|---|---|---|
| `hubApi` | Yes | The `hubApi` of the manifest |
| `results` | Yes | At most 10 results |
| `next` | No | The cursor of the next page. It must fit in the request for the next page (see below). Leave it out on the last page |
| `id` | Yes | Unique in the results, at most 256 characters |
| `title` | Yes | At most 300 characters. It is the text of the link |
| `summary` | No | At most 1000 characters |
| `namespace` | No | The CALM Hub namespace of the record |
| `link` | No | A [destination](extension-navigation.md#destinations) without a label: an `href`, a `hub` page or an extension `screen`. The `title` is its text |

A length counts Unicode code points, as JSON Schema `maxLength` does, so an emoji is one character.

The UI sends `next` back in the URL of the request for the next page,
`GET /api/calm/extensions/<id>/search/<provider>?q=<query>&cursor=<next>`. That request line can
have at most 3584 bytes. CALM Hub counts the path, the query and the cursor. Each UTF-8 byte other
than `A`–`Z`, `a`–`z`, `0`–`9`, `-`, `.` and `_` counts as three, because it can be
percent-encoded, so '𝄞' counts as 12. A `next` that does not fit, or that has a lone surrogate, makes
the reply not valid: CALM Hub does not drop `next` and show part of the results. A cursor of at most
512 characters from that set, such as base64url without padding, fits with any query when the
extension id and the provider id together have at most 600 characters. A request that is too long
gets `400`.

CALM Hub checks each result, and leaves out a result:

- that is not valid, or has the same `id` as a result before it. A `link` must pass the
  [destination checks](extension-navigation.md#links-that-hub-passes-on), the same as the UI;
- whose `namespace`, `hub.namespace` or `screen.context.namespace` is not a namespace that the
  caller can read.

It copies only the fields above. If it leaves out all the results of a page, it also leaves out
`next`, so that the page does not show that hidden results exist. A record with no namespace gets
no check from CALM Hub: the provider must return only the records that `sub` may see (see
[What Hub checks](extension-access.md#what-hub-checks)).

Each provider loads on its own, so a slow or failed provider does not hold back the catalogue or
the other providers:

| Reply | The search page shows |
|---|---|
| Not `200` | "… search failed", with **Try again**. The endpoint returns `502` |
| A body that is not valid, or a `next` that does not fit | The same. The endpoint returns `502` |
| No reply in the extension `request-timeout-seconds` | "… did not reply in time", with **Try again**. The endpoint returns `504` |
| No results | "No results from …" |
| `next` | **Show more**, which gets the next page. The page shows at most 50 results from one provider |

The heading of a group gives the number of results that it shows, with `+` when there are more.
It gives no total, because only the provider knows its records, and CALM Hub can leave some out.
A reply for an earlier query is dropped. A provider result and a catalogue result both record the
search page as the [return point](extension-navigation.md#return-to-the-page), so the page that
opens shows **Back to search results**.

## chat

A `chat` entry adds a chat page to the Hub UI, at `/chat`. The operator chooses one chat for the
CALM Hub with `calm.extensions.chat-provider`: `<extension-id>`, or `<extension-id>/<entry-id>`
when the extension has more than one `chat` entry. With no setting, the UI shows no chat. CALM Hub
does not start if the setting does not name a `chat` entry of an enabled extension.

Several enabled extensions can declare chat entries, but the UI exposes only the one entry that
the operator selects. Users cannot switch assistants, and the UI does not send a question to
multiple chat providers. This differs from search, which queries all enabled `search-provider`
entries independently.

Submitting a search starts a fresh conversation with the selected assistant in parallel with catalogue
and extension search. Typing and empty searches send no chat request. Opening or reloading a nonempty
search URL also asks the assistant. The answer appears above ordinary results; a slow or failed reply
does not block them. **Show more / Show less** expands a long answer without another request.
Follow-ups keep the same conversation. Returning from a citation keeps the current answer and draft;
submitting another search, even the same query, starts fresh. Back and Forward do not resend a query
or discard the current conversation or draft. If that conversation belongs elsewhere, the search page
offers **Ask** to start a new one. A change of the configured chat provider also requires an explicit
submission before it receives the query. Only the current conversation stays in memory, and a reload
clears it. Search queries are in the URL; follow-up drafts are not.

Search sends only the query, never a previous conversation or an architecture. The UI names the
recipient before submission and warns that provider charges and retention policies apply. The menu,
extension card and Details pane also link to `/chat`, where the user can choose to share an offered
architecture. The extension keeps its model and credentials. CALM Hub and the UI send it no user token.

The route must be a `readOnly` `POST` with no path parameters and no `hubData`. No other entry
and no command can name it. The UI sends each message to
`POST /api/calm/extensions/<id>/chat/<entry>`. The proxy and MCP refuse the route with `404`, so
CALM Hub always checks what goes to the route and what comes back. Because the route is
`readOnly`, the chat works on a read-only CALM Hub, and CALM Hub does not audit it.

### Chat request

CALM Hub checks the message and builds the body that the route gets. It drops other fields.

```json
{
  "hubApi": 0,
  "conversationId": "c7k2m9",
  "messageId": "m4",
  "messages": [
    { "role": "user", "content": "Which services does this architecture use?" }
  ],
  "context": {
    "namespace": "finos",
    "resourceType": "architectures",
    "resourceId": "1",
    "version": "1.0.0",
    "selectedElement": "api-gateway",
    "document": { "nodes": [] }
  }
}
```

| Field | Rule |
|---|---|
| `conversationId`, `messageId` | 1 to 64 letters, digits, `_` or `-`. A retry sends the same `messageId` again |
| `messages` | 1 to 100 messages, oldest first. Each has the `role` `user` or `assistant`, and `content` of 1 to 16000 characters. The last message is from the user |
| `context` | Only when the user selects **Share** for the resource that they came from. CALM Hub gives `403` if the user cannot read the namespace, and `404` if the version does not exist. It adds the document of that version as `document`. `selectedElement` is the node that was selected, if any |

The body must not be larger than `max-request-bytes`, or the UI gets `413`. The UI keeps the
conversation in the browser tab only, and sends all of it with each message. A reload or
**New conversation** starts again. CALM Hub and the UI store no history. A failed reply is not
sent again as history.

### Chat reply

The route replies with `text/event-stream`. CALM Hub gives `502` for a `2xx` reply of another type.
A `4xx` JSON reply goes to the UI, which shows its `message` or `error`.

| Event | Data | UI |
|---|---|---|
| `delta` | `{"text": "..."}` | Adds the text to the reply |
| `citation` | A [link](extension-navigation.md): a `label` of at most 200 characters and exactly one destination, `href`, `hub` or `screen` | Shows a link under the reply. A Hub or screen link opens in Hub, with **Back to** the chat |
| `done` | `{}` | Ends the reply |
| `error` | `{"message": "..."}` | Ends the reply as failed, with **Retry** |

- CALM Hub sends each event on when it arrives, with only its `event` and `data` lines. It drops
  `id` and `retry`, so the browser never connects to the extension again by itself.
- CALM Hub drops a `citation` that is not valid, or that names a namespace that the user cannot
  read: the `hub` namespace, or the namespace of the `screen` context. It uses the same check as
  for a [link that Hub passes on](extension-navigation.md#links-that-hub-passes-on).
- CALM Hub ends the stream with an `error` event when the backend is silent for
  `stream-idle-timeout-seconds`, when the stream is open for `max-stream-seconds`, or when the
  reply is larger than `max-response-bytes`. It sends a comment line every 5 seconds while the
  backend is silent.
- **Stop** keeps the partial reply and closes the stream. CALM Hub then closes the connection to
  the backend. **Retry** sends the same question again with the same `messageId`.

The [example backend](https://github.com/finos/architecture-as-code/blob/main/calm-hub/local-dev/extensions/example-services/server.mjs)
has a chat route with no model.

## commands

Commands that the CLI and MCP can run, keyed by name. The name uses lowercase letters, digits and
`-`, starting with a letter.

```json
"commands": {
  "list-services": {
    "route": "namespace-services",
    "description": "List the services that a namespace owns",
    "input": { "type": "object", "properties": { "namespace": { "type": "string" } }, "required": ["namespace"] },
    "output": { "type": "object", "properties": { "services": { "type": "array", "items": { "type": "string" } } } },
    "destructive": false,
    "idempotent": true
  }
}
```

| Field | Required | Rule |
|---|---|---|
| `route` | Yes | The `id` of a declared route |
| `description` | Yes | The help text in the CLI and the MCP tool description |
| `input` | Yes | A JSON Schema of `type: object`. Each placeholder in the route path must be a required property |
| `output` | No | A JSON Schema of the reply. MCP returns it as structured content |
| `destructive`, `idempotent` | No | MCP hints. With no hint, a write is destructive and not idempotent |

- The CLI runs a command with `calm hub ext <id> <command>`. List and describe commands with
  `calm hub extensions list` and `calm hub extensions describe <id> [command]`. See
  [Running extension commands](../calm-cli/hub.md#running-extension-commands).
- With `calm.mcp.enabled=true`, each command is the MCP tool `ext_<id>_<command>`. CALM Hub does
  not start if the name has more than 64 characters, also with MCP off. The schemas must use the subset in
  [Extension tools](mcp-and-api.md#extension-tools), or the command gets no tool.
- Input properties that match a placeholder fill the path. The others go to the query for `GET` and
  `DELETE`, and to the JSON body for other methods.
- For an MCP tool, CALM Hub first maps the input to a request. It refuses a path value that it does
  not accept, a path that matches another route, and a query or path that is too long. Then it
  checks the scope, and then the input against `input`, before it calls the backend. The CLI calls the route through the REST proxy, and CALM Hub does not check the input
  there. Thus the backend must check its input.
- A read-only Hub leaves out a command whose route changes data and is not `readOnly`.

---

ArchiMate is a registered trademark of The Open Group in the United States and other countries.
