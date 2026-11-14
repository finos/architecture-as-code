---
id: calm-hub-overview
title: CALM Hub
sidebar_label: Overview
sidebar_position: 0
---

# CALM Hub

**CALM Hub** is the central artifact store and API server for the CALM ecosystem. It provides a versioned, queryable registry for CALM architecture models, patterns, compliance controls, standards, and related assets — enabling teams to publish, discover, and share architecture knowledge across an organisation.

CALM Hub exposes a RESTful HTTP API that powers both the [CALM Hub UI](../working-with-calm/calm-hub.md) visual interface and programmatic integrations such as the [MCP endpoint](./mcp-and-api.md).

---

## Features

| Feature | Description |
|:--------|:------------|
| **Namespace-scoped artefact store** | Architectures, patterns, flows, standards, interfaces, ADRs, and controls organised under user-defined namespaces |
| **Versioned resources** | Every artefact carries an incrementing version history; compare any two versions via the timeline UI |
| **Multiple storage backends** | MongoDB (production), NitriteDB embedded (standalone/development), or a baked-in read-only database (static distribution) |
| **Read-only mode** | Serves a pre-seeded, immutable CALM dataset with no external database dependency; mutating requests are rejected with HTTP 405 |
| **Scope-based access control** | Fine-grained OAuth2 scopes (e.g. `architectures:read`, `architectures:all`, `namespace:admin`) enforced per endpoint |
| **OpenAPI / Swagger UI** | Auto-generated API documentation always available at `/q/swagger-ui` |
| **MCP server** | Experimental [Model Context Protocol](./mcp-and-api.md) endpoint at `/mcp` for AI-agent integrations |
| **Multi-arch container images** | Pre-built `linux/amd64` and `linux/arm64` images for all four variants |

---

## Supported Runtimes

CALM Hub is published as four container image variants, each combining a **JVM runtime** (JVM vs. GraalVM native binary) with a **storage backend** (MongoDB vs. NitriteDB read-only).

### JVM vs. Native

| | JVM | Native |
|--|-----|--------|
| **Startup time** | ~3 – 5 s | < 0.5 s |
| **Memory footprint** | ~200 MB heap | ~50 – 80 MB RSS |
| **Build time** | ~30 s | 5 – 15 min (GraalVM Mandrel) |
| **Debuggability** | Full Java tooling | Limited (no JVM agents) |
| **Platform** | Any JDK 21 host | Compiled per arch (`amd64`, `arm64`) |

### Storage Modes

| Mode | Backend | External dependency | Mutating writes |
|:-----|:--------|:-------------------|:----------------|
| **MongoDB** (default) | External MongoDB 5.0+ | Yes — `QUARKUS_MONGODB_CONNECTION_STRING` | ✅ Yes |
| **Standalone** (NitriteDB) | Embedded file-based DB | No | ✅ Yes (file persisted at `CALM_STANDALONE_DATA_DIRECTORY`) |
| **Read-only** | Pre-seeded NitriteDB | No | ❌ No — HTTP 405 for POST/PUT/DELETE/PATCH |
| **GitHub** (`calm.database.mode=github`) | Cloned GitHub repositories | Yes — GitHub API | ❌ No — read-only from Git |

In GitHub mode, CALM Hub classifies `.json` and `.md` files in each configured repository from content signals (`moments` or `$schema`) and from parent directory names (`architectures/`, `patterns/`, `standards/` or `standard-nodes/`, `flows/`, `interfaces/`, `controls/`, `adrs/`, `timelines/`, `decorators/`).

### The Four Image Variants

| Tag | Runtime | Storage | Use case |
|:----|:--------|:--------|:---------|
| `latest` | JVM | MongoDB | Standard production deployment |
| `latest-native` | GraalVM native | MongoDB | Low-latency / resource-constrained production |
| `latest-read-only-static` | JVM | Read-only NitriteDB | Fast demo/CI; ships the full CALM schema set |
| `latest-read-only-native` | GraalVM native | Read-only NitriteDB | Minimal footprint, self-contained, fast startup |

