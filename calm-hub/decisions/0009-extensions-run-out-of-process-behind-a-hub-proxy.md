# ADR 0009: Extensions run out of process, behind a Hub proxy

**Status**: Proposed. Nothing is built. A proof of concept for one `screen` is on
the `poc/3396-extension-screen` branch.

## Context

[#3396](https://github.com/finos/architecture-as-code/issues/3396) lets an
organisation add features to CalmHub without a fork: screens, tabs, search
providers, commands for the CLI and MCP, and server-side hooks. Each extension
needs code somewhere. The question is where that code runs.

Quarkus finds CDI beans, JAX-RS resources and MCP `@Tool` classes at build time.
A JAR added to a running Hub registers nothing. Two of the four published images
are native, and a native image is a closed world: it cannot load new code at all.

| Option | Native image | Isolation | Verdict |
|---|---|---|---|
| External service, proxied by Hub | Yes | Separate process | Default |
| Maven dependency, custom Hub image | Yes | None | Allowed, not supported as a product path |
| Plugin JARs loaded at runtime | No | None | Rejected |
| WASM modules (for example Chicory) | Yes | Sandbox | Not now |

## Decision

**An extension is an external HTTP service.** Its manifest declares the routes
that the service exposes. Hub proxies those routes behind its own authentication,
authorisation, read-only rule and audit. Hub never loads extension code into its
own process.

**Only the operator installs an extension.** An extension is a manifest folder in
`calm.extensions.dir`, read at start up. No API adds, changes or removes an
extension at runtime. A user cannot install one.

**Built-in features are not extensions.** A feature that ships with Hub, such as
architecture validation ([ADR 0015](0015-architecture-validation-is-a-hub-feature-behind-an-spi.md)),
plugs in through a CDI interface. A manifest-declared extension can implement
the same interface later, through the proxy.

**The proxy is a JAX-RS resource.** A Vert.x route would skip
`ReadOnlyRequestFilter`, `AuditRequestFilter` and the exception mappers. Hub
uses RESTEasy Classic, so the outbound client is the JDK `java.net.http.HttpClient`,
which Hub already ships in native code (`GitHubFileHistoryClient`,
`OidcPluginAuthClient`). It needs no new Quarkus extension, and it can stream a
reply.

## Consequences

- One extension contract serves the UI, the CLI and MCP, because all three call
  the same proxied route.
- An extension can be written in any language and deployed on its own schedule.
  A Hub upgrade does not rebuild it.
- Each proxied call adds one network hop. Streamed replies (`chat`) hold one
  worker thread for each open stream, so the proxy needs an idle timeout, a
  maximum duration and a concurrency cap for each extension.
- An organisation that wants in-process Java builds its own image from Hub. That
  image has no isolation, and the project does not test it.
- The proxy is now the main attack surface. [ADR 0011](0011-extension-proxy-request-handling.md)
  sets its rules.
- Hub and the extension can run on different hosts, so the extension must be able
  to trust a request from Hub without the user's token.
  [ADR 0010](0010-extension-identity-is-a-hub-signed-assertion.md) covers this.
