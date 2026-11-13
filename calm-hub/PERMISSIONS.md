# CalmHub Permissions — Developer Reference

For user-facing documentation, see [`docs/docs/working-with-calm/calm-hub-entitlements.md`](../docs/docs/working-with-calm/calm-hub-entitlements.md).

---

## Storage model

Entitlements are stored as `UserAccess` records (see `domain/UserAccess.java`). Each record has:
- `subjectType` — `user` (default) or `group`. A record with no `subjectType` is a `user` grant
- `username` — for a `user` grant, a real username from the OIDC provider, or `*` for the public-access wildcard; for a `group` grant, the group name (for LDAP, the `cn`)
- `permission` — `read`, `write`, or `admin`
- `namespace` — the namespace this grant applies to (mutually exclusive with `domain`)
- `domain` — the control domain this grant applies to (mutually exclusive with `namespace`)

The `*` wildcard is a valid username value (per `USERNAME_REGEX` in `ResourceValidationConstants`). It represents any user and is evaluated by the same logic as named user grants. `*` is not a valid group name.

User names and group names are unique, so the unique indexes on `userAccess` do not include `subjectType`.

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
| `CalmHubPermissionChecker` | Implements the AND/OR hierarchical logic; calls `getGrantsForUser`, then group grants only if those deny |
| `UserAccessStore` (interface) | `getGrantsForUser(username)` returns user + `*` grants in one query; `getGroupGrantsForNamespaces`, `getGroupGrantsForDomain` and `getAllGroupGrants` return group grants |
| `MongoUserAccessStore` | Mongo implementation |
| `NitriteUserAccessStore` | Nitrite implementation |
| `UserAccessValidator` | `getReadableNamespaces(username)` — exact ancestor-chain filter used by search; `getReadableDomains(username)` — the same for controls, used by search and domain counts. Both include group grants |
| `GroupGrants` | Keeps the group grants whose group the user is a member of, with one resolver call |
| `GroupMembershipResolver` | Extension point: `memberGroups(username, groups)` |
| `NamespaceService` | Orchestrates namespace creation + automatic `* read` grant insertion |
| `NamespaceAccessBackfillStep` | Schema migration step; backfills `* read` grants on pre-existing namespaces |

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
| `admin` | `GLOBAL` | Create/delete any namespace or domain; delete any architecture, pattern, flow, standard, interface, timeline, ADR, decorator, control requirement, or control configuration; read + write all content; manage all entitlements (including further `GLOBAL admin` grants) | Bypasses all checks via `hasGlobalAdmin()` — only `admin` is valid; `read`/`write` grants on `GLOBAL` are rejected with 400 |

Content-resource deletion is deliberately `GLOBAL admin`-only — a namespace- or
domain-scoped `admin` grant does not permit it, even for content the grant
otherwise gives full read/write access to. A control requirement refuses to
delete (`409`) while it still has configurations; delete those first.

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

## Personal namespaces

When `calm.namespaces.personal.enabled=true`, `PersonalNamespaceService` creates the root (default
`users`) at start up with the normal `* read` grant. `PUT /api/calm/me/namespace` creates
`users.<segment>` with an `admin` grant for the caller and **no** `* read` grant. Because READ needs
a grant at each level, only the owner can read it. ADMIN on the root gives WRITE and ADMIN, but not
READ, on every personal namespace. See [PERSONAL_NAMESPACES.md](PERSONAL_NAMESPACES.md).

---

## `getGrantsForUser` vs `getUserAccessForUsername`

- **`getGrantsForUser(username)`** — returns user grants where `username = :username OR username = '*'`. Used by the permission checker (single round-trip per request).
- **`getUserAccessForUsername(username)`** — returns user grants for exactly one username.

Both exclude group rows, so a user with the same name as a group never gets that group's grants. Used by admin/management endpoints (`UserAccessResource`, `UserAccessValidator`) that need to inspect a single user's grants without `*` mixed in.

---

## Domain-scoped access

`hasDomainAccess`, `canReadByDomain`, etc. are **not** hierarchical — domain access remains flat. `UserAccess` records have either `namespace` or `domain` set, never both.

---

## Group grants

A `group` grant gives its access to each member of the group. Group grants follow all the rules above: the READ ancestor rule, the WRITE/ADMIN cascade, domain access and `GLOBAL admin`. The admin API accepts `subjectType` on create; `GLOBAL` still accepts only `admin`.

### Evaluation

```
check(username, scope, action):
    grants = store.getGrantsForUser(username)
    if rules(grants) allow: return true
    candidates = group grants on the scope's ancestors + GLOBAL   // domain: the domain + GLOBAL
    groups = distinct group names of candidates
    members = resolver.memberGroups(username, groups)            // one call; exception → no groups
    return rules(grants + candidates where group in members)
```

