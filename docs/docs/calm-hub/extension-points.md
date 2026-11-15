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
| [`decorator-views`](#decorator-views) | Hub UI | No route | Decorators |
| [`diagram-lens`](#diagram-lens) | Hub UI | `GET` | Resource |
| [`search-provider`](#search-provider-and-chat) | Nothing yet | Any | — |
| [`chat`](#search-provider-and-chat) | Nothing yet | Any | — |
| [`commands`](#commands) | CLI and MCP | Any | Command input |

## Shared fields

Each extension point, except `decorator-views` and `diagram-lens`, is a list of entries with these fields:

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
| `selectedElement` | The `unique-id` of the selected node | `detail-panel`, when you click a node. A link that names a node with `?node=<unique-id>` also sends it to `designer-tab` and `action`. A tab change clears a clicked selection. `diagram-lens` gets it only when its route path names `{selectedElement}`, because the lens marks a selection with no request |

CALM Hub checks the format of a `{namespace}` or `{domain}` path value, and checks the route `scope`
against the value that the scope needs. It checks no other path value. A user can send any value,
so check that the user may see the data that you return (see [Extension access](extension-access.md#what-hub-checks)).

## screen

A full page. Its link shows in the **Extensions** group of the side menu, at
`/extensions/<extension id>/<screen id>`. The home page card of the extension opens its first
screen.

```json
"contributes": { "screen": [{ "id": "releases", "title": "Releases", "route": "screen" }] }
```

- The route returns [blocks](extension-blocks.md).
- A screen gets no context.

## designer-tab

Content in the **Extensions** tab of an architecture or a pattern. Each extension has a collapsible
section, with its actions first and then its designer tabs.

```json
"contributes": { "designer-tab": [{ "id": "releases", "title": "Releases", "route": "tab" }] }
```

- The route returns blocks.
- Hub opens the first section and closes the others. It keeps each choice in the browser. A closed
  section sends no request.
- The tab does not show for a document that you drop on the page, because it has no resource.
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
- An extension with a `screen` and no `landing-card` also gets a card, with no headline.

## detail-panel

Content in the **Extensions** section of the node details, when you click a node on the diagram.
Each extension has a collapsible sub-section.

```json
"contributes": { "detail-panel": [{ "id": "release", "title": "Release info", "route": "element" }] }
```

- The route returns blocks. `selectedElement` is the `unique-id` of the node.
- Hub calls the route again when you select another node.

## action

A button in the extension's section of the **Extensions** tab of an architecture or pattern. Actions show only there, not on the home page, so each call has a resource context.

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
  An action that needs only `{selectedElement}` shows disabled until a link names a node. It also shows disabled when Hub refuses the node id in a path, for example an id with `/`, `@` or `%`.
- An action does not accept user input, and Hub does not show its reply. A call in flight
  shows `<title>: running…`. A call that succeeds
  shows `<title>: done.`, and a failed call shows "Extension request failed." The message stays
  when the section closes and opens again. For a `readOnly` route, it goes when the context changes.
  For a write, it stays until the action runs again, and names its target when the context has
  changed, for example `Request release review: done (demo architectures/1 1.0.0).`
- A read-only Hub leaves out an action whose route changes data and is not `readOnly`.

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
    "scope": { "pattern": "^[A-Za-z0-9_.:/-]{1,128}$" }
  },
  "notation": "notation.json"
}]
```

| Field | Required | Rule |
|---|---|---|
| `id` | Yes | Lowercase letters, digits and `-`, starting with a letter. Unique in the extension. The URL names the lens with `?lens=<id>` |
| `title` | Yes | The name in the lens list |
| `description` | No | The tooltip in the lens list |
| `route` | Yes | A `GET` route, or a `POST` route with [`hubData`](extension-access.md#let-calm-hub-send-the-data). Its path can use only the parameters that a designer tab can fill |
| `appliesTo` | No | `resourceTypes`: `architectures`, `patterns` or both. The default is both |
| `params` | No | The view parameters of the lens, each with `values` or a `pattern`, and an optional `default`. CALM Hub keeps them in the URL and sends them in the query. `tab`, `lens`, `node`, `type`, `schema`, `q` and the context names are reserved |
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
- A `link` sets view parameters, opens a CALM Hub page or opens an `https` URL.
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

## search-provider and chat

CALM Hub accepts `search-provider` and `chat` entries in a manifest, with the shared fields. It
checks that each names a declared route, and lists them in `GET /api/calm/extensions`. The route
can use any method.

Nothing uses them yet: the Hub UI, the CLI and MCP do not call these routes. A client can call the
route through the proxy, as for any declared route.

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
