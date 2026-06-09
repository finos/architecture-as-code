# CALM Hub - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM Hub backend codebase.

## Tech Stack

- **Language**: Java 21
- **Framework**: Quarkus 3.34+ (Reactive REST, CDI) — `quarkus.platform.version` is pinned to `3.34.7` in the root `pom.xml`
- **Build Tool**: Maven (via parent POM)
- **Databases**: 
  - MongoDB (production default)
  - NitriteDB (embedded, standalone mode)
- **Testing**: JUnit 5, TestContainers
- **API Docs**: OpenAPI/Swagger UI
- **Security**: Per-namespace permissions enforced via Quarkus Security (`org.finos.calm.security`); three auth modes — open (default), OIDC/Keycloak (`secure`), and proxy-injected header (`proxy-auth`)

> **Note**: Netty is pinned to `4.1.x` (currently `4.1.132.Final` via `netty-bom` in the root `pom.xml`) to mitigate CVEs. It must stay on 4.1.x — Quarkus 3.x applies a `CleanerJava9` bytecode transformation incompatible with Netty 4.2.

## Key Commands

```bash
# Build & Test
../mvnw clean package                    # Full build
../mvnw -P integration verify            # Include integration tests
../mvnw test                              # Unit tests only

# Development Mode (Hot Reload)
../mvnw quarkus:dev                       # Default (MongoDB)
../mvnw quarkus:dev -Pstandalone                     # Standalone (NitriteDB) — use -Pstandalone, NOT -Dquarkus.profile=standalone
../mvnw quarkus:dev -Dquarkus.profile=secure         # Secure mode (Keycloak)

# Docker
docker-compose up                         # From deploy/ - production-like
cd local-dev && docker-compose up        # MongoDB for development

# Packaging
../mvnw package                           # Create quarkus-app/
java -jar target/quarkus-app/quarkus-run.jar  # Run packaged app

# Docker Build
docker buildx build --platform linux/amd64,linux/arm64 \
  -f src/main/docker/Dockerfile.jvm -t calm-hub --push .
```

## Architecture Overview

### Directory Structure
```
src/
├── main/java/org/finos/calm/
│   ├── resources/            # REST API endpoints (namespace-scoped under /calm/...)
│   ├── services/             # Business logic
│   ├── security/             # Auth: CalmHubPermissionChecker, CalmHubScopes,
│   │                         #   UserAccessValidator, NoAuthAuthenticationMechanism,
│   │                         #   ProxyAuthenticationMechanism, ReadOnlyRequestFilter
│   ├── mcp/                  # MCP server (@Tool classes under mcp/tools/)
│   ├── store/                # Data access layer
│   │   ├── interfaces        # Store abstractions
│   │   ├── mongo/           # MongoDB implementations
│   │   ├── nitrite/         # NitriteDB implementations
│   │   └── producer/        # CDI producers for store selection
│   ├── domain/               # Domain models
│   └── config/               # Configuration beans
├── test/java/                # Unit tests
└── integration-test/java/    # Integration tests (TestContainers)
```

### REST API Pattern (Quarkus JAX-RS)

Resources are **namespace-scoped** under `/calm/...`. `ArchitectureResource` and
`NamespaceResource` both use `@Path("/calm/namespaces")` with sub-paths such as
`{namespace}/architectures`. Endpoints are guarded with `@PermissionsAllowed`
(e.g. `CalmHubScopes.READ` / `WRITE`).

```java
@Path("/calm/namespaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ArchitectureResource {

    @Inject
    ArchitectureStore store;

    @GET
    @Path("{namespace}/architectures")
    @PermissionsAllowed(CalmHubScopes.READ)
    public Response getArchitecturesForNamespace(
            @PathParam("namespace") @Pattern(regexp = NAMESPACE_REGEX, message = NAMESPACE_MESSAGE) String namespace
    ) {
        return Response.ok(new ValueWrapper<>(store.getArchitecturesForNamespace(namespace))).build();
    }
}
```

Resource types are not limited to architectures/patterns/controls — the `resources/`
package also covers ADR, Decorator, Domain, Flow, Interface, Standard, Timeline,
Search, and UserAccess (per-namespace and domain-level access grants).

### Storage Mode Selection

CALM Hub supports pluggable storage backends via CDI Producers:

**Configuration Property**: `calm.database.mode` (default: `mongo`)

**Modes**:
1. **mongo** (default) - MongoDB production storage
2. **standalone** - NitriteDB embedded storage (no external DB needed)

