---
id: calm-hub-extension-access
title: Extension Access
sidebar_label: Extension Access
sidebar_position: 6
---

# Extension Access

This page gives who can call an extension, what CALM Hub tells the extension about the caller, and
what CALM Hub trusts. For the settings, see [Extensions](index.md#extensions).

## Who can call a route

Each route in the manifest has a `scope`. CALM Hub checks it on each call, from the UI, the CLI,
MCP or any other client, with the same rules as for its own resources (see
[CALM Hub Entitlements](../working-with-calm/calm-hub-entitlements.md)).

| Scope | The caller must | Path |
|---|---|---|
| `authenticated` | Be signed in | Any |
| `read` | Read the namespace and each of its parent namespaces | Has `{namespace}` |
| `write` | Write the namespace or one of its parent namespaces | Has `{namespace}` |
| `admin` | Administer the namespace or one of its parent namespaces | Has `{namespace}` |
| `domain_read`, `domain_write`, `domain_admin` | Have that permission on the domain | Has `{domain}` |
| `global_admin` | Be a global admin | Any |

- CALM Hub takes the namespace and the domain only from the path, never from the query or the body.
- A signed-out caller gets `401`. A signed-in caller without the scope gets `403`. CALM Hub does not
  call the backend.
- On a read-only Hub, only `GET` and `readOnly` routes run. Any other call to a declared route gets
  `405`. A `POST`, `PUT`, `PATCH` or `DELETE` with `%2F`, `%2E`, `%5C`, `%25`, `%40`, `..`, `\`, `//`,
  `@`, `;` or an encoded look-alike of `/`, `\`, `.`, `%`, `@` or `;` in the path also gets `405`, not
  `400`.
- CALM Hub refuses an encoded slash (`%2F`, also double-encoded) in a route path with `400`, and does
  not call the backend. It also refuses an encoded look-alike of `/`, `\`, `.`, `%`, `@` or `;`, such as
  `%EF%BC%8F` (U+FF0F) or `%E2%80%A5` (U+2025), and each code point whose NFKC form contains `/` or
  `\`, such as `%E2%84%80` (U+2100, `a/c`). A backend that normalises Unicode (NFKC) before it
  routes can read these as a slash or as `..`.
- CALM Hub refuses a matrix parameter (`;name=value`) in a route path with `400`, and does not drop it.
- CALM Hub gives `415` to a `POST` with no `application/json` or other `+json` `Content-Type`, also
  when it has no body, and to a body of another type for the other methods. It does this before it
  signs the assertion. Thus a cross-site form or fetch cannot call a route as the user. An MCP tool
  call does not get this check, because CALM Hub sends JSON for it. But a tool call needs the
  `Mcp-Session-Id` of an initialised session, which a cross-site page cannot read. This is not true
  when `quarkus.mcp.server.http.streamable.auto-init=true`, or in dev mode, where
  `quarkus.mcp.server.dev-mode.dummy-init` is `true` by default: then a call with no session runs too.
- `GET /api/calm/extensions` and the blocks schema also need a signed-in user.
  `GET /api/calm/auth/jwks` is public.

### Public read

With `calm.auth.allow-public-read=true`, a signed-out visitor still gets `401` on each extension
route, also on a `read` or `authenticated` route. Public read means that each signed-in user can
read every namespace. CALM Hub's own resources work the same way.

### Authentication off

With `calm.auth.enabled=false`, every caller is one shared principal and a global admin. Thus CALM
Hub does not start with an enabled extension that has routes, unless
`calm.extensions.allow-without-auth=true`. Use that setting only for local development.

## The identity assertion

CALM Hub never sends the caller's token or cookies to the extension. For each call, it sends a JWT
that it signs, in the `X-Calm-Hub-Identity` header. The public keys are at
`GET /api/calm/auth/jwks`.

| Claim | Value |
|---|---|
| `iss` | The CALM Hub base URL (`calm.hub.base-url`) |
| `aud` | The extension id |
| `sub` | The user. When `auth` is `none`, one shared principal |
| `auth` | `none`, `oidc` or `proxy` |
| `iat`, `exp` | Issue and expiry time. The lifetime is `calm.extensions.identity.ttl-seconds`, by default 60 seconds |
| `jti` | A unique id for this call. The audit log records it |
| `htm`, `htp` | The method, and the path and query relative to the backend URL. CALM Hub sorts the query by name |
| `hubApi`, `route`, `scope` | The manifest `hubApi`, the route `id`, and the route `scope` |
| `ns` | The namespace that CALM Hub checked. Only for a `read`, `write` or `admin` route |
| `dom` | The domain that CALM Hub checked. Only for a `domain_read`, `domain_write` or `domain_admin` route |
| `bdh` | The base64url SHA-256 of the request body. Only when there is a body |

### Verify it

Verify each request with the JWKS only:

- the header `typ` is `calm-ext+jwt`, and `alg` is `RS256` or `ES256` and equals the `alg` of the
  key with that `kid`. Load the JWKS again for an unknown `kid`
- the signature is valid
- `iss` is the CALM Hub base URL, `aud` is your extension id, and `exp` is not past
- `htm` is the request method, and `htp` is the path and query that you received, relative to the
  backend URL. For example, with the backend URL `https://svc.internal/base`, a request for
  `/base/screen` has the `htp` `/screen`
- `bdh` is the SHA-256 of the body that you received, and is absent when there is no body
- each `jti` is used one time

[`identity.mjs`](https://github.com/finos/architecture-as-code/blob/main/calm-hub/local-dev/extensions/example-services/identity.mjs)
does these checks with no dependencies. The [tutorial](../tutorials/advanced/hub-extension.md#verify-the-identity-assertion)
gives the reason for each check.

### What Hub checks

For a `read`, `write` or `admin` route, CALM Hub checked the route scope for `ns`, and nothing
more. For a `domain_*` route, it checked the scope for `dom`. For another scope, CALM Hub did not
check a namespace or a domain, and does not send `ns` or `dom`: do not trust a namespace or a
domain from the path. It does not check the query, the body, or the UI context. If your extension
reads data with a service account, return only what `sub` may see in `ns`.

With `calm.auth.allow-public-read=true`, each signed-in user can read every namespace. Thus on a
`read` route, `ns` does not mean that `sub` has a grant on the namespace.

### Write the routes

- A `GET` route must change nothing, also when it is not `readOnly`. Use `POST`, `PUT`, `PATCH` or
  `DELETE` for a change. The `Content-Type` rule does not apply to `GET`, so a cross-site link can
  send a `GET` as the user, for example through a front proxy with a session cookie.
- Route strictly, on the exact path that you received. Do not ignore a trailing slash or the case of
  a literal, and do not decode `%2F` before you route. Otherwise your backend can run a route other
  than the one that CALM Hub checked the scope for. The `route` claim names the route that CALM Hub
  matched.
- CALM Hub sends `If-Match` and `If-None-Match`, and returns `ETag`, so a conditional write works.
  It does not return `Location`, because that would name your private backend URL. Return the
  identifier in the body.

### When the extension calls CALM Hub

CALM Hub refuses its own assertion as a credential. An extension that calls CALM Hub uses its own
service account, with the fewest grants that it needs.

## Trust model

Extension manifests are trusted operator configuration, as `application.properties` is. CALM Hub
reads them one time at start-up, and nothing changes them at runtime. No API adds an extension.

CALM Hub checks the manifests for usual mistakes at start-up, but it does not defend against a bad
manifest: for example a schema that is made to be slow, or a backend URL to a bad host. To fix such
a problem, correct the manifest.

CALM Hub bounds only the cost that a caller controls:

| Limit | Default |
|---|---|
| Request body | 1 MiB, then `413` |
| Reply body | 1 MiB, then `502` |
| Connect and request timeouts | 5 and 10 seconds, then `504` |
| Calls at the same time to one extension | 32, then `503` |
| MCP arguments | 1 MiB of JSON, and patterns that match in linear time |

The [MCP extension tools](mcp-and-api.md#extension-tools) page gives the MCP rules.

In `proxy-auth` mode, any client that reaches CALM Hub directly can set `Remote-User`. Make CALM Hub
listen only on loopback or behind the proxy.
