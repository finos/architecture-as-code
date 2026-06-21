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
| **MongoDB** (default) | External MongoDB 4.4+ | Yes — `QUARKUS_MONGODB_CONNECTION_STRING` | ✅ Yes |
| **Standalone** (NitriteDB) | Embedded file-based DB | No | ✅ Yes (file persisted at `CALM_STANDALONE_DATA_DIRECTORY`) |
| **Read-only** | Pre-seeded NitriteDB | No | ❌ No — HTTP 405 for POST/PUT/DELETE/PATCH |

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

```bash
# Run the read-only JVM image — no external dependencies needed
docker run --rm -p 8080:8080 finos/calm-hub:latest-read-only-static

# Test that mutations are blocked
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:8080/calm/namespaces \
  -H 'Content-Type: application/json' -d '{"name":"test"}'
# → 405
```

### How the Read-Only Data Image Layer Works

The read-only images use a **two-stage Docker build** to pre-seed the embedded NitriteDB with the full CALM schema dataset at *build time*:

```
Stage 1 — seed (JVM, writable)
  FROM ubi9/openjdk-21
  COPY quarkus-app/ and calm/ schemas + controls/
  RUN boot Quarkus in standalone (writable) mode
      → init script POSTs all schemas and controls into NitriteDB
      → graceful SIGTERM flushes and commits the database
      → calmSchemas.db is now ~290–450 KB of real data

Stage 2 — runtime (minimal base image)
  COPY --from=seed /data/calmSchemas.db   ← baked as an image layer
  chmod 0444                              ← immutable at filesystem level
  ENV CALM_READONLY=true
  ENV QUARKUS_PROFILE=standalone
```

The resulting image carries the seeded database as a read-only filesystem layer. At runtime the process opens the file in read-only mode, serves the pre-loaded content, and rejects all write requests.

**Why the native read-only image uses a JVM for seeding:** GraalVM native binaries compiled from NitriteDB cannot reliably *write* (commit) the H2 MVStore backing file due to Java serialisation requirements that are not fully supported in native mode. The JVM seed stage produces a database file that the native binary can then *read* correctly (via registered serialisation metadata). The native runtime is only ever used for reads in the read-only image.

---

## Docker Hub Images

All images are published to Docker Hub at [finos/calm-hub](https://hub.docker.com/r/finos/calm-hub/tags).

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

## Further Reading

- [UI Walkthrough](../working-with-calm/calm-hub.md) - visual interface guide (namespace explorer, diagram canvas, timeline, compare mode)
- [Developer Guide](./developer-guide.md) - test pyramid, storage extension points, running CALM Hub from any data source
- [MCP & API Reference](./mcp-and-api.md) - Model Context Protocol tools, OpenAPI spec, Swagger UI