**How It Works**:
- Store interfaces defined in `org.finos.calm.store`
- Implementations in `store/mongo/` and `store/nitrite/`
- Producers in `store/producer/` select implementation at runtime

Example Producer Pattern:
```java
@ApplicationScoped
public class ArchitectureStoreProducer {
    
    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;
    
    @Inject MongoArchitectureStore mongoStore;
    
    @Inject NitriteArchitectureStore nitriteStore;
    
    @Produces
    @ApplicationScoped
    public ArchitectureStore produceStore() {
        return "standalone".equals(databaseMode) 
            ? nitriteStore 
            : mongoStore;
    }
}
```

### Security & Authorization

Authorization is **per-namespace**, not role-flat. Entitlements are stored as
`UserAccess` records (in the active store), each granting a user `read`, `write`,
or `admin` action on a single namespace, plus a `global_admin` scope that applies
across all namespaces. Scope constants live in
`org.finos.calm.security.CalmHubScopes` (`READ`, `WRITE`, `ADMIN`,
`DOMAIN_READ`, `DOMAIN_WRITE`, `GLOBAL_ADMIN`). Enforcement runs through Quarkus
Security: `@PermissionsAllowed` on resource methods is resolved by
`CalmHubPermissionChecker`, which consults `UserAccessValidator` against the
caller's grants. See [PERMISSIONS.md](./PERMISSIONS.md) for the full model.

There are **three auth modes**, each selected by a separate property file:

**Default** (open, no auth) — `application.properties`:
- `quarkus.oidc.tenant-enabled=false`, `calm.auth.enabled` unset (permission checks pass)
- All endpoints open; good for development

**Secure** (OIDC / Keycloak) — `application-secure.properties`:
- `quarkus.oidc.tenant-enabled=true`, `calm.auth.enabled=true`
- `quarkus.oidc.auth-server-url=https://calm-hub.finos.org:9443/realms/calm-hub-realm`
  (requires an `/etc/hosts` entry mapping `calm-hub.finos.org`; uses self-signed certs)
- App serves SSL on port **8443** (`quarkus.http.ssl-port=8443`)

**Proxy-auth** (proxy-injected header) — `application-proxy-auth.properties`:
- `quarkus.oidc.enabled=false`, `calm.auth.enabled=true`
- The upstream proxy injects the authenticated username in a header (default
  `Remote-User`, overridable via `calm.security.proxy.username-header`), handled by
  `ProxyAuthenticationMechanism` / `ProxyIdentityProvider`

In the open default, `NoAuthAuthenticationMechanism` supplies an identity so
permission checks pass without a token.

## Key Concepts

### Quarkus Dev Mode
- Hot reload for Java code changes
- Accessible at http://localhost:8080
- Swagger UI at http://localhost:8080/q/swagger-ui
- Dev UI at http://localhost:8080/q/dev

### Adding New Storage Modes
1. Create implementation package: `org.finos.calm.store.newmode`
2. Implement store interfaces
3. Update Producer classes to inject and conditionally return new implementation
4. Add mode to configuration documentation

### MCP Server
- An MCP server exposes CALM Hub operations as tools to AI clients
- Tool classes live in `mcp/tools/` (~13 classes; the `*Tools` ones carry `@Tool` methods)
- **Gated by `calm.mcp.enabled`** (default `false`): when disabled, every `@Tool`
  method returns a disabled error, though the `/mcp` HTTP endpoint stays reachable
- Enable with `-Dcalm.mcp.enabled=true` or `CALM_MCP_ENABLED=true`

### Read-Only Deployment Mode
- `calm.readonly=true` opens Nitrite with `readOnly(true)` and installs
  `ReadOnlyRequestFilter`, which rejects mutating verbs (POST/PUT/PATCH/DELETE)
  on `/calm/*` with `405 Method Not Allowed`
- `build-readonly-image.sh` packages a static, pre-seeded read-only Docker image
  (Maven package + stage `calm/` schemas and controls + build `Dockerfile.readonly-static`)

### Local-Dev Nitrite Seeding
- `nitrite/init-nitrite.sh` is the standard script for seeding a local Nitrite
  database for standalone development; `nitrite/seed-readonly.sh` seeds the
  read-only variant

### Integration Tests
- Located in `src/integration-test/java/`
- Use TestContainers (requires Docker)
- Run via Maven only: `../mvnw -P integration verify`
- Cannot run from IDE unless Docker configured

### API Documentation
- OpenAPI spec auto-generated by Quarkus
- Available at `/q/swagger-ui` in dev/secure mode
- Annotations: `@Operation`, `@APIResponse`, etc.

