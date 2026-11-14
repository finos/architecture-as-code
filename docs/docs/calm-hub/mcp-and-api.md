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

The type segment is not case-sensitive in a request, so `Architectures` and `architectures` name the same resource. This also applies to the type segment in a `$id` that you send. CALM Hub always writes the type segment in lowercase, in the `$id` of a returned document and in the `Location` header. The CALM CLI reads only the lowercase form.

Writes to the name-based API require a top-level `"title"` field in the document body (or `"name"` for a flow), including for timelines.

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

An architecture names its pattern in its own `$schema`, which `calm generate` sets to the pattern's `$id`.

| | |
|---|---|
| Version | A release such as `1.0.0`, or a snapshot such as `1.0.0-SNAPSHOT`. A version that does not exist returns `404`, not an empty list. |
| Host | Only the path of the `$schema` is compared, so references keep working after the hub moves. |
| Order | Sorted by namespace, then `architectureId`, then architecture version, so `1.2.0` comes before `1.10.0`. |
| Paging | `limit` and `offset` are optional. Omit them and you get every match — the endpoint never shortens a list you did not ask to shorten. An `offset` without a `limit` returns every match after the offset. |
| `customId` | The name on the name-based API. Omitted for an architecture created through the numeric-id API, which never had one; use `architectureId` for those. |
| GitHub mode | Not available. The endpoint returns `501`. |

