---
id: calm-hub-developer-guide
title: Developer Guide
sidebar_label: Developer Guide
sidebar_position: 1
---

# CALM Hub Developer Guide

This guide covers the internal architecture of CALM Hub, how its test suite is structured, and how to extend the storage layer to run CALM Hub from any data source.

---

## Project Structure

```
calm-hub/
├── src/
│   ├── main/java/org/finos/calm/
│   │   ├── config/          # Quarkus CDI configuration beans
│   │   ├── domain/          # Immutable value objects (Architecture, Pattern, …)
│   │   ├── mcp/             # Model Context Protocol tool providers
│   │   ├── resources/       # JAX-RS REST endpoints
│   │   ├── security/        # Auth filters, scope annotations, read-only filter
│   │   ├── services/        # Business-logic layer (thin wrappers today)
│   │   └── store/
│   │       ├── *.java       # Store interfaces (one per resource type)
│   │       ├── mongo/       # MongoDB implementations
│   │       ├── nitrite/     # NitriteDB embedded implementations
│   │       └── producer/    # CDI producers that select the active backend
│   ├── main/resources/
│   │   ├── application.properties
│   │   └── META-INF/native-image/   # GraalVM serialisation config
│   ├── test/java/           # Unit tests (fast, no containers)
│   └── integration-test/java/       # Integration tests (TestContainers)
├── nitrite/                 # Seed scripts for read-only image builds
├── build-native-image.sh
├── build-readonly-image.sh
├── build-readonly-native-image.sh
└── smoke-test.sh
```

---

## The Test Pyramid

CALM Hub uses a three-layer test pyramid designed so that the majority of logic is covered by fast, isolated unit tests, with integration and end-to-end tests providing confidence at the system boundary.

```
     ┌────────────────────────────┐
     │    Docker smoke tests      │  <- gate every Docker publish
     ├────────────────────────────┤
     │    Integration tests       │  <- TestContainers; ~36 tests
     │  mvn -P integration verify │     real MongoDB or NitriteDB
     ├────────────────────────────┤
     │        Unit tests          │  <- Mockito; no containers; fast
     │       (mvn test)           │     90% JaCoCo enforced
     └────────────────────────────┘
```

### Unit Tests

Located in `src/test/java/`. These test individual classes in complete isolation using Mockito mocks for all dependencies.

- **No containers, no network** - run anywhere in milliseconds.
- **JaCoCo coverage gate**: 90% line coverage per class is enforced by CI. The build fails if any non-excluded class falls below this threshold.
- **Test naming**: class `TestXxxShould`, method names in `snake_case` describing the scenario.

```bash
cd calm-hub
../mvnw test
# Coverage report: target/site/jacoco/index.html
```

### Integration Tests

Located in `src/integration-test/java/`. These run the full Quarkus application against a real database using `@QuarkusTest`.

- **MongoDB tests** spin up a `mongo:4.4.3` container via TestContainers (`EndToEndResource`). The container connection string is injected into the Quarkus configuration at runtime.
- **Nitrite tests** start the application in `standalone` profile. No Docker container is needed for the database, but Docker must be available for TestContainers infrastructure.
- Tests exercise the full HTTP round-trip (create namespace → post artefact → retrieve → compare) using REST Assured.

```bash
cd calm-hub
../mvnw -P integration verify   # Requires Docker
```

### Docker Smoke Tests

`smoke-test.sh [BASE_URL] [MODE] [TIMEOUT]` is the shared assertion script used by all four Docker-publish GitHub Actions workflows and can be run locally after a build.

It:
1. Polls `/q/swagger-ui` until the application is ready (Swagger UI endpoint is always available, regardless of storage profile).
2. In **`readonly`** mode: asserts read access across pre-seeded namespaces (`finos`, `traderx`), then verifies `POST`, `PUT`, and `DELETE` each return HTTP 405.
3. In **`readwrite`** mode: creates a namespace, creates an architecture within it, then retrieves the architecture by list, version list, and specific version.

```bash
# Test a locally running image
docker run --rm -p 8080:8080 finos/calm-hub:latest-read-only-static &
bash calm-hub/smoke-test.sh http://localhost:8080 readonly 120
```

---

## Storage Layer Architecture

The storage layer is built around a **clean interface + CDI producer** pattern. Adding a new backend requires no changes to the REST resource layer.

### The Store Interfaces

There are 13 store interfaces in `org.finos.calm.store`, one for each resource type:

| Interface | Resource |
|:----------|:---------|
| `ArchitectureStore` | Architectures |
| `PatternStore` | Patterns |
| `FlowStore` | Flows |
| `StandardStore` | Standards |
| `InterfaceStore` | Interfaces |
| `AdrStore` | ADRs |
| `ControlStore` | Controls |
| `DecoratorStore` | Decorators |
| `CoreSchemaStore` | Core schemas |
| `NamespaceStore` | Namespace management |
| `DomainStore` | Domain management |
| `UserAccessStore` | User access rules |
| `ResourceMappingStore` | Slug → numeric ID mappings |

