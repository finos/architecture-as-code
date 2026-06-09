---
id: calm-hub-mcp-api
title: MCP & API Reference
sidebar_label: MCP & API Reference
sidebar_position: 2
---

# CALM Hub — MCP & API Reference

CALM Hub exposes two API surfaces:

1. **REST API** — the primary interface, fully documented via OpenAPI/Swagger UI.
2. **MCP server** — an experimental [Model Context Protocol](https://modelcontextprotocol.io) endpoint for AI-agent integrations.

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

All CALM Hub REST endpoints are prefixed with `/calm`:

```
GET  /calm/namespaces
GET  /calm/namespaces/{namespace}/architectures
GET  /calm/namespaces/{namespace}/architectures/{architectureId}
GET  /calm/namespaces/{namespace}/architectures/{architectureId}/versions/{version}
POST /calm/namespaces/{namespace}/architectures
...
```

The full endpoint list with request/response schemas is visible in the Swagger UI at `/q/swagger-ui`.

### Access Control

Endpoints are protected by scope-based access control. The required scope is declared on each resource method. Common scopes:

| Scope | Access |
|:------|:-------|
| `architectures:read` | Read architectures |
| `architectures:all` | Read and write architectures |
| `patterns:read` | Read patterns |
| `patterns:all` | Read and write patterns |
| `namespace:admin` | Create/delete namespaces |

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

CALM Hub uses the **HTTP Streamable** MCP transport (Quarkiverse `quarkus-mcp-server-http`, version 1.12.0). This transport uses JSON-RPC 2.0 over HTTP POST.

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

- [Overview & runtimes](./index.md) — feature summary, image variants, read-only mode
- [Developer Guide](./developer-guide.md) — test pyramid, storage extension points
- [UI Walkthrough](../working-with-calm/calm-hub.md) — visual interface guide