`UserAccessValidator` and `GET /api/calm/user-access/current` do the same with `getAllGroupGrants()`. The resolver only sees groups that have grants, never all of a user's groups. Only direct membership counts.

### Membership provider

`calm.auth.groups.provider` selects the built-in `GroupMembershipResolver`:

| Value | Resolver | Effect |
|---|---|---|
| `none` (default) | `NoGroupMembershipResolver` | No user is a member of any group; group grants give no access |
| `ldap` | `LdapGroupMembershipResolver` | Membership comes from an LDAP directory |

`GroupMembershipResolverProducer` produces the resolver as a `@DefaultBean`. To use another membership source, add an `@ApplicationScoped` implementation of `GroupMembershipResolver` in source; it replaces the built-in one.

### LDAP provider

The LDAP provider uses the UnboundID LDAP SDK. Quarkus disables JNDI (`quarkus.naming.enable-jndi`), so JDK JNDI is not used. For each uncached user it finds the user DN with the user searches, then searches `group-search-base` for the candidate groups that have the user in `member-attribute`, one OR-filtered search for each `groups-per-query` batch. Usernames and group names are escaped before they go into a filter. TLS connections verify the server host name.

Answers are cached for each (user, group) pair, and the user DN for each user. If the directory fails (error or timeout), groups cached as "member" keep their access until `cache.positive-ttl` expires, the uncached groups count as "not a member", and nothing is cached. The resolver logs the failure at `WARN` and does not throw.

Settings are under `calm.auth.groups.ldap`. `LdapGroupsConfigValidator` checks them at startup when `provider=ldap`, and CALM Hub does not start if they are not valid.

| Setting | Default | Notes |
|---|---|---|
| `url` | required | One `ldap://` or `ldaps://` URL |
| `auth-mode` | required | `none`, `simple` or `gssapi` |
| `bind-dn`, `bind-password` | — | Required for `simple`. Supply the password as a secret |
| `start-tls` | `false` | `simple` over plain `ldap://` without StartTLS is refused |
| `truststore`, `truststore-password` | JVM default | |
| `canonicalize-host` | `false` | Resolves the host to its canonical name, for GSSAPI service principals behind host aliases |
| `connect-timeout`, `read-timeout` | `PT5S`, `PT10S` | `read-timeout` must be at least `PT1S`. It is also the server-side search time limit, in whole seconds. An operation that times out is abandoned on the server |
| `pool`, `pool-size` | `false`, `10` | Connection pooling. Not permitted with StartTLS |
| `user-search-policy` | `unique` | `unique`: more than one matching entry gives no groups. `first`: the first match, in search order, wins |
| `user-searches.<name>.base`, `.order` | required | At least one search. Searches run in ascending `order` |
| `user-searches.<name>.filter` | `(uid={0})` | `{0}` is the escaped username |
| `user-searches.<name>.scope` | `onelevel` | `onelevel`, `subtree` or `object` |
| `group-search-base` | required | |
| `group-search-scope` | `onelevel` | |
| `group-name-attribute` | `cn` | |
| `member-attribute` | `member` | Holds user DNs, e.g. `member` or `uniqueMember` |
| `groups-per-query` | `100` | |
| `cache.positive-ttl`, `cache.negative-ttl`, `cache.dn-ttl` | `PT5M`, `PT1M`, `PT10M` | "User not found" uses `negative-ttl`. `PT0S` turns a cache off |
| `cache.max-size` | `10000` | |
| `gssapi.use-subject-creds-only` | `false` | `false` lets the GSSAPI bind use the Kerberos ticket cache, which the deployment keeps current |

Gotchas:

- With `user-search-policy=first`, LDAP servers do not promise result order, so a search that matches several entries can return a different one each time.
- A group named the same in two subtrees is ambiguous with `group-search-scope=subtree`: membership of either one satisfies the grant.
- A member removed from a group keeps that group's access until `positive-ttl` expires; each CALM Hub instance has its own cache.
- For a GSSAPI bind, UnboundID sets `java.security.auth.login.config` (to a generated JAAS file) and `javax.security.auth.useSubjectCredsOnly` as JVM-wide system properties.
- A user search whose base does not exist counts as no match and logs a `WARN`, so the other user searches still run. A missing `group-search-base` is a failure.
- With `pool=true`, a search on a pooled connection that is no longer usable is retried once on a new connection.
- Native images refuse `provider=ldap` at startup. Use the JVM image.