## Testing

### Coverage Requirements

**CRITICAL**: JaCoCo enforces **90% line coverage per class**. CI runs `mvn clean verify -Ddependency-check.skip=true` which includes the JaCoCo coverage check. Any class below 90% will fail the build.

```bash
# Run the same check CI uses — always run this before pushing changes
../mvnw clean verify -Ddependency-check.skip=true
```

**Exclusions** (from `pom.xml`): `**/*Builder.*`, `**/*CalmResourceErrorResponses.*`, `**/*Constants.*`, `**/*NamespaceStandardSummary.*`, `**/*ArchitectureRequest.*`, `**/config/**/*`, and `**/domain/**/*` are excluded from the coverage check.

If coverage drops below 90% for a class you've modified, add tests for uncovered error paths (catch blocks, edge cases) until the threshold is met. Check the JaCoCo report at `target/site/jacoco/` for details on uncovered lines.

### Unit Tests
```bash
../mvnw test                  # All unit tests
../mvnw test -Dtest=ClassName # Specific test class
```

### Integration Tests
```bash
../mvnw -P integration verify  # Requires Docker running
```

### Test Structure
- `src/test/java/` - Unit tests (fast, no containers)
- `src/integration-test/java/` - Integration tests (TestContainers)

### Test Conventions

All tests must follow these conventions. The Pattern and Architecture tests are the reference implementations — Controls and any new resource types must match them.

#### Class & Method Naming
- Test class: `Test<ClassName>Should` (e.g. `TestPatternResourceShould`, `TestMongoPatternStoreShould`)
- Test methods: `snake_case` descriptive names (e.g. `return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_patterns`)

#### Resource Tests (`@QuarkusTest` + `@InjectMock`)

**Mock field naming**: Prefix store mocks with `mock` — e.g. `mockPatternStore`, `mockControlStore`, not `patternStore` or `controlStore`.

```java
@InjectMock
PatternStore mockPatternStore;
```

**Parameterized tests for exception/status-code scenarios**: Use `@ParameterizedTest` + `@MethodSource` to consolidate multiple error-path tests into one:

```java
static Stream<Arguments> provideParametersForGetPatternVersionTests() {
    return Stream.of(
            Arguments.of("finos", new NamespaceNotFoundException(), 404),
            Arguments.of("finos", new PatternNotFoundException(), 404),
            Arguments.of("finos", null, 200)
    );
}

@ParameterizedTest
@MethodSource("provideParametersForGetPatternVersionTests")
void respond_correctly_to_get_pattern_versions_query(String namespace, Throwable exceptionToThrow, int expectedStatusCode) throws Exception {
    // ...
}
```

**Input validation tests**: Every endpoint with `@Pattern`-annotated path parameters must have corresponding 400-validation tests:
- Invalid domain format (e.g. `invalid_domain` with underscores) → 400 with `DOMAIN_NAME_MESSAGE`
- Invalid namespace format (e.g. `fin_os`) → 400 with `NAMESPACE_MESSAGE`
- Invalid version format (e.g. `1.0.invalid0`) → 400 with `VERSION_MESSAGE`

```java
@Test
void return_a_400_when_an_invalid_format_of_namespace_is_provided_on_get_patterns() {
    given()
            .when()
            .get("/calm/namespaces/fin_os/patterns")
            .then()
            .statusCode(400)
            .body(containsString(NAMESPACE_MESSAGE));
}
```

Import validation constants from `ResourceValidationConstants`:
```java
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_NAME_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VERSION_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
```

#### Mongo Store Tests (`@QuarkusTest` + `@InjectMock`)

**Inner interfaces for type-safe mocking** — never use `@SuppressWarnings("unchecked")`:

```java
private interface DocumentFindIterable extends FindIterable<Document> {
}

private interface DocumentMongoCollection extends MongoCollection<Document> {
}

@BeforeEach
void setup() {
    patternCollection = Mockito.mock(DocumentMongoCollection.class);
    // ...
}

private FindIterable<Document> mockFindIterable() {
    return Mockito.mock(DocumentFindIterable.class);
}
```

**Field naming**: Use short names without the `mongo` prefix:
- `counterStore` (not `mongoCounterStore`)
- `domainStore` (not `mongoDomainStore`)
- `namespaceStore` (not `mongoNamespaceStore`)

**Shared fixture helpers**: Extract common Document setup into reusable helpers:
- `setupInvalidPattern()` — mock find returning null for not-found scenarios
- `mockSetupPatternDocumentWithVersions()` — mock a full document with versions
- `setupPatternVersionDocument()` — build a Document fixture

