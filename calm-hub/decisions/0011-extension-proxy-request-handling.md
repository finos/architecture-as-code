# ADR 0011: Extension proxy request handling

**Status**: Proposed. The proof of concept proxies one fixed `screen` route and
checks only the `authenticated` and `global_admin` scopes. The generic proxy
below is not built.

## Context

The proxy at `/api/calm/extensions/<id>/api/<path>`
([ADR 0009](0009-extensions-run-out-of-process-behind-a-hub-proxy.md)) takes a
path from the caller and sends a request to a backend that the operator chose.
It must apply the same rules as the rest of Hub, and it must not become a way to
reach other hosts or to serve content in Hub's origin.

Facts in the code:

- `ReadOnlyRequestFilter` returns 405 for every POST, PUT, PATCH and DELETE, on
  every path. A `chat` or search POST, which changes nothing, would also fail on
  the read-only images.
- `@PermissionsAllowed` binds to a parameter named `namespace`. A proxy path has
  no such parameter, so the proxy must call `CalmHubPermissionChecker` in code.
- `AuditRequestFilter` audits only the resource classes in its map.
- When auth is off, every caller is a global admin, so every route of an enabled
  extension is open.
- The proof of concept builds the backend URI by string concatenation
  (`URI.create(url + path)`). With a caller-supplied path, `@evil/x` becomes
  user info followed by a new host.
- Hub sends `X-Frame-Options`, `nosniff` and `no-referrer` on all routes, but no
  Content-Security-Policy.

## Decision

**Each route declares a scope. There is no default.** The scope is one of:

- `authenticated`
- `global_admin`
- `read`, `write` or `admin`, only when the path has a `{namespace}` parameter
- `domain_read`, `domain_write` or `domain_admin`, only when the path has a
  `{domain}` parameter

Hub fails at start up for any other value. Hub takes the namespace only from the
matched path parameter, never from the query or the body. It applies the same
ancestor rules as `CalmHubPermissionChecker`: READ needs every ancestor, WRITE
needs any ancestor. When `calm.auth.allow-public-read` is on, an `authenticated`
route still needs a non-anonymous identity.

**Read-only mode.** `ReadOnlyRequestFilter` exempts only paths that match
`^/api/calm/extensions/[^/]+/api/`. On a read-only Hub the proxy then allows a
non-GET method only on routes that declare `readOnly: true`. The registry leaves
out the other routes, so the UI and CLI need no mode logic.

**Route matching and host pinning.**

1. Match the request only against the declared route templates.
2. Normalise the path. Reject `..`, `%2e`, `%2f`, `\`, `//` and `@`.
3. Build the URI with `URI.resolve`.
4. Check that the scheme, host and port equal those of the configured backend.
5. Do not follow redirects.

**Backends use HTTPS.** Plain HTTP is allowed only for loopback, or with an
explicit operator setting for a cluster-internal host.

**Headers.**

| Direction | Allowed | Never sent |
|---|---|---|
| To the extension | `Content-Type`, `Accept`, `Accept-Language`, `X-Calm-Hub-Identity` | `Authorization`, `Cookie`, `Remote-User`, `X-Forwarded-*` |
| To the caller | `Content-Type` of `application/json`, `text/event-stream` or `text/plain`; `Cache-Control`; `ETag` | `Set-Cookie`, `Location`, hop-by-hop headers |

Hub adds `Content-Security-Policy: sandbox; default-src 'none'` to each proxied
reply, so that the extension cannot serve HTML that runs in Hub's origin.

**Limits.** Each extension has a connect timeout, a request timeout, a cap on
the request and reply size, a cap on concurrent streams, an idle-read timeout and
a maximum stream duration. An upstream failure becomes 502 or 504 with a generic
body. The proxy fails closed.

**Audit.** A call to a route that is not `readOnly` is audited with a new
`EXTENSION` entity type. The record holds the extension id, the route id and the
assertion `jti`.

**Auth off.** Hub refuses to start with enabled extensions when auth is off,
unless the operator sets an explicit opt-in. A warning is not enough, because in
that mode every caller is a global admin.

## Consequences

- A typo in a scope or a missing scope stops Hub at start up, not at the first
  request.
- `chat` and `search-provider` work on the read-only images, because their routes
  are `readOnly`. The extension holds no credential with the user's rights, so a
  proxied POST cannot change Hub data.
- The path checks need tests for each rejected form, including encoded and
  double-encoded forms.
- An extension cannot set cookies, redirect the browser or serve a page through
  Hub. An extension UI that needs its own page uses the iframe tier in
  [ADR 0013](0013-extension-ui-is-tiered-with-hub-rendered-blocks-by-default.md),
  from its own origin.
- MCP tools do not pass through JAX-RS filters. The MCP handler must call the
  same proxy service, so that scope, read-only and audit rules apply
  ([ADR 0014](0014-extension-commands-in-the-cli-and-mcp.md)).
- With `proxy-auth`, any client that reaches Hub directly can set `Remote-User`.
  The operator guide must say that Hub listens only on loopback or behind the
  proxy in that mode.
