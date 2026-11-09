# ADR 0010: Extension identity is a Hub-signed, request-bound assertion

**Status**: Proposed. The proof of concept signs a 60-second RS256 token with
`iss`, `sub`, `aud`, `iat` and `exp`, and publishes one key. The claims, key
rotation and request binding below are not built.

## Context

An extension backend ([ADR 0009](0009-extensions-run-out-of-process-behind-a-hub-proxy.md))
must know who the user is. The obvious way is to forward the user's token. That
fails in three ways:

- Every extension backend could then call Hub with all the rights of the user.
- The `no-auth` profiles have no token.
- In `proxy-auth` the identity comes from a header, not a token.

Prior art agrees on one pattern. The proxy mints a new, short-lived token for
each target and never forwards the inbound credential. Backstage's proxy does
not send caller credentials to the target by default. GitHub App installation
tokens carry only the app's own grants. The IETF transaction-token draft says
such a token must not contain the inbound access token and must not be used as
an access token. Atlassian Connect binds its token to the request with `qsh`.

## Decision

**Hub never sends the user's token to an extension.** For each proxied call, Hub
signs an assertion and sends it in the `X-Calm-Hub-Identity` header.

**Sign with RS256 or ES256, and publish a JWKS.** The operator supplies the key.
`GET /api/calm/auth/jwks` is public and can hold more than one key. The first
key signs. The others only verify, so a key can be changed with no outage. HS256
is rejected: it needs one secret for each extension, and each extension could
mint its own assertions.

**The assertion carries these claims:**

| Claim | Value |
|---|---|
| header `typ` | `calm-ext+jwt` |
| `iss` | The Hub base URL, so that two Hubs are not confused |
| `sub` | The principal name |
| `aud` | The extension id |
| `iat`, `exp` | 60 s by default, 300 s at most |
| `jti` | A random id, also written to the Hub audit log |
| `htm`, `htp` | The method, and the path relative to the route, with the canonical query |
| `bdh` | SHA-256 of the body, only when Hub buffers the body |
| `route`, `scope`, `ns` | The route id, the scope and the namespace that Hub checked |
| `auth` | `none`, `oidc` or `proxy` |
| `hubApi` | The contract major version ([ADR 0012](0012-extension-manifest-registry-and-versioning.md)) |

Email, groups and roles are not sent. A later manifest field can ask for them,
and the operator sees that request.

**An extension calls Hub with its own service account.** Hub rejects its own
assertion as a credential: `typ` and `aud` make this check possible. The operator
gives the service account the least grants it needs. OAuth 2.0 Token Exchange
(RFC 8693) cannot be the default, because `no-auth` and `proxy-auth` have no
token endpoint. It can come later, for the OIDC profiles only.

## Consequences

- An extension verifies a request in a few lines of code, with the JWKS only. It
  needs no Hub credentials for that.
- A leaked assertion can be replayed only against the same route of the same
  extension, for up to 60 seconds. HTTPS to the backend
  ([ADR 0011](0011-extension-proxy-request-handling.md)) closes most of that
  window.
- With a service account, an extension can return data that the user cannot
  read. For `search-provider` and `chat`, Hub owns the request and reply format,
  sends only context that the user can read, and filters results by the user's
  READ grants. For other points, the extension must filter by `sub` and `ns`.
  The author guide must say this.
- In `no-auth` mode `sub` is one shared principal. `auth: none` tells the
  extension this.
- The `oidc` profile replaces `public.paths`, so each profile that sets
  `public.paths` must also list the JWKS path.
- `smallrye-jwt-build` becomes a declared dependency. Signing in a native image
  is not yet tested. The step-0 spike tests it.
