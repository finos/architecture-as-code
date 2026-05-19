# CALM Architecture Discovery — Key Observations

> ⚠️ This is an initial discovery of potential CALM nodes and relationships based on static analysis of the codebase by an LLM. It may contain inaccuracies or omissions. Please review and validate each item before using it in your CALM architecture model.

## Deployment Boundaries

- **`calm-hub` + `mongodb`** are co-deployed as a pair (evidenced by `calm-hub/local-dev/docker-compose.yml` and `calm-hub/deploy/docker-compose.yml`). They form the core persistence tier of the platform.
- **`calm-hub-ui`** is not separately deployed at runtime. Its `prod` npm script (`rsync -a build/* ../calm-hub/src/main/resources/META-INF/resources`) embeds the React SPA into calm-hub's JAR as static resources. Both are served by the same JVM process on port 8080.
- **`calm-server`** (Express/Node.js, port 3000) is a separately deployable validation microservice with no persistent storage. It is a lightweight alternative to calm-hub's validation capability.
- **`calm-guard`** (Next.js) is an independent DevSecOps product with its own deployment lifecycle (located in `calm-suite/calm-guard`). It invokes `calm-cli` as a subprocess and calls GitHub and LLM APIs directly from the server.
- **`calm-studio`** and **`calm-studio-mcp-server`** originate from `calm-suite/calm-studio`, which has its own `pnpm` workspace, and are released independently of the main npm monorepo.
- **`calm-cli`** is distributed as the npm package `@finos/calm-cli` and runs as a local command-line process. It has no persistent state of its own.
- **`vscode-extension`** runs within the VS Code extension host process — it is not a standalone service but is a distinct runtime process boundary.

## Authentication / Trust Boundaries

- **OIDC is disabled by default** in calm-hub (`quarkus.oidc.tenant-enabled=false` in `application.properties`). It is only enabled in a dedicated secure deployment profile.
- When OIDC is enabled, **both** calm-hub-ui (OIDC redirect via `oidc-client-ts`) and calm-hub (server-side JWKS key retrieval via `quarkus-oidc`) connect to Keycloak on port 9443.
- **`calm-server` has no authentication or authorization** — this is explicitly warned in the source code: the process logs a warning if bound to any non-localhost interface.
- **`calm-guard`**'s GitHub integration uses an optional `GITHUB_TOKEN` environment variable; calls to `api.github.com` are made server-side to prevent the token from reaching the browser.
- **LLM API keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are consumed server-side in calm-guard and are never exposed to the browser.

## External Dependencies

- **`calm-guard`** has a hard runtime dependency on at least one of `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` being set — if neither is present, the AI analysis will fail at startup.
- Both Anthropic Claude Sonnet and OpenAI GPT-4o are alternative providers in calm-guard; Anthropic is preferred if both keys are set. A Google Generative AI and xAI option also exist in the provider configuration but are not the primary providers.
- **GitHub API** calls from calm-guard include fetching file contents (rate-limited at 60 req/hr unauthenticated, higher with a token) and creating pull requests (requires write access).
- **`calm-cli`** can optionally connect to a remote CALM Hub instance for pattern and schema resolution, but works entirely offline with bundled schemas by default.
- **`calm-server`** similarly can optionally connect to CALM Hub via `--calm-hub-url`, but defaults to using bundled schemas.

## Nodes with Sub-Architectures Worth Drilling Into

- **`calm-hub`** — Has 14+ REST resource classes (`ArchitectureResource`, `PatternResource`, `FlowResource`, `DecoratorResource`, `SearchResource`, `StandardResource`, `ControlResource`, `UserAccessResource`, `FrontControllerResource`, etc.) and an embedded MCP server (`quarkus-mcp-server-http`). Also supports **dual storage**: MongoDB (default) or NitriteDB (embedded standalone mode, no separate process). A detailed calm-hub sub-architecture would clarify its internal domain boundaries.
- **`calm-guard`** — Contains a 4-agent AI orchestration layer (`orchestrator.ts`) running agents in parallel: Architecture Analyzer, Compliance Mapper, Pipeline Generator, Cloud Infra Generator, with a sequential Risk Scorer phase. Each agent is a significant sub-component worth its own architectural definition.
- **`calm-studio`** — Bundles the `calm-studio-mcp-server` as a sidecar binary. The interaction between the Tauri desktop app and the MCP server (using Tauri's shell plugin to spawn/communicate with the process) is a non-trivial relationship that deserves a dedicated sub-architecture.

## Additional Notes

- **NitriteDB** (embedded document store used in calm-hub standalone mode) is not represented as a separate node because it runs in-process within calm-hub and is not a distinct deployable unit or runtime process.
- The **`calm-hub-ui-to-keycloak`** and **`calm-hub-to-keycloak`** relationships are conditional — they only apply when calm-hub is deployed with a secure/production profile. In the default development profile, these connections do not occur.
- The **`calm-guard-to-calm-cli`** relationship is a subprocess invocation (Node.js `child_process`) rather than a network call; calm-cli is listed as `serverExternalPackages` in calm-guard's `next.config.ts`.