#### Nitrite Store Tests (`@ExtendWith(MockitoExtension.class)`)

Nitrite tests use plain Mockito (not `@QuarkusTest`). Follow the same patterns as Mongo store tests where applicable.

**Constants**: Always use `private static final` (not `private final`):
```java
private static final String NAMESPACE = "finos";
private static final int PATTERN_ID = 42;
```

## Common Tasks

### Adding a New REST Endpoint
1. Create resource class in `resources/`
2. Implement service logic in `services/`
3. Add store methods if needed in `store/`
4. Write unit tests in `test/`
5. Add integration test in `integration-test/`
6. Document with OpenAPI annotations

### Adding a New Storage Backend
1. Create package: `org.finos.calm.store.mybackend`
2. Implement all store interfaces
3. Update all Producer classes to include new implementation
4. Add conditional logic based on `calm.database.mode`
5. Document in README.md

### Working with MongoDB
1. Start dev MongoDB: `cd local-dev && docker-compose up`
2. Connection details in `application.properties`
3. Database name: `calm-hub` (default)

### Secure Mode Development
1. Generate certificates (see README.md)
2. Add an `/etc/hosts` entry mapping `calm-hub.finos.org` to localhost (the OIDC
   `auth-server-url` uses this hostname, not `localhost`)
3. Start Keycloak: `cd keycloak-dev && docker-compose up`
4. Login to Keycloak: https://calm-hub.finos.org:9443 (admin/password)
5. Switch to `calm-hub-realm`
6. Use `demo` user for testing
7. Run app: `../mvnw quarkus:dev -Dquarkus.profile=secure` (serves SSL on port 8443)

## Configuration Files

- `pom.xml` - Maven dependencies and build config
- `src/main/resources/application.properties` - Default (open) config
- `src/main/resources/application-secure.properties` - Secure (OIDC/Keycloak) profile config
- `src/main/resources/application-proxy-auth.properties` - Proxy-auth profile config (proxy-injected `Remote-User` header)
- `PERMISSIONS.md` - Per-namespace permission model reference

## Dependencies on Other Packages

```
calm-hub depends on:
  └── cli (via parent POM, but loosely coupled)
```

CALM Hub is largely independent - it's a standalone REST API server.

## Common Pitfalls

1. **TestContainers Errors**: Ensure Docker is running before integration tests
2. **Port Conflicts**: Check if port 8080 is free (or change `quarkus.http.port`)
3. **MongoDB Connection**: Start MongoDB before dev mode (unless using `-Pstandalone` for NitriteDB)
   - **IMPORTANT**: Use `-Pstandalone` (Maven profile), not `-Dquarkus.profile=standalone`. The Maven plugin
     forks a separate JVM and the `-D` flag does not reliably propagate; the Maven profile injects
     `quarkus.profile=standalone` via the plugin's own `systemProperties` configuration.
4. **Certificate Issues**: Use exact CN in URLs when using self-signed certs
5. **Profile Selection**: Remember to pass `-Dquarkus.profile=secure` for secure mode

## Known Issues

### Java 24+ Thread-Local Access Warning
If using Java 24 or later, you may see thread-local access warnings during tests:
```
java.lang.IllegalAccessError: module java.base does not open java.lang to unnamed module
```

These warnings are harmless and don't affect test results. To suppress them, add JVM options:
```bash
../mvnw test -Dquarkus.args="--add-opens java.base/java.lang=ALL-UNNAMED"
```

**Recommended**: Use Java 21 LTS for development (as specified in pom.xml).

## Quarkus-Specific Tips

### Configuration
- Use `@ConfigProperty` to inject config values
- Profile-specific: `%profile.property.name=value`
- Environment overrides: `PROPERTY_NAME=value`

### CDI (Dependency Injection)
- Use `@Inject` for dependency injection
- Scopes: `@ApplicationScoped`, `@RequestScoped`
- Producers: `@Produces` for factory methods

### REST Endpoints
- `@Path` for routing
- `@GET`, `@POST`, `@PUT`, `@DELETE` for HTTP methods
- `@PathParam`, `@QueryParam` for parameters

## Useful Links

- [README.md](./README.md) - Detailed setup and deployment guide
- [Quarkus Docs](https://quarkus.io/guides/) - Framework documentation
- [Root README](../README.md) - Monorepo overview
- Swagger UI: http://localhost:8080/q/swagger-ui (when running)
