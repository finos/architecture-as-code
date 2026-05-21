# Auth Implementation — Code Reference

Supporting code sketches for [AUTH_ANALYSIS.md](AUTH_ANALYSIS.md). These are illustrative; exact method signatures and imports will be confirmed during implementation.

---

## 1. `CalmHubPermissionChecker`

A single CDI bean satisfying all `@PermissionsAllowed` checks. Each public method handles one named permission; all delegate to a shared private helper.

```java
@ApplicationScoped
@IfBuildProfile({"secure", "proxy"})
public class CalmHubPermissionChecker {

    private final UserAccessStore userAccessStore;

    public CalmHubPermissionChecker(UserAccessStore userAccessStore) {
        this.userAccessStore = userAccessStore;
    }

    @PermissionChecker("architecture:read")
    public boolean canReadArchitecture(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, false);
    }

    @PermissionChecker("architecture:write")
    public boolean canWriteArchitecture(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.architectures, true);
    }

    @PermissionChecker("pattern:read")
    public boolean canReadPattern(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, false);
    }

    @PermissionChecker("pattern:write")
    public boolean canWritePattern(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.patterns, true);
    }

    @PermissionChecker("flow:read")
    public boolean canReadFlow(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, false);
    }

    @PermissionChecker("flow:write")
    public boolean canWriteFlow(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.flows, true);
    }

    @PermissionChecker("adr:read")
    public boolean canReadAdr(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, false);
    }

    @PermissionChecker("adr:write")
    public boolean canWriteAdr(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.adrs, true);
    }

    @PermissionChecker("namespace:admin")
    public boolean canAdminNamespace(SecurityIdentity identity, String namespace) {
        return hasAccess(identity, namespace, UserAccess.ResourceType.admin, true);
    }

    private boolean hasAccess(SecurityIdentity identity, String namespace,
                               UserAccess.ResourceType requiredType, boolean requireWrite) {
        String username = identity.getPrincipal().getName();
        try {
            return userAccessStore.getUserAccessForUsername(username).stream()
                    .anyMatch(grant -> namespaceMatches(grant, namespace)
                            && resourceMatches(grant, requiredType)
                            && permissionSufficient(grant, requireWrite));
        } catch (UserAccessNotFoundException e) {
            return false;
        }
    }

    private boolean namespaceMatches(UserAccess grant, String namespace) {
        return grant.getNamespace().equals(namespace);
    }

    private boolean resourceMatches(UserAccess grant, UserAccess.ResourceType required) {
        return grant.getResourceType() == UserAccess.ResourceType.all
                || grant.getResourceType() == required;
    }

    private boolean permissionSufficient(UserAccess grant, boolean requireWrite) {
        return !requireWrite || grant.getPermission() == UserAccess.Permission.write;
    }
}
```

---

## 2. `ProxyAuthenticationMechanism`

Active only in the `proxy` profile. Reads the configured header and creates a `SecurityIdentity` with the header value as the principal name. The `CalmHubPermissionChecker` then handles authorisation for both profiles uniformly.

```java
@ApplicationScoped
@IfBuildProfile("proxy")
public class ProxyAuthenticationMechanism implements HttpAuthenticationMechanism {

    @ConfigProperty(name = "calm.security.proxy.username-header", defaultValue = "Remote-User")
    String usernameHeader;

    @Override
    public Uni<SecurityIdentity> authenticate(RoutingContext context,
                                              IdentityProviderManager identityManager) {
        String username = context.request().getHeader(usernameHeader);
        if (username == null || username.isBlank()) {
            return Uni.createFrom().optional(Optional.empty());
        }
        TrustedAuthRequest request = new TrustedAuthRequest(new QuarkusPrincipal(username));
        return identityManager.authenticate(request);
    }

    @Override
    public Uni<ChallengeData> getChallenge(RoutingContext context) {
        return Uni.createFrom().item(
                new ChallengeData(HttpResponseStatus.UNAUTHORIZED.code(), null, null));
    }


    @Override
    public Set<Class<? extends AuthenticationRequest>> getCredentialTypes() {
        return Set.of(TrustedAuthRequest.class);
    }
}
```

