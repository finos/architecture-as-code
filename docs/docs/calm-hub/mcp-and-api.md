---
id: calm-hub-mcp-api
title: MCP & API Reference
sidebar_label: MCP & API Reference
sidebar_position: 2
---

# CALM Hub — MCP & API Reference

CALM Hub exposes two API surfaces:

1. **REST API** - the primary interface, fully documented via OpenAPI/Swagger UI.
2. **MCP server** - an experimental [Model Context Protocol](https://modelcontextprotocol.io) endpoint for AI-agent integrations.

---

## REST API

### OpenAPI Specification

CALM Hub uses [SmallRye OpenAPI](https://quarkus.io/guides/openapi-swaggerui) (Quarkus extension) to auto-generate an OpenAPI 3 specification from the JAX-RS resource annotations. The spec reflects the live configuration of the running instance (all endpoints, request/response schemas, security scopes).

| Endpoint | Description |
|:---------|:------------|
| `/q/openapi` | OpenAPI 3 specification (YAML) |
| `/q/openapi?format=json` | OpenAPI 3 specification (JSON) |
| `/q/swagger-ui` | Interactive Swagger UI explorer |

The Swagger UI is always included in the image (`quarkus.swagger-ui.always-include=true`), so it is available in production as well as development.

### Base URL

CALM Hub exposes two REST surfaces:

**Numeric-id storage API** — `/api/calm/...`

The primary CRUD interface for namespaces, architectures, patterns, flows, standards, and other artefacts. Resources are addressed by server-assigned numeric IDs.

```
GET    /api/calm/namespaces
POST   /api/calm/namespaces
GET    /api/calm/namespaces/{namespace}/architectures
POST   /api/calm/namespaces/{namespace}/architectures
GET    /api/calm/namespaces/{namespace}/architectures/{id}/versions/{version}
```

**Name-based API** — `/calm/...`

A user-facing layer that maps human-readable names (slugs) to their numeric IDs and provides versioned access by name. All paths include a `/versions/` segment.

```
POST /calm/namespaces/{namespace}/architectures/{name}/versions/{version}
GET  /calm/namespaces/{namespace}/architectures/{name}/versions
GET  /calm/namespaces/{namespace}/architectures/{name}/versions/{version}
GET  /calm/namespaces/{namespace}/architectures
```

The full endpoint list with request/response schemas is visible in the Swagger UI at `/q/swagger-ui`.

### Finding the architectures that implement a pattern

```
GET /calm/namespaces/{namespace}/patterns/{name}/versions/{version}/implementations
```

Use this before you change a pattern. It shows which architectures depend on the version you are about to change.

```jsonc
{
  "pattern": { "namespace": "finos", "name": "api-gateway", "version": "1.0.0" },
  "implementations": [
    { "namespace": "finos", "architectureId": 7, "version": "1.2.0", "customId": "trade-capture" }
  ]
}
```

#### How the link is recorded

An architecture names its pattern in its own `$schema` field. `calm generate` copies the pattern's `$id` into that field:

```jsonc
// the pattern, fetched from CalmHub
{ "$id": "https://your-hub/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0", ... }

// the architecture generated from it
{ "$schema": "https://your-hub/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0", ... }
```

The endpoint therefore finds an architecture only when someone generated it from a pattern **fetched from this hub**.

Three cases produce no match:

| How the architecture was made | What `$schema` holds |
|:---|:---|
| Generated from a pattern file on disk | That file's own `$id`, such as `https://calm.finos.org/getting-started/conference-signup.pattern.json` |
| Written by hand | Whatever the author supplied, often the CALM meta-schema |
| Posted to `/api/calm/...` | Whatever the caller supplied |

CalmHub does not check `$schema` on either API. It accepts all three.

#### What an empty list means

An empty list has two readings, and the endpoint does not separate them. Either nothing implements the pattern, or the architectures that do were never recorded in a way the hub can resolve. Check how your architectures are produced before you read an empty result as "safe to change".

The endpoint deliberately reports no count of unresolvable architectures. Such a count would cover every namespace you can read, because an architecture in one namespace can implement a pattern in another. It would therefore be the same number for every pattern you ask about. That makes it a fact about the hub, not about the pattern.

#### Behaviours to know

The hub compares only the path of the `$schema`, never the host. References therefore keep working after the hub moves to a new address.

The match is pinned to one pattern version. Architectures on version 2.0.0 do not appear when you ask about 1.0.0.

Any spelling of the version works. CalmHub accepts `1.0.0`, `1-0-0` and `100` as the same version, and a stored `$schema` can carry any of them. The endpoint matches them all and echoes the canonical `1.0.0` form back to you.

A pattern version that does not exist returns `404`, not an empty list. So an empty `implementations` array always means the version exists and nothing records it.

#### Limiting the results

The endpoint returns every match by default. Add `limit` and `offset` to page through them:

```
GET /calm/namespaces/finos/patterns/api-gateway/versions/1.0.0/implementations?limit=20&offset=40
```

There is no cap when you omit `limit`. A truncated list would read as a small blast radius, so the endpoint never shortens one you did not ask to shorten.

#### Cost

The hub answers this on demand and caches nothing. Each call reads the architecture versions you are allowed to see, and compares the `$schema` of each one. No index covers that comparison, because MongoDB does not index a field whose name starts with `$`.

Your permissions decide how much the hub reads. An index selects the namespaces you can read, and the comparison runs over those documents only. If you can read every namespace, through public read or `GLOBAL admin`, then every architecture is in scope and the hub reads all of them.

The cost therefore grows with the size of your hub. It measured 1.4ms over 3000 architecture versions, so it is not a concern at that size.

#### The fields in a result

`architectureId` addresses the architecture on the numeric-id API. `customId` is the name it is addressed by on the name-based API. `customId` is absent for an architecture created through the numeric-id API, because that architecture never had a name. Use `architectureId` for those.

### Access Control

Endpoints are protected by **per-namespace permissions**. Access is granted via `UserAccess` records stored in the active backend; each record ties a username to a permission level for a specific namespace or control domain.

| Permission | Scope | What it grants |
|:-----------|:------|:---------------|
| `read` | namespace | Read artefacts in a namespace |
| `write` | namespace | Read + write artefacts (implies `read`) |
| `admin` | namespace | Read + write + manage access grants (implies `write`) |
| `domain_read` | control domain | Read controls in a domain |
| `domain_write` | control domain | Write controls in a domain |
| `global_admin` | all namespaces | Bypasses all namespace permission checks (`admin` on the reserved `GLOBAL` namespace) |

Namespace permissions follow a hierarchical model using `.` as a separator (`org`, `org.team`, `org.team.project`). `read` is AND-ed across the ancestor chain (every level must have a matching grant); `write` and `admin` cascade from any ancestor via OR. See [`calm-hub/PERMISSIONS.md`](https://github.com/finos/architecture-as-code/blob/main/calm-hub/PERMISSIONS.md) and the [entitlements guide](../working-with-calm/calm-hub-entitlements.md) for the full model.

When running without the `secure` Quarkus profile, authentication is disabled and all endpoints are accessible without a token.

---

## MCP Server

:::caution Experimental
The MCP server is **disabled by default** and is currently experimental. The API surface may change between releases.
:::

### What Is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open standard for connecting AI language models to external tools and data sources. CALM Hub's MCP server exposes its artefact store as a set of callable *tools* that an LLM can invoke to query architectures, patterns, controls, and more.

### Enabling the MCP Server

```properties
# application.properties  (or pass as env var)
calm.mcp.enabled=true
```

```bash
# Via environment variable
export CALM_MCP_ENABLED=true
../mvnw quarkus:dev
```

The MCP endpoint is always registered at `/mcp` (HTTP Streamable transport). The `calm.mcp.enabled` flag gates whether the tool handlers are active — with it set to `false` the endpoint is reachable but all tool calls return a disabled response.

### Endpoint

```
POST /mcp
Content-Type: application/json
```

CALM Hub uses the **HTTP Streamable** MCP transport (Quarkiverse `quarkus-mcp-server-http`, version 1.12.1). This transport uses JSON-RPC 2.0 over HTTP POST.

### Available Tools

| Tool provider | Example tools |
|:--------------|:-------------|
| `ArchitectureTools` | `list_architectures`, `get_architecture` |
| `PatternTools` | `list_patterns`, `get_pattern` |
| `ControlTools` | `list_controls`, `get_control` |
| `DomainTools` | `list_domains`, `create_domain` |
| `InterfaceTools` | `list_interfaces`, `get_interface` |
| `NamespaceTools` | `list_namespaces`, `create_namespace` |
| `SearchTools` | `search_architectures` |
| `StandardTools` | `list_standards` |
| `TimelineTools` | `get_timeline` |
| `AdrTools` | `list_adrs`, `get_adr` |

To retrieve the full tool list from a running instance:

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '.result.tools[].name'
```

### Example Tool Call

```bash
# List all namespaces via MCP
curl -s -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_namespaces",
      "arguments": {}
    }
  }'
```

### Testing with Quarkus Dev UI

When running in `quarkus:dev` mode with `%dev.quarkus.mcp.server.traffic-logging=true`, all JSON-RPC messages are printed to the console. The [Quarkus Dev UI](http://localhost:8080/q/dev) also ships an interactive MCP tester.

### Connecting an AI Client

Any MCP-compatible AI client (e.g. Claude Desktop, Cursor, VS Code with an MCP extension) can connect to CALM Hub by adding it as an HTTP MCP server pointing at `http://<host>:8080/mcp`.

Example `mcp.json` entry for Claude Desktop or a compatible client:

```json
{
  "mcpServers": {
    "calm-hub": {
      "url": "http://localhost:8080/mcp",
      "transport": "http"
    }
  }
}
```

---

## Further Reading

- [Overview & runtimes](./index.md) - feature summary, image variants, read-only mode
- [Developer Guide](./developer-guide.md) - test pyramid, storage extension points
- [UI Walkthrough](../working-with-calm/calm-hub.md) - visual interface guide
