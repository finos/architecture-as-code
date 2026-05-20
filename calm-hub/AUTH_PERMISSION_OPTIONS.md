# Permission Enforcement Options

Three Quarkus-native approaches for enforcing `@PermissionsAllowed` on CalmHub endpoints. None require a custom `@PermittedScopes`-style annotation or a hand-rolled JAX-RS filter.

---

## Option A — `@PermissionChecker`

No custom `Permission` class. No augmentor. A CDI bean with one checker method per named permission. Quarkus calls the matching method at authorisation time, passing the `SecurityIdentity` and the endpoint's `namespace` parameter.

**Checkers needed:** one per distinct `@PermissionsAllowed` value across the API.

**Resource-type granularity:** only if you encode resource type in the permission name (e.g. `architecture:read`), which causes the combinatorial explosion. Dropping resource type from the name reduces it to three checkers (`calm:read`, `calm:write`, `namespace:admin`) but means any read grant in a namespace allows reading any resource type.

**DB query timing:** at authorisation time, targeted to the specific namespace being accessed.

```java
@ApplicationScoped
@IfBuildProfile({"secure", "proxy"})
public class CalmHubPermissionChecker {

    @Inject UserAccessStore userAccessStore;

    @PermissionChecker("calm:read")
    public boolean canRead(SecurityIdentity identity, String namespace) {
        return check(identity.getPrincipal().getName(), namespace, false);
    }

    @PermissionChecker("calm:write")
    public boolean canWrite(SecurityIdentity identity, String namespace) {
        return check(identity.getPrincipal().getName(), namespace, true);
    }

    @PermissionChecker("namespace:admin")
    public boolean canAdmin(SecurityIdentity identity, String namespace) {
        return check(identity.getPrincipal().getName(), namespace,
                     ResourceType.admin, true);
    }

    private boolean check(String username, String namespace, boolean requireWrite) {
        try {
            return userAccessStore.getUserAccessForUsername(username).stream()
                .anyMatch(grant ->
                    grant.getNamespace().equals(namespace)
                    && grant.getResourceType() != ResourceType.admin
                    && (!requireWrite || grant.getPermission() == Permission.write));
        } catch (UserAccessNotFoundException e) {
            return false;
        }
    }
}
```

Endpoint annotation:
```java
@PermissionsAllowed(value = "calm:read", params = "namespace")
@PermissionsAllowed(value = "calm:write", params = "namespace")
@PermissionsAllowed(value = "namespace:admin", params = "namespace")
```

---

## Option B — Custom `Permission` class + augmentor

Two classes. `CalmHubPermission` is the *required* permission — Quarkus instantiates it from the `@PermissionsAllowed` annotation at check time, binding the `namespace` path parameter via the constructor. `CalmHubGrantedPermission` is a *proxy* stored on the identity by the augmentor — its `implies()` method performs the targeted DB query when Quarkus calls it.

**Checkers needed:** zero. Logic lives in `implies()`.

**Resource-type granularity:** preserved. The permission name (`architecture:read`, `adr:write`, etc.) is parsed inside `implies()`. New resource types require no new Java code — only a new `@PermissionsAllowed` value on the endpoint.

**DB query timing:** at authorisation time (inside `implies()`), targeted to the specific namespace, resource type, and action being checked. The augmentor runs at auth time but does not touch the DB.

### `CalmHubPermission` (required — created by Quarkus)

> Quarkus requires exactly one constructor. The first parameter is always the permission name (String); additional parameters are bound by name from the secured endpoint method.

```java
public class CalmHubPermission extends Permission {
    private final String namespace;

    public CalmHubPermission(String name, String namespace) {
        super(name); // e.g. "architecture:read", "adr:write", "namespace:admin"
        this.namespace = namespace;
    }

    public String getNamespace() { return namespace; }

    @Override public boolean implies(Permission p) { return false; } // unused
    @Override public boolean equals(Object o) { ... }
    @Override public int hashCode() { ... }
    @Override public String getActions() { return ""; }
}
```

### `CalmHubGrantedPermission` (proxy — created by augmentor)

