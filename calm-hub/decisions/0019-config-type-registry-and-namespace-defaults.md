# ADR 0019: Config type registry and namespace defaults

**Status**: Implemented. `c4-mapping` is the only config type. Hub bundles a copy of `standards/c4/c4-mapping.json`
as proposed in finos/calm-schema#53. Replace it with the released file when calm-schema publishes the standard.

## Context

Tools need settings that change how they process or show CALM documents. The first case is a C4 mapping
(finos/architecture-as-code#3727, #3728): it maps node types to C4 kinds, and one organisation wants one
mapping for all of its teams. Later cases are a visualiser theme (#2344), decorator-view settings and
settings that extensions declare (#3396).

No Hub resource fits these settings:

| Type | Why it does not fit |
|---|---|
| Standard | A JSON Schema that documents must conform to. Tools that list Standards would show settings |
| Document | Markdown with frontmatter |
| Decorator | Targets named architectures, not a namespace |
| UI config (`calm.ui`) | Set by the operator at start-up. Not versioned, not per namespace |

## Decision

Add one versioned **config** resource with a type in the path:
`/api/calm/namespaces/{namespace}/configs/{config-type}/{id}/versions/{version}`.

### A registry of types in code

`ConfigType` is an enum. Each constant names its path segment, its schema `$id` and the schema file under
`META-INF/calm-config-types/`. Hub validates every write against that schema and refuses an unknown type with
`400`. `ConfigSchemaValidator` loads each schema at start-up and fails start-up if one is missing or broken,
because Hub then cannot accept a config of that type.

We chose an enum over a type list in configuration because each type needs a schema and, usually, a tool that
reads it. Both ship with a Hub release. Types that extensions declare (#3396) can extend the registry later.

### Storage

Configs use the shared header/version helpers (ADR 0001, ADR 0003), with `configType` as the discriminator
field, as `documents` uses `documentType`. Collections: `configs`, `configVersions` and `configDefaults`.
Ids come from one `config` counter, so an id is unique across types.

`configDefaults` holds one document per `(namespace, configType)`: the config id and the canonical version.
MongoDB keeps it unique with an index (`MongoConfigIndexStep`, schema version 16 → 17). NitriteDB replaces it
under a store lock.

GitHub mode reads `configs/<config-type>/*.json` from the namespace repository, and `configs/<config-type>/default.json`
is the namespace default at the HEAD SHA. It does not validate these files: nothing writes them through Hub.

### Namespace defaults

A default names a config version **in the same namespace**. This keeps the permission model simple: the
namespace admin who sets the default can read the config, and a team cannot point at a config that it
cannot see.

A read of `.../configs/{type}/default` walks the namespace chain (`org.ab.cd`, then `org.ab`, then `org`) and
returns the first default it finds, with the namespace that set it and `inherited`. If a default names a
version that cannot be read, Hub logs a warning and goes on to the parent. If no namespace sets a default,
Hub returns `404`, and the tool uses its built-in default.

Setting or removing a default needs namespace `admin`. A namespace that holds a config or a default cannot be
deleted, because its children inherit the default.

## Consequences

- A new kind of tool setting needs a schema file and one enum constant, not new storage, endpoints and tests.
- Reading the default costs one lookup per namespace level. Namespace chains are short.
- Configs have no `DELETE` in this version. A default can be removed.