---

## Read-Only Mode

### Overview

Read-only mode lets you run CALM Hub as a completely self-contained, stateless container — no database to provision, no credentials to manage. The CALM schema data is baked directly into the image.

When `CALM_READONLY=true` is set:

1. **`ReadOnlyRequestFilter`** intercepts every inbound request before routing. Any HTTP method that mutates state (`POST`, `PUT`, `DELETE`, `PATCH`) is rejected immediately with `HTTP 405 Method Not Allowed` and a `Allow: GET, HEAD, OPTIONS` response header.
2. **NitriteDB** is opened with `.readOnly(true).autoCommit(false)`, preventing any accidental writes to the embedded database file.

The MCP endpoint (`/mcp`) does not go through that filter. Each MCP tool that changes data returns a tool error on a read-only Hub. Hub does this check before the permission check, so a caller without the scope also gets the read-only error. A tool that needs only a read scope still runs, and so do the extension commands that a read-only Hub can run. `tools/list` does not show the tools that change data, and a read-only Hub registers no extension command for a write route. This applies to all users of a read-only Hub. It is not a filter by user or scope, which Hub does not do (see ADR 0014).

```bash
# Run the read-only JVM image — no external dependencies needed
docker run --rm -p 8080:8080 finos/calm-hub:latest-read-only-static

# Test that mutations are blocked
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8080/calm/namespaces \
  -H 'Content-Type: application/json' -d '{"name":"test"}'
# → 405
```

The read-only images serve the `$id` of each name-based document under `https://hub.calm.finos.org`, because the seeded documents belong to that Hub. To use a different base, add `-e CALM_HUB_BASE_URL=<url>` to `docker run`.

### How the Read-Only Data Image Layer Works

The read-only images use a **two-stage Docker build** to pre-seed the embedded NitriteDB with the full CALM schema dataset at *build time*:

```
Stage 1 — seed (JVM, writable)
  FROM ubi8/openjdk-21 (static) or ubi9/openjdk-21 (native)
  COPY quarkus-app/ + released meta-schemas (npm copy) + controls/ + interfaces/
  RUN boot Quarkus in standalone (writable) mode
      → init script POSTs all schemas and controls into NitriteDB
      → graceful SIGTERM flushes and commits the database
      → calmSchemas.db is now ~290–450 KB of real data

Stage 2 — runtime (minimal base image)
  COPY --from=seed /data/calmSchemas.db   ← baked as an image layer
  chmod 0444                              ← immutable at filesystem level
  ENV CALM_READONLY=true
  ENV QUARKUS_PROFILE=standalone
  ENV CALM_HUB_BASE_URL=https://hub.calm.finos.org
```

The resulting image carries the seeded database as a read-only filesystem layer. At runtime the process opens the file in read-only mode, serves the pre-loaded content, and rejects all write requests.

**Why the native read-only image uses a JVM for seeding:** GraalVM native binaries compiled from NitriteDB cannot reliably *write* (commit) the H2 MVStore backing file due to Java serialisation requirements that are not fully supported in native mode. The JVM seed stage produces a database file that the native binary can then *read* correctly (via registered serialisation metadata). The native runtime is only ever used for reads in the read-only image.

---

## UI Customization

An operator can add deployment-specific information to CALM Hub UI with configuration only. Each `calm.ui.*` property can also be set as an environment variable.

| Item | Where it shows | Properties |
|:-----|:---------------|:-----------|
| Environment pill | Header, on every page | `calm.ui.environment.name`, `calm.ui.environment.colour` |
| Signed-in identity | Hamburger menu | `calm.ui.identity.enabled`, `calm.ui.identity.show-roles` |
| Values and links | Hamburger menu | `calm.ui.items[n].label`, `.value`, `.url` |

