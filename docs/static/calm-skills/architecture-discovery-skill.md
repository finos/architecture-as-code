---
name: calm-architecture-discovery
description: Use when asked to scan a codebase to generate a CALM architecture from application source code. Identifies CALM nodes and relationships for a FINOS CALM architecture model, which serves as a starting point for further refinement and validation by architects and engineers.
user-invocable: true
---

# CALM Node & Relationship Discovery Skill

Look for the parameters `root_dir` and `arch_file`in the incoming request, prompt or call context.

If either `root_dir` or `arch_file` is missing or empty, ask a single concise clarifying question requesting the value for the missing parameter.

Scan all subdirectories of `root_dir` to identify potential CALM nodes and relationships for a FINOS CALM architecture model (schema version 1.2).

Present the discovered nodes and relationships as described in the `Output format` section below, along with any key observations about the architecture.

## What to look for

### Nodes — identify each distinct architectural component:
- **actor** — humans, external systems, or clients that initiate interactions
- **webclient** — browser-based UIs, SPAs, dashboards
- **service** — APIs, microservices, background workers, CLIs, servers
- **database** — any data store (SQL, NoSQL, embedded, in-memory)
- **network** — load balancers, API gateways, proxies, ingress controllers
- **system** — logical groupings of services (bounded contexts, subsystems)
- **ecosystem** — external third-party platforms (cloud providers, SaaS, identity providers)
- **data-asset** — files, datasets, message queues, event streams

Except for the actor node type, collect technical information about the endpoints the node exposes, such as port number, protocol, method and path.

If there is code that references, through an api call, an external service for authentication/authorization, monitoring or logging, create a node and connects relationship for that external service.

### Relationships — for each pair of nodes, identify:
- **connects** — direct point-to-point calls (HTTP, HTTPS, JDBC, gRPC, WebSocket, AMQP, TCP, etc.)
- **interacts** — actor-to-system interactions (user uses UI, external system calls API)

### Evidence to scan

#### Package manifests & build files (pick what applies)
| Ecosystem | Files |
|-----------|-------|
| JavaScript / TypeScript | `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| Java / Kotlin / Scala | `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle` |
| Python | `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements*.txt`, `Pipfile`, `poetry.lock` |
| C / C++ | `CMakeLists.txt`, `Makefile`, `conanfile.txt`, `vcpkg.json` |
| C# / .NET | `*.csproj`, `*.sln`, `nuget.config`, `packages.config` |
| Go | `go.mod`, `go.sum` |
| Rust | `Cargo.toml`, `Cargo.lock` |
| Ruby | `Gemfile`, `Gemfile.lock`, `*.gemspec` |
| PHP | `composer.json`, `composer.lock` |
| Swift / Objective-C | `Package.swift`, `Podfile`, `*.xcodeproj` |
| Elixir / Erlang | `mix.exs`, `rebar.config` |

#### Deployment & infrastructure
- **Containers**: `Dockerfile*`, `docker-compose*.yml`, `.dockerignore`
- **Kubernetes**: `*.yaml`/`*.yml` in `k8s/`, `deploy/`, `helm/`, `charts/` — look for `kind: Deployment`, `Service`, `Ingress`, `ConfigMap`
- **Serverless**: `serverless.yml`, `template.yaml` (SAM), `terraform/` (`*.tf`), `pulumi/`, `cdk/`, `bicep/`
- **CI/CD**: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`, `azure-pipelines.yml`

#### Configuration & environment
- `application.properties`, `application.yml`, `application*.yaml` (Spring Boot)
- `appsettings.json`, `appsettings.*.json` (.NET)
- `config.py`, `settings.py`, `config.yaml`, `config.toml`
- `.env`, `.env.*`, `*.env.example` — look for URLs, hostnames, port numbers, database connection strings
- `config/`, `conf/`, `settings/` directories

