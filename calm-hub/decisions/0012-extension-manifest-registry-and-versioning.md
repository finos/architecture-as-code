# ADR 0012: Extension manifest, registry and versioning

**Status**: Proposed. The proof of concept loads manifests from a directory and
serves `GET /api/calm/extensions`. Route ids, commands, schema validation and
per-environment overrides are not built.

## Context

One manifest must drive the proxy, the UI, the CLI and MCP. The manifest is also
what the operator reviews before enabling an extension, so it must show every
call the extension can receive.

Facts in the proof of concept and the code:

- The manifest records use `@JsonIgnoreProperties(ignoreUnknown = true)`. A
  misspelt `readonly` is dropped with no error, and the route is then not
  read-only.
- A screen refers to its route by path. A path change breaks the link with no
  error.
- `UiConfig` is the only `@ConfigMapping`. Extension ids contain dashes, and
  SmallRye Config cannot map environment variables to dynamic map keys that
  contain dashes without ambiguity.
- MCP servers must validate tool input, so Hub needs a JSON Schema validator in
  any case. `io.vertx:vertx-json-schema` is in the Quarkus BOM, supports JSON
  Schema 2020-12, does not fetch remote `$ref`s, and is what the
  `quarkus-mcp-server` schema validator uses.

Grafana's `plugin.json` is the closest analogue: proxy routes with a permission
check on each route, and a host version range.

## Decision

**Manifest shape.** One `extension.json` for each extension, with:

| Field | Purpose |
|---|---|
| `id` | Equals the folder name. Lower case, digits and dashes |
| `version` | Semantic version, for information only |
| `hubApi` | Integer contract version |
| `name`, `description`, `provider` | Shown to operators and users |
| `routes` | The proxy surface and the full permission list. Each route has `id`, `method`, `path`, `scope` and `readOnly` |
| `commands` | Each names a route by `id`, and adds `description`, `input`, optional `output`, and `destructive` and `idempotent` hints |
| `contributes` | Extension points. Each refers to a route by `id` |

A command takes `method`, `scope` and `readOnly` from its route. Input properties
that match a `{param}` fill the path. The rest go to the query for GET and
DELETE, and to the JSON body for other methods. `input` and `output` are JSON
Schema 2020-12. The backend URL is not in the manifest. It is configuration.

**Validation.** `vertx-json-schema` validates the manifest against its published
JSON Schema, and validates each command input. A typed record gives code access
to the data. Unknown fields are errors. Java checks only what the schema cannot
express: route references exist, namespace scopes have a `{namespace}`
parameter, the id equals the folder name, and the MCP tool name is short enough.
If the step-0 spike shows that `vertx-json-schema` fails in a native image, the
fallback is Bean Validation on the record, with a test that the record and the
schema accept and reject the same fixtures.

**Versioning.** `hubApi` is one integer for the manifest, the assertion and the
UI context. Use `0` until the author types are published, then `1`. Hub accepts
a set of values and refuses to start for any other value, or for an unknown
extension point. Additive changes stay in the same version. To move to a new
version, Hub accepts both values for at least one minor release.

**Configuration.** Static settings (`dir`, signing key, HTTP limits) are in a
`@ConfigMapping(prefix = "calm.extensions")`, apart from `calm.ui`. After the
manifests load, the registry reads `calm.extensions."<id>".enabled`, `order` and
`backend-url` by full name for each known id. Configuration wins over manifest
defaults, so one manifest moves from development to production unchanged. Hub
refuses to start if an enabled extension with routes has no backend URL.

**Registry.** Hub also reads built-in manifests from the classpath.
`GET /api/calm/extensions` lists the enabled extensions in order. It leaves out
the backend URL, and the routes and commands that this Hub cannot run, such as
write routes on a read-only Hub.

## Consequences

- An invalid manifest stops Hub at start up, not when a page uses it.
- The operator reviews one list, `routes`, to see everything an extension can
  receive.
- Commands and contributions do not repeat method or scope, so they cannot
  disagree with their route.
- An author must name a route by `id`. Renaming a path does not break links.
- `vertx-json-schema` becomes a declared dependency. Its native behaviour is
  tested in the step-0 spike.
- A new extension point needs a schema change and, if it changes the meaning of
  an existing field, a new `hubApi` value.
