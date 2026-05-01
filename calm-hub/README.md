# Calm Hub

## Quick Start - No Coding, Just Product

You can run a version of Calm Hub locally, by using the `docker-compose` deploy configuration.
Note, this currently depends on @jpgough-ms publishing a Docker image, which will be fixed in the next few weeks by producing a build from this mono-repo.
The only supported architectures at this time are `amd64` and `arm64`.

```shell
cd deploy
docker-compose up
```

A version of CALM Hub will be up and running on: [http://localhost:8080](http://localhost:8080)  
The API documentation can be found at: [http://localhost:8080/q/swagger-ui/#/](http://localhost:8080/q/swagger-ui/#/)

## Working with the project

There are three main locations for the Java code base:

- `src/main/java` - The location of the main code base
- `src/test/java` - The location of the test code for the project
- `src/integration-test/java` - The location of integration tests for the project

The integration tests are set up a little different, as once TestContainers is configured - Docker is required for all tests (even where TestContainers are not used).
Integration tests need to be run via Maven, with Docker up and running on your machine.

The main location for the UI is located in [/calm-hub-ui/src](/calm-hub-ui/src) directory, when creating a final build this is packaged by Maven.

```shell
#Run all tests including integration tests
mvn -P integration verify
```

## Running in Development Mode

Development mode is designed to provide a great developer experience from using modern tools and build systems.

### Storage Modes

Calm Hub supports two different storage modes:

1. **MongoDB Mode (Default)**: Uses MongoDB for data persistence. This is the default mode and is suitable for production deployments.
2. **Standalone Mode**: Uses NitriteDB (an embedded NoSQL database) for data persistence. This mode is useful for development and testing without requiring an external MongoDB instance.

#### Selecting Storage Mode

The storage implementation is selected based on the active Quarkus profile:

- **Default profile** (no profile specified): Uses MongoDB implementation
- **Standalone profile**: Uses NitriteDB implementation

To run the application in standalone mode:

```shell
# Development mode with standalone storage
../mvnw quarkus:dev -Dcalm.database.mode=standalone

# Production mode with standalone storage
java -Dcalm.database.mode=standalone -jar target/quarkus-app/quarkus-run.jar
```

### Mongo Database Startup

In the `local-dev` directory, launch:

```
docker-compose up
```

This setups a Mongo Database that works with the application.
You might see a conflict if you have run using the deploy profile, you can `docker rm container-name` to fix this.

### Adding additional storage modes
To prevent ambiguous dependency injection using Quarkus, but enable runtime storage optionality, if you add a new set of store implementations, you must add them to the Producer classes.

* The store interfaces are located in the `org.finos.calm.store` package.
* The specific implementations are placed in their own specific package, e.g. `org.finos.calm.store.nitrite` and `org.finos.calm.store.mongo`.
* The producers are located in the `org.finos.calm.store.producer` package.

Using the AdrStoreProducer as an example, once you have added your new store implementation would `@Inject` it into an implementation specific property and add the selection criteria to the  `@Produces` annotated method.

```java
public class AdrStoreProducer {

    @Inject
    @ConfigProperty(name = "calm.database.mode", defaultValue = "mongo")
    String databaseMode;

    @Inject
    MongoAdrStore mongoAdrStore;

    @Inject
    NitriteAdrStore standaloneAdrStore;

    /**
     * Produces the appropriate AdrStore implementation based on the configured database mode.
     *
     * @return the AdrStore implementation
     */
    @Produces
    @ApplicationScoped
    public AdrStore produceAdrStore() {
        if ("standalone".equals(databaseMode)) {
            return standaloneAdrStore;
        } else {
            return mongoAdrStore;
        }
    }
}
```

### Server Side with Hot Reload

From the `calm-hub` directory

1. `../mvnw package`
2. `../mvnw quarkus:dev`


### Secure profile

#### Launch keycloak

From the `keycloak-dev` directory in `calm-hub`

Create self-signed X.509 certificate for Keycloak:

```shell
  mkdir ./certs &&
  openssl req -x509 -newkey rsa:2048 \
    -keyout ./certs/key.pem \
    -out ./certs/cert.pem -days 90 -nodes \
    -subj "/C=GB/ST=England/L=Manchester/O=finos/OU=Technology/CN=calm-hub.finos.org"
```

Launch KeyCloak:
```shell
export KC_BOOTSTRAP_ADMIN_PASSWORD=<set me>
docker-compose up
```
- Open KeyCloak UI: https://localhost:9443, login with admin user.
- Switch realm from `master` to `calm-hub-realm`.
- You can find a `demo` user with a temporary credentials under `calm-hub-realm` realm.
- During local development, you can use the `demo` user to authenticate with `keycloak-dev` when integrating calm-ui using the `authorization code flow`.

#### Server Side with secure profile

From the `calm-hub` directory
1. Create a server-side certificate
    ```shell
    openssl req -x509 -newkey rsa:2048 \
      -keyout ./src/main/resources/key.pem \
      -out ./src/main/resources/cert.pem -days 90 -nodes \
      -subj "/C=GB/ST=England/L=Manchester/O=finos/OU=Technology/CN=calm-hub.finos.org"
    ```
2. `../mvnw package`
3. `../mvnw quarkus:dev -Dquarkus.profile=secure`
4. When using a self-signed certificate, you have two options to avoid the `No name matching localhost found` CertificateException in the backend.
   1. Add a host entry in `/etc/hosts` file, for example `127.0.0.1 calm-hub.finos.org`
   2. Alternatively, create the self-signed certificate with localhost as the CN or SAN.
5. Some browsers may block `.well-known` endpoints that use self-signed certificates (e.g., https://calm-hub.finos.org:9443/realms/calm-hub-realm/.well-known/openid-configuration). Ensure these endpoints are accessible in your browser before accessing `calm-hub-ui`.
6. Open Calm UI at the URL matching your self-signed certificate’s CN: https://calm-hub.finos.org:8443 or https://localhost:8443.

### UI with hot reload (from src/main/webapp)

The first time, you may need to run `npm install`.

1. `npm start`

The UI is now ready for hot reloading and development across the stack.

### Running CalmHub MCP (Model Context Protocol)

CalmHub embeds an [MCP](https://modelcontextprotocol.io/) server that exposes the
same architecture/decorator/control/namespace data as the REST API to MCP-capable
AI clients (e.g. Claude, VS Code Copilot connectors). It uses the
[Quarkiverse MCP Server](https://docs.quarkiverse.io/quarkus-mcp-server/dev/index.html)
extension and is backed by the same store implementations selected via
`calm.database.mode`, so it works with both MongoDB and standalone (Nitrite) modes.

#### Tools exposed

The tool implementations live in
[`src/main/java/org/finos/calm/mcp/tools`](src/main/java/org/finos/calm/mcp/tools):

- **ArchitectureTools** — list, create and read architectures (and their versions) for a namespace.
- **ControlTools** — list and read control requirements for a namespace.
- **DecoratorTools** — full CRUD over decorators.
- **NamespaceTools** — create namespaces, list namespaces, list domains.
- **SearchTools** — global cross-resource search with capped, grouped results.

#### Endpoint

When the application is running, the MCP server is available over Streamable HTTP at:

```
http://localhost:8080/mcp
```

In dev mode (`../mvnw quarkus:dev`) every JSON-RPC message is logged to the
console (`%dev.quarkus.mcp.server.traffic-logging=true` in
`application.properties`), and the Quarkus Dev UI ships a built-in MCP tester
at [http://localhost:8080/q/dev-ui](http://localhost:8080/q/dev-ui).

#### Enabling / disabling

The whole MCP surface is gated by a single config property (default `true`):

```properties
calm.mcp.enabled=true
```

Disable it from the command line or environment:

```shell
../mvnw quarkus:dev -Dcalm.mcp.enabled=false
# or
export CALM_MCP_ENABLED=false
```

#### Exposing your local MCP via ngrok

To let a remote MCP client (e.g. the Claude desktop / web app) talk to your
local CalmHub:

1. Start CalmHub locally (`../mvnw quarkus:dev`).
2. In another terminal, expose port `8080` with [ngrok](https://ngrok.com/):

   ```shell
   ngrok http 8080
   ```

3. Copy the `https://...ngrok-free.app` (or your reserved domain) URL ngrok
   prints, and create a connector in your MCP client pointing at:

   ```
   https://<your-ngrok-host>/mcp
   ```

The ngrok URL changes each session unless you use a reserved domain.

> **⚠ Security note** — under the default profile the MCP endpoint runs
> **without authentication**, the same as the default-profile REST API. The
> `secure` profile enforces JWT authentication on `/mcp/*` (see
> `application-secure.properties`), but does **not** yet apply per-tool
> scope/role checks — adding scope-based RBAC for MCP tools (so the existing
> `@PermittedScopes` model also covers `@Tool` invocations) is tracked as a
> follow-up. Exposing CalmHub through ngrok publishes the endpoint to the
> public internet, so when demoing protect the tunnel with ngrok-side controls
> (for example `ngrok http 8080 --basic-auth 'user:password'`, an OAuth edge,
> or an IP allowlist), tear the tunnel down when you're done, or set
> `calm.mcp.enabled=false` while the server is reachable.

### Building for Deployment

#### Packaging and Running as a jar (from `calm-hub` directory)

1. `../mvnw -P integration clean package`
2. `$ java -jar target/quarkus-app/quarkus-run.jar`

#### Building a Docker Image

1. `docker buildx build --platform linux/amd64,linux/arm64 -f src/main/docker/Dockerfile.jvm -t calm-hub --push .`

#### Automated Docker Builds with GitHub Actions

The repository includes a GitHub Action workflow that builds and pushes multi-architecture Docker images to Docker Hub through manual triggering.

To set up automated Docker builds:

1. Add the following secrets to your GitHub repository:

   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password or access token

2. Trigger the workflow manually from the GitHub Actions tab by selecting the "Docker Publish Calm Hub" workflow.

3. You can specify a custom tag for the Docker image when triggering the workflow, or use the default "latest" tag.

#### How to Specify a Custom Tag

To specify a custom tag when triggering the workflow:

1. Go to the GitHub repository in your browser
2. Click on the "Actions" tab
3. Select "Docker Publish Calm Hub" from the workflows list on the left
4. Click the "Run workflow" button
5. A dropdown will appear with an input field for "Image tag"
6. Enter your desired tag (e.g., "v1.0.0", "stable", etc.)
7. Click the green "Run workflow" button to start the build

The Docker image will be built and pushed to Docker Hub as `username/calm-hub:your-custom-tag`.

#### Experimental - Multistage Docker Build

1. `docker buildx build --platform linux/amd64,linux/arm64 -f src/main/docker/Dockerfile.multistage -t calm-hub .`

Known limitations, doesn't run integration tests.