Each interface exposes the same CRUD contract (list all, get by ID/version, create, update, delete). REST resources depend only on the interface, not on any concrete implementation.

### CDI Producers

Each store has a corresponding producer class in `org.finos.calm.store.producer`. The producer reads the `calm.database.mode` configuration property and returns the appropriate implementation:

```
calm.database.mode=mongo        → MongoXxxStore
calm.database.mode=standalone   → NitriteXxxStore
```

Quarkus CDI resolves the correct bean at application startup. The REST resources receive the right implementation injected automatically.

### Adding a New Storage Backend

To support a new data source (e.g. a cloud object store, an in-memory cache, or a read-through adapter for a legacy system):

1. **Create your implementation package**, e.g. `org.finos.calm.store.mybackend`.
2. **Implement all 13 store interfaces**. Each implementation is a Quarkus `@ApplicationScoped` CDI bean annotated with `@LookupIfProperty(name = "calm.database.mode", stringValue = "mybackend")` so Quarkus only instantiates it when that mode is active.
3. **Update all 13 CDI producers** in `store/producer/` to inject your new class and add a branch for `"mybackend"`.
4. **Add a Maven/Quarkus profile** if your backend requires specific configuration (connection strings, credentials) that should not appear in the default `application.properties`.
5. **Write integration tests** in `src/integration-test/java/` following the existing `Nitrite*Integration` tests as a template. Your test profile should configure `calm.database.mode=mybackend` and set up any required infrastructure (e.g. a TestContainers instance).

### Running CALM Hub from a Custom Read-Only Data Source

The read-only image mechanism generalises to any pre-seeded dataset:

1. Build your seeded database file using the JVM in writable `standalone` mode (or write a custom seed script that calls the REST API while the Hub is running).
2. Extend the two-stage Dockerfile pattern: Stage 1 seeds the database, Stage 2 copies the file into a minimal runtime image and sets `CALM_READONLY=true`.
3. Your custom image starts in seconds with no runtime dependencies and serves exactly the dataset you seeded.

This is how the published `latest-read-only-static` and `latest-read-only-native` images are built: the `calm/` schema directory and `controls/` directory from the repository are seeded during the Docker build, producing an image that ships the canonical CALM specification.

---

## Local Build Scripts

| Script | Output image | Notes |
|:-------|:-------------|:------|
| `../mvnw package` + `Dockerfile.jvm` | `calm-hub:jvm` | Standard JVM build; needs external MongoDB |
| `build-native-image.sh` | `calm-hub:native` | GraalVM native; requires ≥8 GB Docker RAM; ~10 min |
| `build-readonly-image.sh` | `calm-hub:read-only-static` | JVM read-only; use `--no-docker` or `--no-maven` to skip steps |
| `build-readonly-native-image.sh` | `calm-hub:read-only-native` | Native read-only; builds both JVM jar (for seeding) and native binary |

---

## Configuration Reference

| Property | Environment variable | Default | Description |
|:---------|:---------------------|:--------|:------------|
| `calm.database.mode` | `CALM_DATABASE_MODE` | `mongo` | Storage backend: `mongo` or `standalone` |
| `calm.readonly` | `CALM_READONLY` | `false` | Enable read-only mode |
| `calm.standalone.data-directory` | `CALM_STANDALONE_DATA_DIRECTORY` | `~/.calm-hub/data` | NitriteDB file location |
| `calm.standalone.database-name` | `CALM_STANDALONE_DATABASE_NAME` | `calmSchemas` | NitriteDB database filename |
| `calm.mcp.enabled` | `CALM_MCP_ENABLED` | `false` | Enable MCP tool invocations |
| `quarkus.mongodb.connection-string` | `QUARKUS_MONGODB_CONNECTION_STRING` | `mongodb://localhost:27017` | MongoDB connection |

---

## Coverage and CI Requirements

- **JaCoCo**: 90% line coverage per class, enforced by `mvn verify`. Exclusions: `domain/**`, `*Constants`, `CalmHubScopes`, `LogSanitizationPolicy`.
- **Integration tests require Docker** - they cannot be run from an IDE without Docker configured.
- Always run `../mvnw clean verify -Ddependency-check.skip=true` before opening a pull request. This runs the same check as CI.

---

## Further Reading

- [Overview & runtimes](./index.md) - feature summary, image variants, read-only mode
- [MCP & API Reference](./mcp-and-api.md) - MCP tools, OpenAPI, Swagger UI
- [UI Walkthrough](../working-with-calm/calm-hub.md) - visual interface guide