---

## 3. Endpoint Annotation Examples

The `params = "namespace"` binding matches the Java parameter name on the method, not a JAX-RS annotation — so the same pattern applies to both REST endpoints and MCP `@Tool` methods.

### REST — read endpoint
```java
@GET
@Path("/{namespace}/architectures")
@PermissionsAllowed(value = "architecture:read", params = "namespace")
public Response getArchitectures(@PathParam("namespace") String namespace) { ... }
```

### REST — write endpoint
```java
@POST
@Path("/{namespace}/architectures")
@PermissionsAllowed(value = "architecture:write", params = "namespace")
public Response createArchitecture(@PathParam("namespace") String namespace, ...) { ... }
```

### REST — namespace admin (UserAccessResource)
```java
@GET
@Path("/{namespace}/user-access")
@PermissionsAllowed(value = "namespace:admin", params = "namespace")
public Response getUserAccess(@PathParam("namespace") String namespace) { ... }
```

### REST — no-namespace endpoints
```java
@GET
@Path("/namespaces")
@Authenticated
public Response getNamespaces() { ... }

@GET
@Path("/search")
@Authenticated
public Response search(@QueryParam("q") String query) { ... }
```

### MCP tool — read
```java
@Tool(description = "List all architectures in a CalmHub namespace.")
@PermissionsAllowed(value = "architecture:read", params = "namespace")
public ToolResponse listArchitectures(
        @ToolArg(description = "The namespace to list architectures from") String namespace) { ... }
```

### MCP tool — write
```java
@Tool(description = "Create a new architecture in a namespace.")
@PermissionsAllowed(value = "architecture:write", params = "namespace")
public ToolResponse createArchitecture(
        @ToolArg(description = "The namespace to create the architecture in") String namespace,
        ...) { ... }
```

---

## 4. `UserAccessValidator` — retained method only

```java
// isUserAuthorized() and all helpers are deleted.
// Only getReadableNamespaces() is kept for SearchResource result filtering.

public Set<String> getReadableNamespaces(String username) {
    try {
        return userAccessStore.getUserAccessForUsername(username)
                .stream()
                .map(UserAccess::getNamespace)
                .collect(Collectors.toSet());
    } catch (UserAccessNotFoundException ex) {
        logger.debug("No access permissions found for user [{}]", username);
        return Set.of();
    }
}
```

---

## 5. Test Sketches

### `TestCalmHubPermissionCheckerShould`

```java
@Test
void read_grant_allows_read_check() {
    // given a read grant for architectures in namespace foo
    // when canReadArchitecture is called with identity(alice) and namespace foo
    // then returns true
}

@Test
void write_grant_allows_read_check() {
    // given a write grant for architectures in namespace foo
    // when canReadArchitecture is called
    // then returns true (write implies read)
}

@Test
void read_grant_denies_write_check() {
    // given a read grant for architectures in namespace foo
    // when canWriteArchitecture is called
    // then returns false
}

@Test
void grant_for_different_namespace_denies_check() {
    // given a write grant for architectures in namespace bar
    // when canWriteArchitecture is called with namespace foo
    // then returns false
}

@Test
void all_resource_type_satisfies_specific_resource_check() {
    // given a write grant with resourceType=all in namespace foo
    // when canReadArchitecture, canReadPattern, canReadFlow, canReadAdr are called
    // then all return true
}

@Test
void user_with_no_grants_is_denied() {
    // given userAccessStore throws UserAccessNotFoundException
    // when any checker method is called
    // then returns false
}
```

### `TestProxyAuthenticationMechanismShould`

```java
@Test
void present_header_produces_identity_with_correct_principal() {
    // given a request with Remote-User: alice
    // then the resulting SecurityIdentity has principal name "alice"
}

@Test
void missing_header_returns_empty_identity() {
    // given a request with no Remote-User header
    // then authenticate() returns an empty Optional (triggering 401 challenge)
}

@Test
void blank_header_is_treated_as_missing() {
    // given Remote-User: "   "
    // then same result as missing header
}
```
