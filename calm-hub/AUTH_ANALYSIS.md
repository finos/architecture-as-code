# CalmHub Auth Analysis

## Summary of overall approach

In earlier discussions, we had the idea that OAuth 2.0 bearer tokens would be used for authentication, and the scopes granted by the IdP for authorization. 
This approach is hard to customize for different IdPs and would almost certainly require an opinionated, per-use case module adding each time.

In the spirit of getting CalmHub to a usable state as soon as possible, we have decided to move to a simple in-database entitlements system.

- Authentication can be done by either JWT validation/`sub` principal extraction, or by a trusted proxy setting a `Remote-User` header.
- The database will store user entitlements.
  - Keyed by namespace, or by control-domain for controls, which don't belong to a specific namespace. (NB this document focuses on reworking what we have today and doesn't introduce a control-domain entitlements document in the DB)
  - Users will have actions on certain types of resource, or just `all` for everything.
  - Actions are `read`, `write` and `admin`.
  - By default, namespaces will be readable by everyone unless they're marked otherwise.
- Endpoints will be secured with the Quarkus permissions system. A Permission allows us to specify entitlements keyed by namespace and resource type. 
  - We'll be able to annotate endpoints with `@PermissionsAllowed` and implement some already-existing interfaces to do this.
  - This replaces the custom annotations and filters we have today, which will reduce the complexity of the auth system.
- The introduction of `admin` to the database creates a bootstrapping problem where the first time a namespace is created, it won't have any admins or anyone entitled to add more admins. We will solve this problem by adding the creating user as an admin by default when a new namespace is created.
- Synchronisation of entitlements by an external system can be done in two ways:
  - Using the UserAccess endpoints to add and remove entitlements via the REST API.
  - By directly creating entitlements in the underlying Mongo database.
- Search becomes possible in the secure mode now because we have all entitlements in the database; we can simply filter out all namespaces on which the user does not have `read`.

This document underlines the current implementation and its issues, briefly outlines why we need to use Quarkus permissions, and then provides a high-level overview of the implementation plan.

## Current Implementation

### Two Filters, Two Profiles

Auth is split across two mutually exclusive filters, activated by Quarkus build profiles:

| | JWT Mode (`secure`) | Proxy Mode (`proxy`) |
|---|---|---|
| Filter | `AccessControlFilter` | `ProxyAccessControlFilter` |
| Auth source | JWT `preferred_username` claim | `Remote-User` header (configurable) |
| OIDC | Enabled | Disabled |
| Identity assurance | IdP-issued JWT | Upstream proxy |

Both modes activate `UserAccessValidator` for RBAC enforcement.

---

### Layer 1: Scope Enforcement (`@PermittedScopes` + AccessControlFilter)

Both filters check the `@PermittedScopes` annotation on the matched endpoint and enforce it — but the enforcement is asymmetric:

- **JWT mode:** extracts the OAuth `scope` claim from the JWT and verifies at least one required scope is present. This is an OAuth 2.0 concept — scopes are granted by the authorization server at token issuance.
- **Proxy mode:** also checks `@PermittedScopes` but **there is no token**. The filter reads the annotation and proceeds directly to `UserAccessValidator`. The scope check is effectively a dead letter in proxy mode — it validates annotation presence but cannot enforce scope values against anything meaningful.

The four defined scopes (`architectures:read`, `architectures:all`, `adrs:read`, `adrs:all`, `search:read`, `namespace:admin`) are OAuth constructs. In proxy mode they have no semantic counterpart.

---

### Layer 2: RBAC (`UserAccessValidator`)

Both modes share the same `UserAccessValidator`. It:

1. Loads `UserAccess` grants from the database by username.
2. Maps the HTTP method to a permission level: `POST/PUT/PATCH/DELETE → write`, `GET → read`.
3. Iterates grants and checks: namespace match + resource type match + sufficient permission.
4. Returns `true` if any grant satisfies all three conditions.

The `UserAccess` domain object carries:

```
username | permission (read|write) | namespace | resourceType (patterns|flows|adrs|architectures|all)
```