```java
public class CalmHubGrantedPermission extends Permission {
    private final String username;
    private final UserAccessStore store;

    public CalmHubGrantedPermission(String username, UserAccessStore store) {
        super("calm-hub-granted");
        this.username = username;
        this.store = store;
    }

    @Override
    public boolean implies(Permission p) {
        if (!(p instanceof CalmHubPermission required)) return false;
        String[] parts = required.getName().split(":");
        String resource = parts[0]; // e.g. "architecture"
        String action   = parts[1]; // "read" or "write"
        try {
            return store.getUserAccessForUsername(username).stream()
                .anyMatch(grant ->
                    grant.getNamespace().equals(required.getNamespace())
                    && resourceMatches(grant, resource)
                    && actionSufficient(grant, action));
        } catch (UserAccessNotFoundException e) {
            return false;
        }
    }

    private boolean resourceMatches(UserAccess grant, String resource) {
        return grant.getResourceType() == ResourceType.all
            || grant.getResourceType().name().equals(resource);
    }

    private boolean actionSufficient(UserAccess grant, String action) {
        return action.equals("read") || grant.getPermission() == Permission.write;
    }

    @Override public boolean equals(Object o) { ... }
    @Override public int hashCode() { ... }
    @Override public String getActions() { return ""; }
}
```

### Augmentor (no DB query at auth time)

```java
@ApplicationScoped
@IfBuildProfile({"secure", "proxy"})
public class CalmHubSecurityIdentityAugmentor implements SecurityIdentityAugmentor {

    @Inject UserAccessStore userAccessStore;

    @Override
    public Uni<SecurityIdentity> augment(SecurityIdentity identity,
                                         AuthenticationRequestContext context) {
        return Uni.createFrom().item(
            QuarkusSecurityIdentity.builder(identity)
                .addPermission(new CalmHubGrantedPermission(
                    identity.getPrincipal().getName(), userAccessStore))
                .build());
    }
}
```

### Endpoint annotation

```java
@PermissionsAllowed(value = "architecture:read", permission = CalmHubPermission.class, params = "namespace")
@PermissionsAllowed(value = "adr:write",         permission = CalmHubPermission.class, params = "namespace")
@PermissionsAllowed(value = "namespace:admin",   permission = CalmHubPermission.class, params = "namespace")
```

---

## Option C — Single `Permission` class with constructor parameter binding

One class, no `@PermissionChecker` methods. `implies()` is the single checking method.

The key mechanism: Quarkus binds endpoint method parameters to custom `Permission` constructor parameters **by name**. When a `@PathParam("namespace") String namespace` exists on the endpoint method and the constructor also has a `String namespace` parameter, Quarkus passes the runtime value automatically. This means the same class is used for both the permissions the augmentor stores on the identity (namespace from DB grant) and the permission Quarkus constructs at check time (namespace from the request path). `implies()` then does a pure in-memory comparison between the two — no DB access.

**Classes needed:** 1 (`CalmHubPermission`) + 1 augmentor.

**DB query timing:** authentication time — one query per request, grants expanded into permission objects and stored on the identity.

**Checker methods:** zero — `implies()` is the single checker.

**Scales with new resource types:** yes. Adding a new endpoint with a new permission value requires no new Java code.

### `CalmHubPermission`

The constructor parses `resource` and `action` from the permission name (e.g. `"architecture:read"` → `resource="architecture"`, `action="read"`). The `namespace` parameter is bound automatically by Quarkus from the endpoint method at check time, and supplied explicitly by the augmentor from the DB grant at auth time.

```java
public class CalmHubPermission extends Permission {
    private final String namespace;
    private final String resource;
    private final String action; // "read" or "write"

    // Quarkus binds namespace from the endpoint's path parameter by name matching.
    // The augmentor calls this constructor directly with the grant's namespace.
    public CalmHubPermission(String name, String namespace) {
        super(name); // e.g. "architecture:read"
        String[] parts = name.split(":");
        this.resource  = parts[0]; // "architecture"
        this.action    = parts[1]; // "read" or "write"
        this.namespace = namespace;
    }

    @Override
    public boolean implies(Permission p) {
        if (!(p instanceof CalmHubPermission required)) return false;
        return this.namespace.equals(required.namespace)
            && this.resource.equals(required.resource)
            && (this.action.equals("write") || required.action.equals("read"));
    }

    @Override public boolean equals(Object o) { ... }
    @Override public int hashCode() { ... }
    @Override public String getActions() { return ""; }
}
```

### Augmentor