#### Source code signals
- **Route / endpoint definitions**: Express `app.get/post`, FastAPI `@router`, Spring `@RestController`/`@RequestMapping`, Django `urls.py`, ASP.NET `[Route]`, Go `http.HandleFunc`, Gin `r.GET`, gRPC `.proto` files
- **Database clients**: JDBC URLs, SQLAlchemy `create_engine`, Mongoose `connect`, Entity Framework `DbContext`, GORM `Open`, Diesel schema
- **Message queues / event streams**: Kafka producers/consumers, RabbitMQ channels, SQS/SNS client instantiation, Azure Service Bus, NATS
- **HTTP clients**: `axios`, `fetch`, `requests`, `HttpClient`, `RestTemplate`, `WebClient`, `urllib`, `curl` wrappers — especially where base URLs are configured
- **Auth / identity**: OIDC/OAuth config, `passport`, `spring-security`, `django-allauth`, Keycloak adapters, JWT validation, API key headers
- **Service discovery / config**: Consul, Eureka, etcd, Zookeeper client setup; environment-injected hostnames

#### Architecture hints
- OpenAPI / Swagger specs: `openapi.yaml`, `swagger.json`, `*.oas.yaml`
- AsyncAPI specs: `asyncapi.yaml`

## IMPORTANT NOTES
- DO NOT rely on documentation or comments as primary evidence for identifying nodes and relationships.  They can be out of date or inaccurate.  Examples include `README.md`, `ARCHITECTURE.md`, code comments, and even architecture diagrams.  Instead, focus on executable code and configuration that indicates the presence of nodes and relationships.
- When identifying nodes and relationship, make sure the node or relationship is actively used in executable code and not inferred by a reference in a comment or existence of an unused constant or variable.
- A node should be identified as a distinct architectural component only if there is evidence of it being a separate deployable unit, runtime process, command line, or external system.  For example, two services defined in the same codebase but running as separate processes would be two nodes, while two classes in the same service would not.
- DO NOT define `composed-of` and `deployed-in` relationships.  Focus on `connects` and `interacts` relationships that indicate actual communication or interaction patterns between nodes.
- For relationships, DO NOT capture protocols, this has been deprecated.
- When forming the unique-id for relationships, use format `<source-node-id>-to-<destination-node-id>` to clearly indicate direction of the relationship.
- Present information about the nodes and relationships as stated in the `Output Format` section.


## Output format

Once the node and relationships have been identified, display warning banner:

```⚠️ This is an initial discovery of potential CALM nodes and relationships based on static analysis of the codebase by an LLM. It may contain inaccuracies or omissions. Please review and validate each item before using it in your CALM architecture model.```

Show this message "Scanned the following top-level subdirectories for the CALM nodes and relationships:" followed by a bullet list of the top-level subdirectories that were scanned.

`description` for nodes and relationships should be concise, ideally one sentence, summarizing the purpose or role of the node or relationship in the architecture.

### Output the tables in markdown format, with the specified columns for nodes and relationships and key observations listed as bullet points.

Produce two tables:

**Nodes table** with columns: `unique-id` | `node-type` | `name` | `description`

**Relationships table** with columns: `unique-id` | `relationship-type` | `source → destination` | `description`

Then list key observations:
- Deployment boundaries
- Authentication / trust boundaries
- External dependencies
- Any nodes that likely have sub-architectures worth drilling into

### Save nodes and relationships

Display the following message: "Saving the discovered nodes and relationships to a CALM architecture model in JSON format, adhering to the CALM schema version 1.2.to `arch_file`."

Create a CALM architecture model in JSON format containing only the discovered nodes and relationships, adhering to the CALM schema version 1.2. 

Form `key-obs-file` name by replacing ".json" ending of `arch-file` with "-key-observations.md"

Display the message: "Saving key observations about the architecture to `key-obs-file`."

Save the key observations as markdown in `key-obs-file`

Display the message: "CALM architecture discovery complete. Please review the discovered nodes, relationships, and key observations before using them in your CALM architecture model."
