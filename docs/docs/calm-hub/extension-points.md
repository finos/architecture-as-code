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
| [`search-provider`](#search-provider-and-chat) | Nothing yet | Any | — |
| [`chat`](#search-provider-and-chat) | Nothing yet | Any | — |
| [`commands`](#commands) | CLI and MCP | Any | Command input |

## Shared fields

Each extension point, except `decorator-views`, is a list of entries with these fields:

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
| `namespace` | The namespace of the open resource | `designer-tab`, `detail-panel`, `action` |
| `resource` | `<type>/<id>`, for example `architectures/1` or `patterns/2`. Not for a path | `designer-tab`, `detail-panel`, `action` |
| `resourceType` | `architectures` or `patterns` | `designer-tab`, `detail-panel`, `action` |
| `resourceId` | The resource id, for example `1` | `designer-tab`, `detail-panel`, `action` |
| `version` | The version on screen, for example `1.0.0` | `designer-tab`, `detail-panel`, `action` |
| `selectedElement` | The `unique-id` of the selected node | `detail-panel`, when you click a node. A link that names a node with `?node=<unique-id>` also sends it to `designer-tab` and `action`. A tab change clears a clicked selection |

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

- Hub calls only the first `landing-card` of an extension.
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

A button in the extension's section of the **Extensions** tab.

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
  when the section closes and opens again, and goes when the context changes.
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
