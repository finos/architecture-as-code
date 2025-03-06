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

* `src/main/java` - The location of the main code base
* `src/test/java` - The location of the test code for the project
* `src/integration-test/java` - The location of integration tests for the project

The integration tests are set up a little different, as once TestContainers is configured - Docker is required for all tests (even where TestContainers are not used).
Integration tests need to be run via Maven, with Docker up and running on your machine.

The main location for the UI is located in [/calm-hub/src/main/webapp](/calm-hub/src/main/webapp) directory, when creating a final build this is packaged by Maven.

```shell
#Run all tests including integration tests
mvn -P integration verify
```

## Running in Development Mode

Development mode is designed to provide a great developer experience from using modern tools and build systems.

### Mongo Database Startup

In the `local-dev` directory, launch:

```
docker-compose up
```

This setups a Mongo Database that works with the application.
You might see a conflict if you have run using the deploy profile, you can `docker rm container-name` to fix this.

### Server Side with Hot Reload

From the `calm-hub` directory

1. `../mvnw package`
2. `../mvnw quarkus:dev`

### Secure profile

#### Launch keycloak

From the `keycloak-dev` directory in `calm-hub`

Create certs for KeyCloak:

```shell
  mkdir ./certs &&
  openssl req -x509 -newkey rsa:2048 \
    -keyout ./certs/key.pem \
    -out ./certs/cert.pem -days 90 -nodes \
    -subj "/C=GB/ST=England/L=Manchester/O=finos/OU=Technology/CN=idp.finos.org"
```

Launch KeyCloak:
```shell
export KC_BOOTSTRAP_ADMIN_PASSWORD=<set me>
docker-compose up
```
- Open KeyCloak UI: https://localhost:9443, login with admin user.
- Switch realm from `master` to `calm-hub-realm`.
- You can find a `demo` user with a temporary credentials under `calm-hub-realm` realm.
- During the local development, the `demo` user you can use to authenticate with `keycloak-dev` when you integrate the `calm-ui` with `authorization-code` flow type.


#### Server Side with secure profile 

From the `calm-hub` directory

1. Create a server side certificates
    ```shell
    openssl req -x509 -newkey rsa:2048 \
      -keyout ./src/main/resources/key.pem \
      -out ./src/main/resources/cert.pem -days 90 -nodes \
      -subj "/C=GB/ST=England/L=Manchester/O=finos/OU=Technology/CN=calm-hub.finos.org"
    ```
2. `../mvnw package`
3. `../mvnw quarkus:dev -Dquarkus.profile=secure`
4. Open Calm UI: https://localhost:8443

### UI with hot reload (from src/main/webapp)

The first time, you may need to run `npm install`.

1. `npm start`

The UI is now ready for hot reloading and development across the stack. 

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