Loads all grants at auth time, expands each into one or two `CalmHubPermission` objects (read + write if the grant is write-level; `resourceType=all` expands to one per resource type), and stores them on the identity.

```java
@ApplicationScoped
@IfBuildProfile({"secure", "proxy"})
public class CalmHubSecurityIdentityAugmentor implements SecurityIdentityAugmentor {

    @Inject UserAccessStore userAccessStore;

    @Override
    public Uni<SecurityIdentity> augment(SecurityIdentity identity,
                                         AuthenticationRequestContext context) {
        String username = identity.getPrincipal().getName();
        return context.runBlocking(() -> {
            QuarkusSecurityIdentity.Builder builder =
                QuarkusSecurityIdentity.builder(identity);
            try {
                userAccessStore.getUserAccessForUsername(username)
                    .stream()
                    .flatMap(CalmHubSecurityIdentityAugmentor::toPermissions)
                    .forEach(builder::addPermission);
            } catch (UserAccessNotFoundException ignored) {}
            return builder.build();
        });
    }

    private static Stream<CalmHubPermission> toPermissions(UserAccess grant) {
        Set<String> resources = grant.getResourceType() == ResourceType.all
            ? Set.of("architecture", "pattern", "flow", "adr")
            : Set.of(grant.getResourceType().name());
        return resources.stream().flatMap(resource -> {
            var perms = Stream.<CalmHubPermission>builder()
                .add(new CalmHubPermission(resource + ":read", grant.getNamespace()));
            if (grant.getPermission() == UserAccess.Permission.write)
                perms.add(new CalmHubPermission(resource + ":write", grant.getNamespace()));
            return perms.build();
        });
    }
}
```

### Endpoint annotation

The `permission` attribute tells Quarkus which class to instantiate for the check. The `namespace` constructor parameter is bound automatically from the endpoint method's `namespace` parameter — no `params` attribute needed when names match.

```java
@GET
@PermissionsAllowed(value = "architecture:read", permission = CalmHubPermission.class)
public Response getArchitectures(@PathParam("namespace") String namespace) { ... }

@POST
@PermissionsAllowed(value = "architecture:write", permission = CalmHubPermission.class)
public Response createArchitecture(@PathParam("namespace") String namespace, ...) { ... }

@GET
@PermissionsAllowed(value = "adr:read", permission = CalmHubPermission.class)
public Response getAdrs(@PathParam("namespace") String namespace) { ... }

@POST
@PermissionsAllowed(value = "namespace:admin", permission = CalmHubPermission.class)
public Response createUserAccess(@PathParam("namespace") String namespace, ...) { ... }
```

MCP tools work identically — `namespace` is a `@ToolArg` parameter, name-matched the same way:

```java
@Tool(description = "List all architectures in a namespace.")
@PermissionsAllowed(value = "architecture:read", permission = CalmHubPermission.class)
public ToolResponse listArchitectures(
        @ToolArg(description = "The namespace") String namespace) { ... }
```

---

## Option D — Custom `HttpSecurityPolicy`

A single CDI bean implementing `HttpSecurityPolicy`. Quarkus calls `checkPermission()` on every matched HTTP request before it reaches the endpoint, passing the raw `RoutingContext` (full HTTP request) and the `SecurityIdentity`. The method extracts namespace from the path, determines the required action from the HTTP method, queries the DB, and returns permit or deny. No annotations on endpoints, no custom `Permission` class, no augmentor.

**Classes needed:** 1 (the policy).

**Checker methods:** 1 (`checkPermission`).

**Scales with new resource types:** yes — the path parser is the only thing that needs updating, and only if resource type enforcement is needed.

**Limitation:** the `namespace` and resource type come from parsing the HTTP path. This works perfectly for REST endpoints. For MCP tools, the `namespace` is a parameter in the tool call payload (the JSON body), not in the URL — so this policy cannot enforce namespace-scoped authorisation on MCP tool invocations. MCP tools would need a separate approach (Options A, B, or C).

### Implementation