The hub answers on demand and caches nothing, reading the architectures you are allowed to see. See [ADR 0008](https://github.com/finos/architecture-as-code/blob/main/calm-hub/decisions/0008-pattern-implementations-read-the-architecture-schema.md) for why the link is resolved at request time rather than stored.

### Snapshot Versions

A version ending in `-SNAPSHOT` (e.g. `1.0.0-SNAPSHOT`) is mutable — it can be re-posted with new content. A release version (e.g. `1.0.0`) is immutable once created. Publishing a release deletes the matching snapshot, if one exists. Snapshots are supported on architectures, patterns, flows, standards, interfaces, and timelines only.

| Request | Effect | Status |
|:--------|:-------|:-------|
| `POST .../versions/1.0.0-SNAPSHOT` (first time) | Creates the snapshot | `201` |
| `POST .../versions/1.0.0-SNAPSHOT` (again) | Replaces the snapshot's content | `200` |
| `POST .../versions/1.0.0` | Publishes the release, deletes `1.0.0-SNAPSHOT` | `201` |

A snapshot cannot be created if its release version is already published — CALM Hub returns `409 Conflict`.

Snapshots are written through the name-based `/calm/...` API only. The numeric `/api/calm/...` write endpoints reject a `-SNAPSHOT` version; their `GET` endpoints can read one.

### Decorator Write Rules

The decorator endpoints (`/api/calm/namespaces/{namespace}/decorators`) and the MCP decorator tools apply the same rules on write.

| Rule | When | Status |
|:-----|:-----|:-------|
| Size | The decorator JSON is larger than 1 MiB (1,048,576 bytes of UTF-8). The schema check makes all errors before Hub keeps the first 20, so this limit bounds its cost | `413` |
| Field types | `$schema`, `unique-id` or `type` is not a string, or `target`, `target-type` or `applies-to` is not an array of strings. Hub reads these fields, so it checks them also when there is no `$schema`. REST gives one fixed message that does not echo the body. MCP names the field | `400` |
| Reserved type | The old or new decorator `type` is reserved, and the caller is not one of its writers. Applies to create and update | `403` |
| Schema check | The decorator `$schema` is one that Hub knows, and the decorator does not match it. The body lists the first 20 errors, each with its `location` (a JSON Pointer). If there are more, `moreErrors` gives how many. MCP gives the same list and "and n more" | `400` |
| Hub-owned fields | The decorator has a top-level `creationDateTime`, `updateDateTime`, `supersededDateTime`, `supersedes` or `supersededBy`. Hub sets these fields and keeps them beside the decorator | `400` |
| Keys the store cannot keep | MongoDB: a key has a NUL character. NitriteDB: a key named `_id` has a value that is not a whole number, or a key is empty or has an empty part before or between dots (`.a`, `a..b`). The message tells which rule applies | `400` |

Hub knows the calm-schema decorator Standards that it bundles (`deployment`, `kubernetes`, `control-evaluation`) and the base decorator definition (`https://calm.finos.org/release/<version>/meta/decorators.json#/defs/decorator`). Hub accepts a decorator with any other `$schema` without a check. At startup, Hub checks that each `$ref` to `calm.finos.org` in a bundled schema resolves, also a nested one. A schema with a `$ref` that does not resolve stays unknown, and Hub logs a warning.

Hub stores the decorator as it checked it. A key such as `$numberInt` stays plain data. An integer larger than a 64-bit integer reads back with all of its digits, up to 34 digits on MongoDB. MongoDB stores a longer integer as a double, so it loses precision.

No type is reserved by default. Reserve a type in `application.properties`:

```properties
calm.decorators.reserved."validation".writers=system
calm.decorators.reserved."control-evaluation".writers=policy-engine
```

A writer is a principal name, the same name that the audit log records for the caller.

At startup, Hub logs each reserved type with its number of writers. Check this line after a change: a key with a typing error reserves a different type and leaves the intended type open.

A reservation does not vouch for decorators of the type that already exist. Before the reservation, any caller with `write` could create one, and after it that decorator looks the same as one from a writer. Before you reserve a type, list its decorators (`GET .../decorators/values?type=<type>` in each namespace), and delete the ones that a writer did not create. The audit log records who created each one through REST. It does not record MCP tool calls, except extension commands.

A reserved type is also append-only. An update of a reserved-type decorator does not change it. Hub stores a new decorator that supersedes the old one, returns `201` with the new `id` and a `Location` header, and keeps the old one. Hub stores the link in its own storage fields, not in the decorator `data`. For a REST update, the audit log records an `UPDATE` of the old id and a `CREATE` of the new id. The audit log does not record an MCP update. Other types keep the in-place update (`200`).

| Request | Effect |
|:--------|:-------|
| `GET .../decorators`, `GET .../decorators/values` | Lists only current decorators |
| `GET .../decorators/{id}` | Returns the decorator, current or superseded |
| `GET .../decorators/{id}/history` | Returns the history that contains `{id}`, current first. Each entry has `id`, `supersedes`, `supersededBy`, `supersededDateTime` and `decorator` |
| `PUT .../decorators/{id}` on a superseded decorator | `409 Conflict`. Update the current decorator (the id that the last write returned) |
| `DELETE .../decorators/{id}` | Deletes the whole history. Needs `global_admin`. The caller does not have to be a writer of the reserved types in it. If another write supersedes the decorator during the delete, Hub returns `409 Conflict` and deletes nothing. Retry the delete. In GitHub mode, Hub returns `501`, as for all writes |

The MCP tool `getDecoratorHistory` returns the same history.

An update grows a history only when the old or new type is reserved. Then Hub adds a full copy of the decorator, and it does not remove old entries. Other updates change the decorator in place. In MongoDB, all decorators of a namespace are in one document, and MongoDB limits a document to 16 MB. At the limit, each write that makes that document larger fails with `413`, for all decorators in the namespace. To recover, a global admin deletes histories that are no longer necessary with `DELETE .../decorators/{id}`. This deletes the whole history, current decorator included, so the writer must then create the current result again. NitriteDB has no such limit, but its storage also grows.

Hub records when it writes each decorator. Every read returns the times: `GET .../decorators/{id}`, `.../decorators/values`, each `decorator` in a history, and the MCP decorator tools.

| Field | Set when |
|:------|:---------|
| `creationDateTime` | Hub stores the decorator. A decorator that supersedes another gets a new time |
| `updateDateTime` | Hub stores the decorator, and on each in-place update |
| `supersededDateTime` (history entry) | A newer decorator supersedes this one. The old decorator keeps its own `updateDateTime`, so that time stays the time its content was last written |

The times are UTC ISO-8601 strings with milliseconds, for example `2026-11-06T10:15:30.123Z`. Hub stores them in its own storage fields, not in the decorator. A decorator that Hub stored before it recorded times has no times: the fields are not in the response, and `supersededDateTime` is `null`. Hub does not know when such a decorator was created, so it never adds a `creationDateTime`. An in-place update gives it an `updateDateTime` only.

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

### Extension Tools

CALM Hub makes one tool for each command of an enabled [extension](index.md#extensions) when `calm.mcp.enabled` is true. The tool name is `ext_<id>_<command>`, for example `ext_example-services_list-services`. These tools come after the built-in tools in `tools/list`, sorted by name.

**Trust model.** Extension manifests, with their input and output schemas, are trusted operator configuration, as `application.properties` is. CALM Hub reads them one time at start-up, from its built-in extensions and `calm.extensions.dir`, and nothing changes them at runtime. At start-up CALM Hub checks them for usual mistakes (the rules below). It does not try to stop a schema that is made to be slow or to break clients. Such a schema can make its own tool slow, and an output schema can make some MCP clients refuse to list the tools. To fix this, correct the manifest. CALM Hub bounds what a caller controls: arguments are at most 1 MiB of JSON, deeply nested arguments are a tool error, input patterns match in linear time, and the scope is checked before the input.

- The input and output schemas come from the manifest. Before the scope check, CALM Hub maps the arguments to a request, as the CLI does. It refuses a path value that it does not accept, a filled path that matches another route, a query value with a control character, and a request line longer than 4096 characters. Then it checks the scope, and then the arguments against the input schema, before it calls the extension. It matches the patterns of the input schema with [RE2J](https://github.com/google/re2j), in a time that is linear in the length of the argument. Thus a pattern such as `^(.*a){12}$`, which is very slow in Java, cannot hold a request. Arguments larger than 1 MiB of JSON, or nested too deeply for CALM Hub to read, are a tool error before all these checks. With the 100-term pattern limit below, this bounds the time to match one pattern. It does not bound the time of a whole check: that depends on the schema, which the operator controls (see the trust model above). A tool error lists at most 20 input errors, and then the number of the others.
- One schema that a client cannot compile makes TypeScript MCP SDK clients lose every tool. Thus each input and output schema must use this subset of JSON Schema 2020-12:

  | Rule | Supported | Refused |
  |---|---|---|
  | Dialect | 2020-12, with or without `$schema` | Other `$schema` values, for example draft-07 |
  | Subschemas | Objects and booleans | Other values, for example `"properties": {"limit": "integer"}` |
  | Depth | Objects and arrays nested at most 64 deep, counting every level: subschemas, property maps, lists and the values of other keywords. Each `$ref` counts as one more level, followed by the levels of its target, as Ajv compiles it. A `$ref` back to a schema that contains it adds no levels, so recursive schemas are supported | Deeper schemas, also a long chain of `$ref`s through `$defs`. Ajv in the SDK overflows its stack on a deep schema |
  | `$ref` | A local JSON Pointer: `#`, `#/$defs/name`, `#/properties/name`. It must point to a subschema, and not only to a loop of `$ref`s | Remote refs (CALM Hub and MCP clients do not fetch them), `#anchor` refs, and refs with `%`. Use `$defs` names that need no percent-encoding |
  | Identifiers | None | `$id`, `$anchor`, `$dynamicAnchor`, `$dynamicRef`, `$recursiveAnchor` and `$recursiveRef` as a key at any depth, under any keyword: also under `x-*` keywords, `default`, `examples`, `const`, `enum`, and as a property or `$defs` name. Thus a schema cannot declare a property named `$id`. The arguments can still have one, unless the schema refuses additional properties |
  | `pattern`, `patternProperties` keys | Regular expressions that are valid in both ECMA-262 (with the `u` flag) and Java. At most 1000 characters, and groups nested at most 64 deep | Java-only syntax, for example `(?i)abc`, `a++` or `\A`. ECMA-only syntax, for example `(?<first_name>…)` (Java group names have only letters and digits) or `\u{5A}` (use `\u005A`). Also `(?i:…)` modifiers and `&&` in a class, which older clients or Java read differently |
  | Input `pattern`, `patternProperties` keys | Also patterns that RE2J can match with the same meaning | Lookaheads, lookbehinds, back references, `\S` in a class, and Unicode properties (`\p{…}`, `\P{…}`: RE2J has older Unicode tables than the clients). Also a pattern larger than 100 terms when each repeat is expanded, where an empty group or alternative counts as 1 term: `a{100}` is accepted, `a{101}`, `(?:a{10}){11}` and `(?:(?:){1000}){1000}` are refused. Output schemas keep the rule above |
  | Input `format` | `date`, `time`, `date-time`, `duration`, `email`, `hostname`, `ipv4`, `ipv6` and `uuid`, which CALM Hub checks in linear time | All other formats, also `uri`, `url` and `regex`. Output schemas can use any format |
  | Input `patternProperties` | With `properties` and `additionalProperties` next to them | `unevaluatedProperties` anywhere in the same input schema, and a `$ref` into `patternProperties` or into the `additionalProperties` next to them. CALM Hub checks these keywords itself, so vertx cannot see which properties they evaluate |

  A command with a schema outside this subset gets no tool. CALM Hub logs a warning that names the extension, the command, the schema and the location of the error. For a schema that is not valid 2020-12, this is the deepest error, which names the value to fix.
- If CALM Hub cannot load the JSON Schema 2020-12 meta-schema, it makes no extension tools and logs an error.
- MCP requires an output schema of type `object`. CALM Hub wraps any other output schema as `{"type": "object", "properties": {"result": <schema>}, "required": ["result"]}`, and returns the reply as `{"result": <reply>}`. The wrapped schema gets a CALM Hub `$id`, so that its `$ref`s still point into it.
- MCP servers and clients need an object for each property schema. CALM Hub publishes a boolean subschema as `{}` (`true`) or `{"not": {}}` (`false`). `additionalProperties` and `unevaluatedProperties` stay booleans.
- A command that CALM Hub cannot make a tool for gets no tool, and CALM Hub logs a warning. An extension never stops CALM Hub from starting.
- `readOnlyHint` is true for a `GET` or `readOnly` route. `destructiveHint` and `idempotentHint` come from the command. With no hint, a write is destructive and not idempotent.
- Each call goes through the extension proxy, with the same scope, read-only, audit and size rules as a REST call. CALM Hub checks the scope when the tool is called. A user sees every tool, also one that they cannot call.
- A read-only CALM Hub makes no tool for a command whose route it cannot run.
- Arguments that fill a `{param}` go in the path, percent-encoded as by `encodeURIComponent`. Query arguments are encoded as by `URLSearchParams`, so a space becomes `+`. Thus the CLI and MCP send the same path and query for one input. A missing value is a tool error. A value must not be empty or `.`, or contain `..`, `/`, `\`, `%`, `@`, a look-alike of `/`, `\`, `.`, `%`, `@` or `;` (such as U+2215, U+FF3C or U+2025, which NFKC makes `..`), a code point whose NFKC form contains `/` or `\` (such as U+2100, `a/c`), a control character or a lone surrogate, the parts that the REST proxy refuses. Thus a value such as `%61dmin` or `a/../b` is a tool error. A value that makes the path match another route, such as `admin` for `/services/{service}` next to a `/services/admin` route, is a tool error too: a tool calls only the route of its command.
- The rest go to the query for `GET` and `DELETE`, and to the JSON body for other methods. A query name or value must not contain a control character or a lone surrogate. A number fills the path or the query in plain notation, as in the CLI: `1.0` gives `1`, and `1e21` gives `1000000000000000000000`.
- The request line of the same REST call (the method, `/api/calm/extensions/<id>/api`, the path, the query and `HTTP/1.1`) must be at most 4096 characters, the Vert.x limit, or the call is a tool error.
- A `2xx` reply is the result: structured content and the same JSON as text if the command has an output schema, otherwise text. Any other reply is a tool error.

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