```bash
CALM_UI_ENVIRONMENT_NAME=UAT
CALM_UI_ENVIRONMENT_COLOUR=warning        # info | success | warning | error | neutral | #rrggbb
CALM_UI_IDENTITY_ENABLED=true             # shows the principal name that CALM Hub sees
CALM_UI_ITEMS_0__LABEL=Support
CALM_UI_ITEMS_0__URL=https://support.example.com
CALM_UI_ITEMS_1__LABEL=Build
CALM_UI_ITEMS_1__VALUE=2026.10.1
```

- Each item needs a `label` and a `value`, a `url`, or both. With both, the `value` is the link text.
- Use a short environment name, for example `DEV`, `QA` or `PROD`. The header cuts a long name to fit, and cuts it most on a narrow screen. Tap or click the pill to see the full name.
- CALM Hub does not start if a colour or URL is not valid. URLs must be absolute `http` or `https` URLs.
- Identity and roles are off by default. Turn on `show-roles` only if your role names are safe to show to users.
- The UI gets these values from `GET /api/calm/ui/config`, which requires authentication.

---

## Extensions

An extension adds features to CALM Hub without a fork. It is an HTTP service that CALM Hub calls. The operator installs it with a manifest. CALM Hub reads the manifests at start up. No API adds an extension.