Two endpoints bypass namespace-level RBAC: `GET /calm/namespaces` (always allowed) and `GET /calm/search` (results filtered to the user's readable namespaces).

---

### Do We Have Two Levels of Auth?

**Yes, effectively.** In JWT mode:

1. The IdP issues a token with granted scopes — coarse-grained capability claims.
2. `AccessControlFilter` checks the token is valid and the endpoint's required scope is present.
3. `UserAccessValidator` checks fine-grained namespace/resource/permission grants in the DB.

Both must pass. A user with a valid `architectures:all` scope but no DB grant for the namespace is denied. A DB grant without a matching token scope is also denied.

In **proxy mode**, layer 1 is hollow. The proxy authenticates the user and asserts their identity via header. There are no scopes to validate — the filter reads `@PermittedScopes` but can only verify the annotation exists; it cannot enforce scope values. Only layer 2 (DB RBAC) does real work.

---

### Can We Remove Both Custom Filters?

**Yes — entirely.** This is the key opportunity. Both `AccessControlFilter` and `ProxyAccessControlFilter` exist only because there was no Quarkus-managed identity to enforce against. The right approach is to feed authentication into Quarkus' security pipeline so that Quarkus' built-in enforcement (`@RolesAllowed`, `@PermissionsAllowed`) can handle the rest natively.

---

## Desired Model: Quarkus-native RBAC

### Why `@RolesAllowed` Alone Is Not Enough

`@RolesAllowed` (Jakarta Security) checks whether the `SecurityIdentity` contains a named role string. Roles are global — the annotation is static and cannot reference a request path parameter. An endpoint annotated `@RolesAllowed("architecture-reader")` would grant access to *all* namespaces for anyone holding that role.

CalmHub's access model is namespace-scoped: a user may read in `foo` but not `bar`. To express that declaratively on the endpoint annotation, we need **`@PermissionsAllowed`** (Quarkus 3.x), which supports parameterised permissions whose check logic is evaluated at runtime with values drawn from the method call.

### Target Model

```
JWT mode                         Proxy mode
──────────────────               ──────────────────────────────────
quarkus-oidc validates           ProxyAuthenticationMechanism
token, sets principal            reads Remote-User header, sets principal
        │                                       │
        └──────────────┬────────────────────────┘
                       │
               CalmHubSecurityIdentityAugmentor (both modes)
               loads UserAccess grants from DB
               adds CalmHubPermission objects to SecurityIdentity
                       │
                       ▼
               Quarkus enforces @PermissionsAllowed on endpoint
               (namespace param matched at call time)
```

No custom filters or annotation scanning, and no need for manual 403 responses should a request fail the entitlements checks..

### The Permission Model

`@PermissionsAllowed` on an endpoint declares which named permission is required. The question is how that check is satisfied. There are two Quarkus-native approaches, and they have a meaningful practical difference.

#### Option A: `SecurityIdentityAugmentor`

The augmentor runs immediately after authentication. It loads **all** `UserAccess` grants for the current user from the database, converts them into `CalmHubPermission` objects, and attaches them to the `SecurityIdentity`. When an endpoint is reached, Quarkus calls `permission.implies()` on each pre-loaded permission to find a match.

- The DB is hit once per request, at authentication time, regardless of which endpoint is called
- All grants are loaded even though typically only one namespace is relevant to the request
- Requires a custom `CalmHubPermission` class extending `java.security.Permission` with a correct `implies()` implementation
- The permission objects live on the identity for the lifetime of the request; if multiple secured methods are called in a chain, no additional DB queries occur

#### Option B: `@PermissionChecker`

A `@PermissionChecker` method is a CDI bean method annotated with the permission name it satisfies. Quarkus calls it at authorisation time — after authentication, when the endpoint is about to be invoked — passing the method's parameters (including the `namespace` path argument) directly to the checker. The checker queries the DB for that specific user, namespace, and resource type and returns a boolean.

- The DB is hit at authorisation time, not authentication time — and only for the specific permission being checked on this request
- No `CalmHubPermission` class required; the logic is a plain boolean method
- Write-implies-read is expressed as a simple condition in the checker rather than as an `implies()` contract on a Permission object
- One checker method per distinct permission name is needed, but they all delegate to a shared helper

#### Comparison

| | `SecurityIdentityAugmentor` | `@PermissionChecker` |
|---|---|---|
| DB query timing | Authentication (always) | Authorisation (on demand) |
| Data loaded | All grants for user | Only grants relevant to this request |
| Custom class required | `CalmHubPermission` with `implies()` | None |
| Write-implies-read | Encoded in `implies()` | Simple conditional in checker |
| `resourceType=all` expansion | Expand at augmentation time | Query covers `all` and specific type |
| Search result filtering | Separate call still needed | Separate call still needed |

#### Recommendation

`@PermissionChecker` is the better fit for CalmHub. The augmentor's pre-loading is only advantageous when the same identity is checked many times per request; for a standard REST or MCP call, one targeted DB query at authorisation time is sufficient and simpler. It also removes the need for a custom `Permission` class entirely — the check logic lives in a readable boolean method rather than an `implies()` implementation.

The one case that genuinely needs all grants — search result filtering in `SearchResource` — already calls `getUserAccessForUsername()` directly and is unaffected by which approach is used for endpoint enforcement.

Code examples for all new components are in [AUTH_IMPLEMENTATION_CODE.md](AUTH_IMPLEMENTATION_CODE.md).

---

## Implementation Steps

### 1. Add `CalmHubPermissionChecker`

A single CDI bean containing one `@PermissionChecker` method per named permission. This is the only new class required for enforcement — no custom `Permission` subclass is needed.

- Each method is annotated with the permission name it satisfies, matching the value used in `@PermissionsAllowed` on the endpoints (e.g. `architecture:read`, `adr:write`, `namespace:admin`)
- Each method receives the `SecurityIdentity` (for the username) and the `namespace` argument from the endpoint call, injected automatically by Quarkus
- The method queries the database for a matching `UserAccess` grant: same username, same namespace, matching resource type (or `all`), and sufficient permission level
- Write-implies-read is expressed as a straightforward condition: a checker for a read permission accepts either a `read` or `write` grant
- All checker methods delegate to a single private helper to avoid repetition; the helper encapsulates the grant lookup and matching logic
- Active in both `secure` and `proxy` profiles; has no awareness of how the identity was established

### 3. Add `ProxyAuthenticationMechanism` (proxy mode only)

A Quarkus `HttpAuthenticationMechanism` that establishes identity from the `Remote-User` header (or the configured equivalent). This is the proxy-mode counterpart to what `quarkus-oidc` does automatically in JWT mode.

- Active only in the `proxy` build profile, exactly as `ProxyAccessControlFilter` was
- Reads the configured username header from the incoming request
- If the header is absent or blank, returns no identity — Quarkus will respond with 401 automatically via the challenge mechanism
- If the header is present, creates a Quarkus `SecurityIdentity` with the header value as the principal name, then hands off to the augmentor to add DB-backed permissions
- Retains the same `calm.security.proxy.username-header` configuration property so existing deployments require no changes
- Replaces `ProxyAccessControlFilter` entirely; the JWT mode requires no equivalent change because `quarkus-oidc` already handles authentication correctly

### 4. Annotate Endpoints with `@PermitAll`, `@Authenticated`, or `@PermissionsAllowed`

Replace every `@PermittedScopes` annotation across the resource classes. There are three tiers:

- **`@PermitAll`** — no authentication required; anonymous requests are allowed through. For use on genuinely public endpoints such as health checks or read-only public schema endpoints. Not currently used in CalmHub but available for any endpoint that should be open without a login.
- **`@Authenticated`** — a valid identity must be present (JWT or `Remote-User` header), but no specific permission is checked. Appropriate for `GET /calm/namespaces` and `GET /calm/search`, where any logged-in user may call the endpoint and content is filtered by their grants rather than the request being blocked outright.
- **`@PermissionsAllowed`** — valid identity plus a specific namespace-scoped permission required. Used on all resource endpoints: read operations require `{resource}:read`, write/create/delete operations require `{resource}:write`, and user access management requires `namespace:admin`. The `namespace` path parameter is bound at call time so the check is scoped to the namespace in the URL.

One configuration note for the `secure` (JWT/OIDC) profile: Quarkus OIDC still attempts token validation on every request even for `@PermitAll` endpoints. For endpoints that should be truly anonymous with no OIDC involvement, the paths must also be listed in `quarkus.http.auth.permission.public.paths` in `application-secure.properties`.

### 5. Simplify `UserAccessValidator`

With enforcement delegated to `CalmHubPermissionChecker`, most of `UserAccessValidator` becomes dead code.

- `isUserAuthorized()` and its helpers (`mapHttpMethodToPermission()`, `hasAccessForActionOnResource()`, `permissionAllows()`) are removed — the checker handles this logic directly
- `getReadableNamespaces()` is retained because `SearchResource` needs it to filter search results to namespaces the user can see — this is a data-shaping concern distinct from access enforcement
- The `UserRequestAttributes` record is deleted as it has no remaining callers
- If in a future iteration `SearchResource` is updated to derive readable namespaces from the DB directly, `UserAccessValidator` can be removed entirely

### 6. Delete Dead Code

The following classes and annotations have no remaining purpose once the above steps are complete:

- `AccessControlFilter` — authentication and enforcement are now handled by OIDC and Quarkus respectively
- `ProxyAccessControlFilter` — replaced by `ProxyAuthenticationMechanism`
- `PermittedScopes` annotation — replaced by `@PermissionsAllowed`
- `CalmHubScopes` constants class — no longer referenced anywhere

### 7. Update Tests

The test surface shifts significantly: filter unit tests are deleted and replaced with focused tests on the three new components, plus integration tests that use Quarkus's built-in test security support.

| Old test | Disposition |
|---|---|
| `TestAccessControlFilterShould` | Delete — the filter no longer exists |
| `TestProxyAccessControlFilterShould` | Delete — the filter no longer exists |
| `TestUserAccessValidatorShould` | Trim to cover `getReadableNamespaces()` only |

New unit tests:

- **`TestCalmHubPermissionCheckerShould`** — covers the checker logic in isolation: a read grant allows a read check; a write grant allows both read and write checks; a grant for a different namespace denies the check; a `resourceType=all` grant satisfies checks for specific resource types; a user with no grants is denied; `UserAccessNotFoundException` is handled gracefully
- **`TestProxyAuthenticationMechanismShould`** — verifies that a request with the expected header produces an identity with the correct principal name; verifies that a missing or blank header triggers a 401 challenge

Integration tests should use Quarkus `@TestSecurity` to inject a pre-built `SecurityIdentity` with known permissions, removing the need to mock filters or intercept request pipelines.

---

## `UserAccessResource` Fit Analysis

`UserAccessResource` is the API for managing DB grants — the data that the augmentor reads to build the `SecurityIdentity`. It has four issues under the new model.

### 1. Missing DELETE endpoint

The resource currently has `POST /{namespace}/user-access` (create) and two GET endpoints (list all, get by id). There is no way to revoke a grant. Without a DELETE, the only way to remove access is directly in the database. This gap exists today but becomes more visible when the DB grants are the sole source of truth for enforcement.

A `DELETE /{namespace}/user-access/{userAccessId}` endpoint is needed, gated with the same `namespace:admin` permission as the other operations.

### 2. `namespace:admin` has no representation in the DB model

The `UserAccess.ResourceType` enum contains `patterns`, `flows`, `adrs`, `architectures`, and `all`. There is no `admin` type. Under the new model, the augmentor needs to know when to add a `namespace:admin` permission to an identity — but nothing in the current DB schema carries that signal.

There are two options:

- **Add `admin` as a new `ResourceType`** — a user with `resourceType=admin, permission=write` in a namespace gets the `namespace:admin` permission added by the augmentor. This is the cleanest approach and keeps everything in the existing DB structure.
- **Treat `resourceType=all` + `permission=write` as implying admin** — simpler but conflates "can write resources" with "can manage other users' access", which are meaningfully different capabilities.

Adding `admin` as an explicit resource type is recommended.

### 3. Chicken-and-egg bootstrap problem

Under the old model, the `NAMESPACE_ADMIN` scope is granted by the IdP at token issuance, outside the DB. An operator with the right JWT can call `UserAccessResource` immediately after deployment to seed grants. Under the new model, the `namespace:admin` permission comes from the DB — so there are no grants to begin with, and `UserAccessResource` is protected by the very grants it creates.

This needs to be resolved before the migration can go live. Options:

- **Seed grants at namespace creation time** — when a namespace is created via `POST /calm/namespaces`, automatically insert a `namespace:admin` grant for the creating user. This requires passing the authenticated username into `NamespaceResource`.
- **Provide a startup seed mechanism** — a configuration-driven or migration-script approach that inserts bootstrap admin grants during deployment.
- **Hybrid: retain JWT scope as a fallback for bootstrap only** — in `secure` mode, allow the `NAMESPACE_ADMIN` JWT scope to act as a super-admin bypass specifically for `UserAccessResource`. This preserves backwards compatibility but re-introduces some scope logic in one place.

The seed-at-namespace-creation approach is the most self-contained and does not require retaining any scope logic.

### 4. No privilege escalation check

The `createUserAccessForNamespace` method accepts a `UserAccess` object in the request body that specifies both the target `username` and their `permission` level. An admin for namespace `foo` can grant any other user any level of access in `foo`. This is intentional and correct, but it means an admin can also create another admin for the same namespace. There is no check preventing privilege escalation within the namespace.

This is acceptable behaviour for an admin role by convention, but worth documenting as a deliberate design decision rather than an oversight.

---

## MCP Tools and Security

The `@Tool`-annotated methods in classes such as `ArchitectureTools` and `SearchTools` are currently **unprotected**. Unlike the REST resource classes, they carry no `@PermittedScopes` annotations and are not reached by either custom filter — they call the store directly. This is a live exposure that exists today regardless of the migration to the new model.

### Security annotations do work on `@Tool` methods

The Quarkiverse MCP server documentation explicitly confirms that security annotations such as `@Authenticated` and `@RolesAllowed` are supported on `@Tool` methods via the standard CDI interceptor mechanism. Because `@PermissionsAllowed` uses the same CDI mechanism as `@RolesAllowed`, it should apply equally. The `params = "namespace"` binding works by matching the Java parameter name at invocation time and does not depend on JAX-RS `@PathParam`, so it transfers directly to `@ToolArg` parameters of the same name.

### Key caveat: error response format

When a security check fails on a `@Tool` method, the MCP client does not receive an HTTP 4xx status code. Instead it receives an MCP protocol error with code `-32001`. This is a protocol-level difference from the REST endpoints and is inherent to how the MCP server handles errors — it cannot be changed by how the annotation is applied.

The Quarkiverse documentation notes this limitation and recommends using HTTP-level `quarkus.http.auth.permission` policies (in `application.properties`) for authentication enforcement, reserving method-level annotations for authorisation. In practice for CalmHub, this means the `secure` and `proxy` profile HTTP permission policies already configured continue to handle authentication at the transport level, and `@PermissionsAllowed` on the tool methods handles the namespace-scoped authorisation check — consistent with how the REST endpoints will work after the migration.

### Recommended action

Securing the MCP tools should be treated as in-scope for this migration, not a follow-up. Each `@Tool` method that takes a `namespace` argument should receive a `@PermissionsAllowed` annotation with the appropriate permission name, mirroring the annotation applied to the equivalent REST endpoint.

---

## Summary

| Concern | JWT Mode today | Proxy Mode today | After migration |
|---|---|---|---|
| Identity establishment | quarkus-oidc (JWT) | `ProxyAccessControlFilter` (header) | quarkus-oidc (JWT) / `ProxyAuthenticationMechanism` (header) |
| Permission loading | `UserAccessValidator` in filter | `UserAccessValidator` in filter | `CalmHubPermissionChecker` queries DB at authorisation time |
| Endpoint enforcement | `@PermittedScopes` + custom filter | `@PermittedScopes` + custom filter (scope check no-op) | `@PermissionsAllowed` + Quarkus runtime |
| Namespace scoping | Manual check in filter | Manual check in filter | `CalmHubPermissionChecker` receives namespace from endpoint args |
| Custom filters | 2 | 2 | 0 |
| Custom annotations | 1 (`@PermittedScopes`) | 1 (`@PermittedScopes`) | 0 |
