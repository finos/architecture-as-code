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

## Special bypasses

### `allow-public-read` config flag

`calm.auth.allow-public-read=true` is a global bypass in `CalmHubPermissionChecker.canRead`. It short-circuits all namespace checks. Intended for fully-open deployments; default is `false`.

### GLOBAL admin

A user with `admin` on `GLOBAL` bypasses all namespace-level permission checks via `hasGlobalAdmin`. Domain access is also granted. `GLOBAL` is not part of the namespace hierarchy.

---

## Default-open namespace behaviour

When a namespace is created via `NamespaceService`, a `UserAccess("*", read, namespace)` record is inserted automatically. This keeps the hub open by default.

To restrict a namespace: delete the `* read` record. The AND rule for child namespaces means restriction cascades automatically.

---

## `getGrantsForUser` vs `getUserAccessForUsername`

- **`getGrantsForUser(username)`** — returns grants where `username = :username OR username = '*'`. Used by the permission checker (single round-trip per request).
- **`getUserAccessForUsername(username)`** — returns grants for exactly one username. Used by admin/management endpoints (`UserAccessResource`, `UserAccessValidator`) that need to inspect a single user's grants without `*` mixed in.

---

## Domain-scoped access

`hasDomainAccess`, `canReadByDomain`, etc. are **not** hierarchical — domain access remains flat. `UserAccess` records have either `namespace` or `domain` set, never both.