The Hub UI shows the contributions of an extension, the CLI runs its commands (see [Running extension commands](../calm-cli/hub.md#running-extension-commands)), and MCP makes a tool for each command (see [Extension tools](mcp-and-api.md#extension-tools)).

Put one folder for each extension in `calm.extensions.dir`, with an `extension.json` in it. The folder name must equal the manifest `id`. Hub skips hidden folders and warns about folders without a manifest. A per-id setting for an unknown extension id gives a warning at start up, as a property or as an environment variable.

```text
/etc/calm-hub/extensions/
└── team-services/
    └── extension.json
```

| Setting | Default | Purpose |
|:--------|:--------|:--------|
| `calm.extensions.dir` | not set | The folder of manifests. When it is not set, CALM Hub loads only the built-in decorator views |
| `calm.extensions."<id>".enabled` | `true` | Set `false` to turn off an extension |
| `calm.extensions."<id>".order` | `0` | Lower values come first in the list. Equal values sort by id |
| `calm.extensions."<id>".backend-url` | not set | The base URL of the extension service. Required for an enabled extension with routes |
| `calm.extensions."<id>".allow-http` | `false` | Allows a plain `http` backend that is not on loopback, such as a cluster-internal host. Otherwise the backend must use `https`, or `http` on `localhost`, `127.x.x.x` or `[::1]` |
| `calm.extensions."<id>".connect-timeout-seconds` | `calm.extensions.http.connect-timeout-seconds` (`5`) | The connect timeout for each call. A value below 1 stops start-up |
| `calm.extensions."<id>".request-timeout-seconds` | `calm.extensions.http.request-timeout-seconds` (`10`) | The limit for the whole call. A slow backend gets `504`. A value below 1 stops start-up |
| `calm.extensions."<id>".max-request-bytes` | `calm.extensions.http.max-request-bytes` (`1048576`) | A larger request body gets `413`. A value below 1 stops start-up |
| `calm.extensions."<id>".max-response-bytes` | `calm.extensions.http.max-response-bytes` (`1048576`) | A larger reply gets `502`. A value below 1 stops start-up |
| `calm.extensions."<id>".max-concurrent-calls` | `calm.extensions.http.max-concurrent-calls` (`32`) | The calls to the extension at the same time. One more call gets `503` with `Retry-After: 1`, so that a slow backend cannot hold every worker thread. A value below 1 stops start-up |
| `calm.extensions.identity.private-key-location` | not set | The PKCS#8 PEM key that signs the identity assertion: RSA (2048 bits or more, RS256) or P-256 (ES256). Required when an enabled extension has routes. A shared secret (HS256) is refused |
| `calm.extensions.identity.public-key-locations` | not set | Comma-separated PEM public keys for the JWKS. The first is the public key of the signing key. Required when `private-key-location` is set, and not allowed without it |
| `calm.extensions.identity.ttl-seconds` | `60` | The lifetime of an assertion, at most `300` |
| `calm.extensions.allow-without-auth` | `false` | Allows enabled extensions with routes when `calm.auth.enabled=false`. Only for local development: every caller is then a global admin |

```bash
CALM_EXTENSIONS_DIR=/etc/calm-hub/extensions
CALM_EXTENSIONS__TEAM_SERVICES__BACKEND_URL=https://team-services.internal
CALM_EXTENSIONS__TEAM_SERVICES__ORDER=10
```

The manifest declares:

- `id`, `version`, `hubApi` (now `0`), `name`, and optional `description` and `provider`.
- `routes`: every call that the extension can receive, each with an `id`, `method`, `path`, `scope` and optional `readOnly`. A `read`, `write` or `admin` scope needs a `{namespace}` in the path. A `domain_*` scope needs a `{domain}`. A path parameter cannot contain a slash, so a route for a CALM Hub resource uses `{resourceType}/{resourceId}`, not `{resource}`. When two routes with the same method match a path, the route with more literal segments wins. CALM Hub does not start if two such routes have the same number, for example `GET /{namespace}/report` and `GET /public/{id}`.
- `commands`: CLI and MCP commands, keyed by name. Each names a route by `id`.
- `contributes`: the UI extension points `screen`, `designer-tab`, `landing-card`, `detail-panel`, `action`, `search-provider` and `chat`, which name a route by `id`, and `decorator-views`, which CALM Hub draws from decorators with no route. A decorator view `id` must be unique in all enabled extensions.

The JSON Schema is `META-INF/calm-extensions/schema/0/extension.schema.json` in the CALM Hub jar. Unknown fields are errors. See [the example manifest](https://github.com/finos/architecture-as-code/blob/main/calm-hub/local-dev/extensions/example-services/extension.json).

- CALM Hub does not start if a manifest or a setting is not valid. The error names the file or the setting.
- `GET /api/calm/extensions` lists the enabled extensions, for any signed-in user. It never shows the backend URL. On a read-only CALM Hub it leaves out write routes that are not `readOnly`, and the commands and contributions that use them.

### Calling an extension

CALM Hub proxies each declared route at `/api/calm/extensions/<id>/api/<route path>`. A route with the path `/` is at `/api/calm/extensions/<id>/api/`, with the trailing slash. Without it, CALM Hub gives `404`, also on a CALM Hub that is not read-only. For each call, CALM Hub:

- refuses an encoded slash (`%2F`, in any case, or double-encoded) with `400`, and does not call the backend. A backend that decodes `%2F` before routing would see a path other than the one CALM Hub checked. For the same reason, it refuses an encoded look-alike of `/` or `\` (U+2044, U+2215, U+2216, U+29F5 and U+29F8), each code point whose NFKC form contains `/` or `\` (U+2100, U+2101, U+2105, U+2106, U+FE68, U+FF0F and U+FF3C), and each code point whose NFKC form is only `.`, `%`, `@` or `;` (U+037E, U+2024 to U+2026, U+FE14, U+FE19, U+FE30, U+FE52, U+FE54, U+FE6A, U+FE6B, U+FF05, U+FF0E, U+FF1B and U+FF20). For example, NFKC makes U+2025 `..` and U+2100 `a/c`
- refuses a matrix parameter (`;name=value`) with `400`, and does not drop it
- decodes percent-encoded unreserved characters and uppercases other escapes before matching and forwarding. Percent-encoding in a matched literal segment gets `400`
- on a read-only CALM Hub, gives `405`, not `400`, to a `POST`, `PUT`, `PATCH` or `DELETE` with `%2F`, `%2E`, `%5C`, `%25`, `%40`, `..`, `\`, `//`, `@`, `;` or an encoded look-alike of `/`, `\`, `.`, `%`, `@` or `;` in the path. CALM Hub refuses such a path before it finds the route
- gives `415`, before it signs the assertion, to a `POST` that has no `application/json` or other `+json` `Content-Type`, also when it has no body. A `PUT`, `PATCH` or `DELETE` gets `415` only for a body of another type. Thus a cross-site form or fetch cannot call a route as the user. Those three methods need a CORS preflight, which CALM Hub does not allow cross-site
- matches the path against the declared routes only, and refuses `..`, `%2e`, `\`, `//`, `@` and their encoded forms
- checks the route `scope` with the same rules as the rest of CALM Hub. The namespace or domain comes only from the path
- on a read-only CALM Hub, allows a method other than `GET` only on a `readOnly` route. Its `405`, and the `405` for a method that the route does not declare, has an `Allow` header. It lists only the methods that CALM Hub accepts on that path now, and `HEAD` with `GET`, because CALM Hub answers `HEAD` with the `GET` route
- sends only `Content-Type`, `Accept`, `Accept-Language`, `If-Match`, `If-None-Match` and its own `X-Calm-Hub-Identity` assertion. A header value with a line break gets `400`. The caller's token and cookies never go to the extension
- returns only `Content-Type` (`application/json`, `text/plain` or `text/event-stream`, and for a `4xx` reply also `application/problem+json` and other `+json` types), `Cache-Control`, `ETag`, `Retry-After` and `Vary`, and adds `Content-Security-Policy: sandbox; default-src 'none'`. It returns them only on a reply that it passes on: a backend `503` becomes `502` without `Retry-After`. It passes on a `304`. It does not follow redirects, and does not return `Location`, because that would name the private backend
- marks each reply `Cache-Control: private`, because the reply is for one user. It removes `public`, and keeps the other directives of the backend. Its own error replies are also `private`
- returns `502` or `504`, with a generic body, when the backend fails, is slow, replies with `5xx`, `401`, `407` or a `3xx` other than `304`, or sends another content type
- audits every non-`readOnly` call, including `GET`, as entity type `EXTENSION` with the extension id, route id and assertion `jti`. The entry has the namespace only for a `read`, `write` or `admin` route, and the domain only for a `domain_*` route. Outcomes are `SUCCESS`, `DENIED`, `FAILURE` (a refusal after the scope check, such as `400`, `413`, `415` or `503`, or a returned client error), or `UNKNOWN` (an upstream failure or unusable reply; the backend may have completed the call). The entry has the `jti` only when CALM Hub sent the call, and the source IP (the `X-Forwarded-For` header of the REST or MCP request) when `calm.audit.capture-source-ip=true`

Replies are buffered. Streaming is not supported yet.

CALM Hub does not audit a call that it refuses before the scope check: a `404`, a `400` for the path, the namespace or the domain, or a `405`.

CALM Hub does not start with an enabled extension that has routes when `calm.auth.enabled=false`, because every caller is then a global admin. Set `calm.extensions.allow-without-auth=true` only for local development.

### Identity keys

CALM Hub signs a short-lived JWT for each call, and publishes the public keys at `GET /api/calm/auth/jwks`. This endpoint is public. Set `calm.hub.base-url` to the URL that the backends expect in `iss`. When it is not set, `iss` is `http://localhost:8080`, and CALM Hub gives a warning at start up if an enabled extension has routes. Create a key pair:

```bash
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out hub-private.pem
openssl pkey -in hub-private.pem -pubout -out hub-public.pem
```

To change the key with no outage, put the new key first and keep the old public key in the list for at least `ttl-seconds`:

```bash
CALM_EXTENSIONS_IDENTITY_PRIVATE_KEY_LOCATION=/keys/new-private.pem
CALM_EXTENSIONS_IDENTITY_PUBLIC_KEY_LOCATIONS=/keys/new-public.pem,/keys/old-public.pem
```

In `proxy-auth` mode, any client that reaches CALM Hub directly can set `Remote-User`. Make CALM Hub listen only on loopback or behind the proxy.

---

## Docker Hub Images

All images are published to Docker Hub at [finos/calm-hub](https://hub.docker.com/r/finos/calm-hub/tags).
The `latest` tags point to the most recent release. Each release also has its own tags, for example
`0.8.0` and `0.8.0-native`, which never change. The changes in each release are in the
[CALM Hub changelog](https://github.com/finos/architecture-as-code/blob/main/calm-hub/CHANGELOG.md).

```bash
docker pull finos/calm-hub:latest
docker pull finos/calm-hub:latest-native
docker pull finos/calm-hub:latest-read-only-static
docker pull finos/calm-hub:latest-read-only-native
```

---

## GitHub Actions Build Status

### CI Builds

| Workflow | Status |
|:---------|:-------|
| Integration tests & coverage | [![Build Calm Hub](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub.yml) |
| Unit test coverage | [![Build Calm Hub Coverage](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub-coverage.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub-coverage.yml) |

### Docker Image Publishing

| Workflow | Image tag | Status |
|:---------|:----------|:-------|
| JVM image (MongoDB) | `latest` | [![Docker Publish Calm Hub](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub.yml) |
| Native image (MongoDB) | `latest-native` | [![Docker Publish Calm Hub (Native)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-native.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-native.yml) |
| Read-only JVM image | `latest-read-only-static` | [![Docker Publish Calm Hub (Read-Only Static)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-readonly.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-readonly.yml) |
| Read-only native image | `latest-read-only-native` | [![Docker Publish Calm Hub (Read-Only Native)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-readonly-native.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/docker-publish-calm-hub-readonly-native.yml) |

All docker-publish workflows include an automated smoke test that validates the image before pushing. See [smoke-test.sh](https://github.com/finos/architecture-as-code/blob/main/calm-hub/smoke-test.sh) for the assertion script.

---

## Quick Start

### Read-Only (no dependencies)

```bash
docker run --rm -p 8080:8080 finos/calm-hub:latest-read-only-static
# API:      http://localhost:8080/calm/namespaces
# Swagger:  http://localhost:8080/q/swagger-ui
```

### With MongoDB

```bash
# Start MongoDB
cd calm-hub/local-dev && docker-compose up -d

# Start CALM Hub (JVM)
cd calm-hub && ../mvnw quarkus:dev
```

---

### Show your decorators in Hub

An external service can write decorators with its own service account and ship a
views-only manifest. Hub draws the results; the service supplies no browser code.

1. Give the service account write access to the target namespace. Use that account's
   credentials with the decorator API, not a user's token. If the decorator type is
   reserved, the operator must also allow this principal to write that type.
2. Write decorators with a stable `type`, architecture version URLs in `target`,
   element ids in `applies-to`, and results in `data`. A known `$schema` is validated on write. For a reserved type, `PUT` the new
   result to the current decorator id (the id that the last write returned). Hub stores it as a new decorator and keeps the old one in the history.
3. Put this manifest at `<calm.extensions.dir>/scanner/extension.json`, then restart Hub:

```json
{
  "id": "scanner",
  "version": "1.0.0",
  "hubApi": 0,
  "name": "Security scan",
  "contributes": {
    "decorator-views": [{
      "id": "security-scan",
      "match": { "type": "security-scan" },
      "label": "Security scan",
      "overlay": {
        "status": "/result",
        "map": { "safe": "ok", "unsafe": "error" },
        "default": "info"
      }
    }]
  }
}
```

No routes or backend URL are needed.

## Further Reading

- [UI Walkthrough](../working-with-calm/calm-hub.md) - visual interface guide (namespace explorer, diagram canvas, timeline, compare mode)
- [Developer Guide](./developer-guide.md) - test pyramid, storage extension points, running CALM Hub from any data source
- [MCP & API Reference](./mcp-and-api.md) - Model Context Protocol tools, OpenAPI spec, Swagger UI