```java
@ApplicationScoped
@IfBuildProfile({"secure", "proxy"})
public class CalmHubHttpSecurityPolicy implements HttpSecurityPolicy {

    @Inject UserAccessStore userAccessStore;

    @Override
    public String name() {
        return "calm-hub";
    }

    @Override
    public Uni<CheckResult> checkPermission(RoutingContext event,
                                             Uni<SecurityIdentity> identity,
                                             AuthorizationRequestContext context) {
        return identity.flatMap(id -> {
            String username  = id.getPrincipal().getName();
            String path      = event.normalizedPath();
            String method    = event.request().method().name();
            String namespace = extractNamespace(path);
            String resource  = extractResource(path);
            boolean requireWrite = isWriteMethod(method);

            // Paths with no namespace are accessible to any authenticated user
            if (namespace == null) {
                return id.isAnonymous()
                    ? CheckResult.deny()
                    : CheckResult.permit();
            }

            return context.runBlocking(() -> {
                try {
                    boolean permitted = userAccessStore
                        .getUserAccessForUsername(username).stream()
                        .anyMatch(grant ->
                            grant.getNamespace().equals(namespace)
                            && resourceMatches(grant, resource)
                            && (!requireWrite || grant.getPermission() == UserAccess.Permission.write));
                    return permitted ? CheckResult.PERMIT : CheckResult.DENY;
                } catch (UserAccessNotFoundException e) {
                    return CheckResult.DENY;
                }
            });
        });
    }

    private String extractNamespace(String path) {
        // /calm/namespaces/{namespace}/...
        String[] parts = path.split("/");
        for (int i = 0; i < parts.length - 1; i++) {
            if ("namespaces".equals(parts[i])) return parts[i + 1];
        }
        return null;
    }

    private String extractResource(String path) {
        // last meaningful path segment: architectures, patterns, flows, adrs, user-access
        String[] parts = path.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            String segment = parts[i];
            if (segment.matches("architectures|patterns|flows|adrs|user-access")) return segment;
        }
        return "all";
    }

    private boolean resourceMatches(UserAccess grant, String resource) {
        return grant.getResourceType() == UserAccess.ResourceType.all
            || grant.getResourceType().name().equals(resource);
    }

    private boolean isWriteMethod(String method) {
        return Set.of("POST", "PUT", "PATCH", "DELETE").contains(method);
    }
}
```

### Configuration

In `application-secure.properties` and `application-proxy.properties`:

```properties
quarkus.http.auth.permission.calm-hub.paths=/calm/*
quarkus.http.auth.permission.calm-hub.policy=calm-hub
```

Alternatively, use `@AuthorizationPolicy("calm-hub")` directly on JAX-RS resource classes instead of the properties configuration — this is more explicit and keeps the security declaration close to the code.

### What you don't need

- No `@PermissionsAllowed` on any endpoint method
- No `@PermittedScopes` (removed)
- No augmentor
- No custom `Permission` class

---

## Comparison

| | Option A (`@PermissionChecker`) | Option B (custom `Permission`, lazy) | Option C (single `Permission` class) | Option D (`HttpSecurityPolicy`) |
|---|---|---|---|---|
| Java classes to write | 1 (checker) | 3 (permission, granted permission, augmentor) | 2 (permission + augmentor) | 1 (policy) |
| Checker / policy methods | One per permission name | Zero | Zero (`implies()` is the checker) | One (`checkPermission`) |
| Scales with new resource types | Only if resource type not in name | Yes — annotation value only | Yes — annotation value only | Yes — path parser only |
| Resource-type granularity | Requires more checker methods | Preserved at no extra cost | Preserved at no extra cost | Preserved via path parsing |
| DB query timing | Authorisation time | Authorisation time (inside `implies()`) | Authentication time (always) | Authorisation time |
| DB query scope | All grants for user, filtered in memory | All grants for user, filtered in memory | All grants for user, expanded into permission objects | All grants for user, filtered in memory |
| Endpoint annotations needed | `@PermissionsAllowed` on every method | `@PermissionsAllowed` on every method | `@PermissionsAllowed` on every method | None (or `@AuthorizationPolicy` on class) |
| MCP tool support | Yes (CDI interceptor) | Yes (CDI interceptor) | Yes (CDI interceptor) | No — namespace not in URL for MCP calls |
| Unusual patterns | None | DB access inside `Permission.implies()` | None | None |

Option D is the most natural fit for the stated goal — one service, one method, all context passed in — and produces the simplest endpoint code. The MCP limitation is the deciding constraint: if MCP tools also need namespace-scoped enforcement, Option D cannot cover them and a second mechanism would be needed. Options A–C use CDI interceptors and work identically on REST endpoints and MCP tools.
