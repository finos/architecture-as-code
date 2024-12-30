# Calm Hub

## Working with the project

### Running the Server in Development Mode (from this directory)

1. `./mvnw package`
2. `./mvnw quarkus:dev`

### Running the UI in Development Mode (from src/main/webapp)

1. `npm start`

### Building for Deployment

Packaging and Running as a jar

1. `./mvnw clean package`
2. `$ java -jar target/quarkus-app/quarkus-run.jar`

Building a Docker Image

1. Run the jar packaging (TODO improve to multistage build)
2. `docker build -f src/main/docker/Dockerfile.jvm -t calm-hub .`

## API Design

* Those marked with a `(P)` will also have a corresponding PUT/POST

### Schemas

```
GET calm/schema/ - list all versions of the CALM schema
GET calm/schema/{version}/meta - list all resources of the schema
GET calm/schema/{version}/meta/{resource}
```

### Namespaces

```
GET calm/namespaces/ - list all namespaces
```

### Patterns

```
GET calm/namespaces/{namespace}/patterns - return all patterns in the namespace
POST calm/namespaces/{namespace}/patterns - create a new pattern in the namespace
GET calm/namespaces/{namespace}/patterns/{pattern-id}/versions/ - The list of versions
GET calm/namespaces/{namespace}/patterns/{pattern-id}/versions/{version} - return the actual pattern
POST/PUT calm/namespaces/{namespace}/patterns/{pattern-id}/versions/{version} - create a new pattern, PUT will not be supported where config mode is set to write once
```

### Architectures
```
GET calm/namespaces/{namespace}/instances - return all instances of architectures
POST calm/namespaces/{namespace}/instances - create a new architecture
GET calm/namespaces/{namespace}/instances/{instance-id}/versions - return all the versions of an architecture
POST/PUT calm/namespaces/{namespace}/instances/{instance-id}/versions - create a new architecture with a specific version, PUT will not be supported where config mode set to write once
```

Note, need to figure out the best place for creating the base information about a given architecture 

### Controls

```
GET calm/controls/domains - List all centrally supported domains
GET(P) calm/controls/domains/{domain} - The controls in a specific domain - with a control-id
GET(P) calm/controls/domains/{domain}/{control-id} => Should these be versioned?
```

### Interfaces

```
GET calm/interfaces - List all interfaces
```

Note, need to talk to Matt about namespaceing interfaces
