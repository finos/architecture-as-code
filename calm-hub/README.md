# Calm Hub

## Quick Start - Node Coding, Just Product

You can run a version of Calm Hub locally, by using the `docker-compose` deploy configuration.
Note, this currently depends on @jpgough-ms publishing a Docker image, which will be fixed in the next few weeks by producing a build from this mono-repo.

```shell
cd deploy
docker-compose up
```

A version of CALM Hub will be up and running on: [http://localhost:8080](http://localhost:8080)   
The API documentation can be found at: [http://localhost:8080/q/swagger-ui/#/](http://localhost:8080/q/swagger-ui/#/)

## Working with the project

There are three main locations in the server code base:

* `src/main/java` - The location of the main code base
* `src/test/java` - The location of the test code for the project
* `src/integration-test/java` - The location of integration tests for the project

The integration tests are set up a little different, as once TestContainers is configured - Docker is required for all tests (even where TestContainers are not used).
Integration tests need to be run via Maven, with Docker up and running on your machine.

The main location for the UI is located in [/calm-hub/src/main/webapp](/calm-hub/src/main/webapp) directory

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

### UI with hot reload (from src/main/webapp)

The first time, you may need to run `npm install`.

1. `npm start`

The UI is now ready for hot reloading and development across the stack. 

### Building for Deployment

#### Packaging and Running as a jar (from `calm-hub` directory)

1. `../mvnw -P integration clean package`
2. `$ java -jar target/quarkus-app/quarkus-run.jar`

#### Building a Docker Image

1. `docker build --platform linux/amd64,linux/arm64 -f src/main/docker/Dockerfile.jvm -t calm-hub .`

#### Experimental - Multistage Docker Build

1. `docker build --platform linux/amd64,linux/arm64 -f src/main/docker/Dockerfile.multistage -t calm-hub .`

Known limitations, doesn't run integration tests.
