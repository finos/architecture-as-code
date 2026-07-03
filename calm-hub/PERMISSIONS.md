# CalmHub Permissions — Developer Reference

For user-facing documentation, see [`docs/docs/working-with-calm/calm-hub-entitlements.md`](../docs/docs/working-with-calm/calm-hub-entitlements.md).

---

## Storage model

Entitlements are stored as `UserAccess` records (see `domain/UserAccess.java`). Each record has:
- `username` — a real username from the OIDC provider, or `*` for the public-access wildcard
- `permission` — `read`, `write`, or `admin`
- `namespace` — the namespace this grant applies to (mutually exclusive with `domain`)
- `domain` — the control domain this grant applies to (mutually exclusive with `namespace`)

The `*` wildcard is a valid username value (per `USERNAME_REGEX` in `ResourceValidationConstants`). It represents any user and is evaluated by the same logic as named user grants.

---

## Permission levels

| Permission | Implies |
|------------|---------|
| `read`     | — |
| `write`    | `read` |
| `admin`    | `read`, `write` |

---

## Hierarchical namespace rules

Namespaces use `.` as a separator (`org`, `org.ab`, `org.ab.cd`). The ancestor chain for a namespace is the list of all prefixes, inclusive of the namespace itself.

### READ — AND across ancestor chain

```
canRead(username, namespace):
    grants = store.getGrantsForUser(username)   // user grants + * grants in one query
    ancestors = ancestorChain(namespace)         // ["org", "org.ab", "org.ab.cd"] for "org.ab.cd"
    return ancestors.ALL(level →
        grants.ANY(g → g.namespace == level && permissionSufficient(g, READ)))
```

**Every** level must have a matching grant. This allows a parent to be public while a child is restricted.

### WRITE / ADMIN — OR across ancestor chain

```
canWrite(username, namespace):
    grants = store.getGrantsForUser(username)
    ancestors = ancestorChain(namespace)
    return ancestors.ANY(level →
        grants.ANY(g → g.namespace == level && permissionSufficient(g, WRITE)))
```

**Any** ancestor (including the namespace itself) with a sufficient grant is enough. Grants at a parent cascade to all descendants for write/admin purposes.

### `permissionSufficient`

| Requested | Sufficient grant |
|-----------|-----------------|
| READ      | `read`, `write`, or `admin` |
| WRITE     | `write` or `admin` |
| ADMIN     | `admin` only |

---

## Key components

| Class | Role |
|-------|------|
| `CalmHubPermissionChecker` | Implements the AND/OR hierarchical logic; calls `getGrantsForUser` |
| `UserAccessStore` (interface) | `getGrantsForUser(username)` returns user + `*` grants in one query |
| `MongoUserAccessStore` | Mongo implementation of `getGrantsForUser` |
| `NitriteUserAccessStore` | Nitrite implementation of `getGrantsForUser` |
| `UserAccessValidator` | `getReadableNamespaces(username)` — exact ancestor-chain filter used by search |
| `NamespaceService` | Orchestrates namespace creation + automatic `* read` grant insertion |
| `NamespaceMigrationService` | StartupEvent observer; backfills `* read` grants on pre-existing namespaces |

---

## Permission reference

`read` and `write` grants may use either a named username or the `*` wildcard. **`admin` grants must always use a named username** — attempts to create a wildcard admin grant on any namespace, domain, or GLOBAL are rejected with `400 Bad Request`. The permission checker additionally ignores any wildcard admin grant that exists in the store (e.g. from hand-edited data), so `*` can never confer administrative access at runtime.

| Permission | Scope | Capabilities | Evaluation rule |
|------------|-------|--------------|-----------------|
| `read` | Namespace `N` | Read content in `N` | **AND all ancestors** — every ancestor level must have a matching grant |
| `read` | Domain `D` | Read content in `D` | Flat — no hierarchy |
| `write` | Namespace `N` | Read + write content in `N` and descendants | **OR any ancestor** — one ancestor grant covers all descendants |
| `write` | Domain `D` | Read + write content in `D` | Flat — no hierarchy |
| `admin` | Namespace `N` | Read + write content in `N` and descendants; list/grant/revoke entitlements in `N` and descendants; create child namespaces of `N` | **OR any ancestor** |
| `admin` | Domain `D` | Read + write content in `D`; list/grant/revoke entitlements for `D` | Flat — no hierarchy |
| `admin` | `GLOBAL` | Create/delete any namespace or domain; read + write all content; manage all entitlements (including further `GLOBAL admin` grants) | Bypasses all checks via `hasGlobalAdmin()` — only `admin` is valid; `read`/`write` grants on `GLOBAL` are rejected with 400 |

---

## Special bypasses

### `allow-public-read` config flag

`calm.auth.allow-public-read=true` is a global bypass in `CalmHubPermissionChecker.canRead`. It short-circuits all namespace checks. Intended for fully-open deployments; default is `false`.

### GLOBAL admin bootstrap

`GLOBAL` is a sentinel value — not a real namespace in the store. To bootstrap a new deployment, create the first `GLOBAL admin` grant directly via the API in `no-auth` mode (or via Swagger UI), then switch to a secured auth profile.

---

## Default-open behaviour

When a namespace is created via `NamespaceService`, a `UserAccess("*", read, namespace)` record is inserted automatically. When a domain is created, a `UserAccess("*", read, domain)` record is inserted in the same way. This keeps both namespaces and domains open by default.

To restrict a namespace: delete the `* read` record. The AND rule for child namespaces means restriction cascades automatically. To restrict a domain: delete the `* read` record for that domain.

---

## `getGrantsForUser` vs `getUserAccessForUsername`

- **`getGrantsForUser(username)`** — returns grants where `username = :username OR username = '*'`. Used by the permission checker (single round-trip per request).
- **`getUserAccessForUsername(username)`** — returns grants for exactly one username. Used by admin/management endpoints (`UserAccessResource`, `UserAccessValidator`) that need to inspect a single user's grants without `*` mixed in.

---

## Domain-scoped access

`hasDomainAccess`, `canReadByDomain`, etc. are **not** hierarchical — domain access remains flat. `UserAccess` records have either `namespace` or `domain` set, never both.
