# ADR 0013: Extension UI is tiered, with Hub-rendered blocks by default

**Status**: Accepted. Built (#3708, #3709, #3713): the seven block types, decorator views
and the blocks schema. Built (#3771): diagram lenses. Built (#3798, #3801): declarative forms, tile filters, read-only table queries and a refresh after a confirmed write. Built (#3802): the `search-provider` contract and its group on the search page. Built (#3800): `designer-tab`, `action` and `detail-panel` show in the inspector beside the diagram, not in a tab of their own. Not built: the iframe tier.

## Context

[#3396](https://github.com/finos/architecture-as-code/issues/3396) proposes UI
extension points: `screen`, `designer-tab`, `landing-card`, `detail-panel`,
`action`, `search-provider` and `chat`. The issue left open how Hub UI loads
extension UI: Module Federation, import maps, web components, or a module that
exports `mount(element, context)`.

Facts that decide it:

- Platforms that share their runtime with extensions pay in version coupling.
  Kibana requires an exact version match. JupyterLab warns that extensions may
  break with new releases. Grafana plugins inherit the host's `@grafana`
  packages. Grafana added a frontend sandbox later, as an opt-in, with a cost.
- Hub UI keeps the OIDC token in Web Storage (`authService.tsx` sets no custom
  `userStore`). Any script in Hub's origin can read the token, not only call Hub
  as the user. A shadow root scopes CSS. It does not isolate script.
- Hub sends `X-Frame-Options: DENY` on all routes. Hub cannot frame a page that
  Hub itself serves.
- Tailwind generates only the classes that Hub uses. DaisyUI 5 colours and the
  `--calm-*` tokens are CSS variables.
- The proof of concept shows that server-driven blocks give a useful screen,
  with light and dark mode and mobile layout at no cost to the author.
- Hub stores decorators. Many #3396 stories (cost, risk, ownership, runtime
  status) are decorators that only need to be shown.
  [#3620](https://github.com/finos/architecture-as-code/issues/3620) asks for one
  generic view of all decorators in place of the deployment-specific panel.

## Decision

Use three tiers, plus contracts that the host owns. The first PRs build decorator
views and blocks.

| Tier | What runs in the browser | Extension points |
|---|---|---|
| 1. Decorator views | No extension code and no route. Hub draws stored decorators | `decorator-views` |
| Lenses | No extension code. The route returns a graph, and Hub draws it with the shapes and styles of the lens notation | `diagram-lens` |
| 2. Blocks | No extension code. The extension returns JSON blocks, versioned by `hubApi`. Hub renders them with its own components | `screen`, `designer-tab` (a subset), `landing-card` (a subset), `detail-panel` |
| Host-owned contracts | No extension code. Hub renders from data or from the manifest | `search-provider`, `chat`, `action`, `form` |
| 3. Isolated code | Extension code in a cross-origin `<iframe sandbox="allow-scripts allow-forms">`, without `allow-same-origin` | `screen` and `designer-tab` only, when blocks are not enough |

**Decorator views** need no extension code:

- A generic Decorators view shows every decorator of an architecture version, of
  each type. It renders `data` from the shape of the values, as #3620 describes.
- One overlay engine marks nodes and edges on the diagram. A decorator view names
  one status field and maps its values to `ok`, `warn`, `error` or `info`.
- A decorator view can map fields of `data` to block types. Each mapping is a
  JSON Pointer and one block type. There are no expressions or templates.

A manifest declares decorator views by decorator type, in
`contributes.decorator-views`. They have no route, because Hub already holds the
data.

**Blocks** start with the seven types of the proof of concept: `markdown`,
`keyValue`, `stats`, `table`, `cards`, `alert` and `links`. A link goes to an
external URL or to a Hub target. Each slot has its own error boundary. An
unknown block type shows a placeholder, not an error page. Hub publishes the
block JSON Schema, versioned by `hubApi`, so that other clients, such as the VS
Code extension framework
([#3499](https://github.com/finos/architecture-as-code/issues/3499)), can render
blocks.

**A different picture of the same architecture is a lens, not a tab.** The
Diagram tab lists its lenses. A `diagram-lens` names a `GET` route, the view
`params` that it owns, and a `notation`. The route returns a graph
(`lens.schema.json`): nodes, edges and groups with tags, and no positions
unless the layout is `fixed`. Hub lays it out and draws it.

The notation (`notation.schema.json`) is data, not code. A shape is SVG
geometry from a closed subset (`path`, `rect`, `circle`, `ellipse`, `line`,
`polyline`, `polygon`) with text slots, ports and resize rules. Styles are keyed
by tag and cascade, as in Structurizr. An icon is a `data:` image shown with
`<img>`, so no remote fetch and no script. Hub checks the notation at start-up.
The UI builds each SVG element from the JSON, never from markup. The notation
is a file in the extension folder, so each notation ships with its extension,
like any other part of it. Hub ships only a small core notation (a box and
common edge markers). So an author defines their own notation, and the iframe
tier stays for editors and other views that need code.

**Blocks have a bounded set of interactions, all declared as data.** Hub owns each control and
each call. No extension code runs in the browser.

| Interaction | Declared by | What Hub calls |
|---|---|---|
| Tile filter | A `stats` item `filter` that names a `table` in the same reply | Nothing for inline rows. The source route for a `source` table |
| Table query | A `table` `source`: a route and a page size | The route, only if it is `GET` and `readOnly`, with the filter, search text and page as query parameters |
| Form | A `form` block that names a `contributes.form` entry | The form route, through Hub's form endpoint |
| Refresh | Nothing: a `2xx` from an action or form route that is not `readOnly` | The routes of the slots and source tables of that extension again, with the same filters |

A failure or an unknown outcome refreshes nothing, because Hub cannot know what changed.

**A form is declarative.** The manifest declares its fields from a closed set of types (`text`,
`multiline`, `number`, `choice`, `checkbox`) with their rules, and its target: none, a resource
version or a node. A blocks reply places it with a `form` block. Hub draws the fields, and checks
the input with the manifest rules in the UI and again on the server. Hub sends
`{submission, context, input}` to the form route through its own endpoint. The input and the
trusted context are separate parts of the body, and Hub derives the context from the target, not
from the input. The generic proxy and MCP refuse a form route, so a caller cannot skip these checks.
The UI keeps the target that the user started to edit when the selection changes. Each reply says
whether Hub sent the call to the backend, so the UI can tell a refusal from an unknown outcome. A
repeat after an unknown outcome keeps its submission id, so the backend can detect a duplicate.
Until that outcome is settled or the user forgets it, the form sends only that repeat.

**`designer-tab` is for views that a service computes on request.** A result that
is stored must be a decorator, so that the CLI, MCP and VS Code see it too, and a
decorator view shows it.

**The iframe tier** serves pages from the extension's own origin. Hub adds a
Content-Security-Policy with a `frame-src` list built from the manifests, and
keeps `X-Frame-Options: DENY` for its own pages. A `postMessage` bridge carries
the theme variables, theme changes, the context, navigation requests and resize
events. It never carries a token. Data goes through the proxy.

**No extension code runs in Hub's origin.** A same-origin `mount(element,
context)` could read the user's token, and an operator flag does not change
that. Hub may use `mount` for its own code. Revisit this when the token is no
longer in Web Storage.

**Module Federation and import maps with a shared React are rejected.** They tie
each extension to Hub's React, router, React Flow and DaisyUI major versions, so
each major upgrade in Hub breaks extensions.

Extensions do not use Hub's class names. They read Hub's CSS variables.

## Consequences

- The UI-loading spike no longer gates the first UI steps. It moves to the
  iframe tier, and is needed only when an extension needs it.
- Decorator and block extensions can be written in any language, and a Hub UI
  upgrade cannot break them.
- Deployments becomes a decorator view: `deployment` decorators show in the
  generic Decorators view and as a diagram overlay. `DeploymentPanel` is
  removed, with its filter and selection state.
- Issue markers for
  [#3399](https://github.com/finos/architecture-as-code/issues/3399) are a
  decorator view of `validation` decorators. A Validation tab fits blocks, but
  needs a Hub target that selects an element on the diagram.
- Blocks have only the interactions in the table above. An extension that needs
  other input or live interaction waits for the iframe tier.
- `DiagramSection` gets a tab registry in place of its closed tab union. A
  `?tab=deployments` link goes to the Decorators view, and an unknown tab falls
  back to `diagram`.
- `contributes` gets an entry with no route. ADR 0012 records this.
- Hub UI needs a Content-Security-Policy before the iframe tier ships.
- If many third-party extensions need interactive UI, revisit remote rendering
  (for example Shopify's remote-dom), which isolates code and keeps Hub's look.
