# ADR 0013: Extension UI is tiered, with Hub-rendered blocks by default

**Status**: Proposed. The proof of concept renders seven block types for one
`screen`. The other tiers are not built.

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

## Decision

Use three tiers. The first PRs build only Tier 1.

| Tier | What runs in the browser | Extension points |
|---|---|---|
| 1. Blocks | No extension code. The extension returns JSON blocks, versioned by `hubApi`. Hub renders them with its own components | `screen`, `designer-tab`, `landing-card` (a subset), `detail-panel` |
| Host-owned contracts | No extension code. Hub renders from data or from the manifest | `search-provider`, `chat`, `action` |
| 2. Isolated code | Extension code in a cross-origin `<iframe sandbox="allow-scripts allow-forms">`, without `allow-same-origin` | `screen` and `designer-tab` only, when blocks are not enough |

**Blocks** start with the seven types of the proof of concept: `markdown`,
`keyValue`, `stats`, `table`, `cards`, `alert` and `links`. A link goes to an
external URL or to a Hub target. Each slot has its own error boundary. An
unknown block type shows a placeholder, not an error page.

**The iframe tier** serves pages from the extension's own origin. Hub adds a
Content-Security-Policy with a `frame-src` list built from the manifests, and
keeps `X-Frame-Options: DENY` for its own pages. A `postMessage` bridge carries
the theme variables, theme changes, the context, navigation requests and resize
events. It never carries a token. Data goes through the proxy.

**Same-origin `mount(element, context)`** is only for bundled extensions that
ship with Hub, such as Deployments, and for extensions that the operator marks
`trusted`. The operator guide states that such code can read the user's token.

**Module Federation and import maps with a shared React are rejected.** They tie
each extension to Hub's React, router, React Flow and DaisyUI major versions, so
each major upgrade in Hub breaks extensions.

Extensions do not use Hub's class names. They read Hub's CSS variables.

## Consequences

- The UI-loading spike no longer gates the first UI steps. It moves to the
  iframe tier, and is needed only when an extension needs it.
- Tier 1 extensions can be written in any language, and a Hub UI upgrade cannot
  break them.
- Blocks have no forms or live interaction. Deployments has filter and selection
  state, so it moves as a bundled `mount` extension. A Validation tab for
  [#3399](https://github.com/finos/architecture-as-code/issues/3399) fits blocks,
  but needs a Hub target that selects an element on the diagram. Issue markers on
  the diagram are a host feature driven by `validation` decorators, not extension
  UI.
- Bundled extensions that only reshape Hub's own decorators may render blocks in
  the browser, with no proxy call.
- `DiagramSection` gets a tab registry in place of its closed tab union. A
  `?tab=deployments` link keeps working, and an unknown tab falls back to
  `diagram`.
- Hub UI needs a Content-Security-Policy before the iframe tier ships.
- If many third-party extensions need interactive UI, revisit remote rendering
  (for example Shopify's remote-dom), which isolates code and keeps Hub's look.
