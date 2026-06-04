# Java CALM Models Library — Design Spec

**Date:** 2026-06-04
**Branch:** calm-model-parsing
**Status:** Approved for implementation

---

## Goal

A Java library for parsing CALM architecture documents from JSON and working with them via a fluent, type-safe API — without needing raw JSONPath queries on the document. Mirrors the two-layer approach of the TypeScript `calm-models` package: a canonical layer that reflects the JSON structure exactly, and a model layer that exposes a clean, idiomatic Java API.

---

## Scope

- **In scope:** Core architecture model — nodes, relationships, flows, controls, metadata, interfaces. Canonical (parse) layer. Fluent query API. Type-safe parsing of custom extensions, metadata, interfaces, and control configs.
- **Out of scope (deferred):** Timeline / Moment, Diff, write/serialization back to JSON.

---

## Module Location

Java source lives inside the existing `calm-models/` directory:

```
calm-models/
├── package.json                  # existing TypeScript npm workspace (unchanged)
├── pom.xml                       # converted from POM-only to JAR module
└── src/
    ├── canonical/                # existing TypeScript source (unchanged)
    ├── diff/
    ├── model/
    ├── types/
    ├── main/java/org/finos/calm/model/
    │   ├── canonical/            # package-private, Jackson-annotated records
    │   └── ...                   # public model records and CalmArchitecture
    └── test/java/org/finos/calm/model/
```

Note: TypeScript uses `src/` as its root (flat subdirectories); Java uses the standard Maven `src/main/java` / `src/test/java` layout. Both live under `src/` but in non-overlapping subdirectories.

---

## Layer 1: Canonical (package-private)

Package: `org.finos.calm.model.canonical`

Jackson-annotated records that mirror the CALM JSON schema exactly. All records carry `@JsonIgnoreProperties(ignoreUnknown = true)`. Field names match the JSON via `@JsonProperty` where the JSON uses kebab-case. These types are never exposed in the public API.

`CalmNodeSchema` uses `@JsonAnySetter` to capture all unrecognised properties (custom node extensions) into a `Map<String, JsonNode>`.

Key canonical records:

| Record | Mirrors |
|---|---|
| `CalmArchitectureSchema` | root document |
| `CalmNodeSchema` | `nodes[]` entry |
| `CalmRelationshipSchema` | `relationships[]` entry |
| `CalmRelationshipTypeSchema` | `relationship-type` object |
| `CalmFlowSchema` | `flows[]` entry |
| `CalmFlowTransitionSchema` | `transitions[]` entry |
| `CalmInterfaceSchema` | `interfaces[]` entry |
| `CalmNodeInterfaceSchema` | `source`/`destination` in connects |
| `CalmControlsSchema` | `controls` object |
| `CalmControlSchema` | per-control entry |
| `CalmControlDetailSchema` | per-requirement entry |
| `CalmMetadataSchema` | `metadata` object |

---

## Layer 2: Model (public API)

Package: `org.finos.calm.model`

Immutable Java 21 records with camelCase fields. Optional fields use `java.util.Optional`. Each record has a package-private static `from(XSchema schema, ObjectMapper mapper)` factory; users never call these directly.

### `CalmArchitecture`

The entry point. Holds the full parsed document and all graph-aware query methods.

```java
// Parsing
CalmArchitecture arch = CalmArchitecture.parse(String json);
CalmArchitecture arch = CalmArchitecture.parse(String json, ObjectMapper mapper);

// Node queries
Optional<CalmNode>      arch.findNodeById(String uniqueId)
List<CalmNode>          arch.findNodesByType(String nodeType)
List<CalmNode>          arch.getNodes()

// Graph traversal (requires relationship context, so lives here)
// "linked" = any node connected via any relationship where nodeUniqueId
// appears as actor, source, destination, or container
List<CalmNode>          arch.getLinkedNodes(String nodeUniqueId)
// returns all relationships where nodeUniqueId appears in any role
List<CalmRelationship>  arch.getRelationships(String nodeUniqueId)

// Other top-level access
List<CalmRelationship>  arch.getRelationships()
List<CalmFlow>          arch.getFlows()
Optional<CalmControls>  arch.getControls()

// Metadata
Optional<Object>        arch.getMetadata(String key)
<T> Optional<T>         arch.parseMetadata(Class<T> type)
```

### `CalmNode`

```java
String                    node.uniqueId()
String                    node.nodeType()
String                    node.name()
String                    node.description()
List<CalmInterface>       node.interfaces()
Optional<CalmControls>    node.controls()

// Lookup by unique-id
Optional<CalmInterface>   node.findInterface(String uniqueId)
Optional<CalmControl>     node.findControl(String controlId)

// Metadata
Optional<Object>          node.getMetadata(String key)
<T> Optional<T>           node.parseMetadata(Class<T> type)

// Custom extensions — properties on the node not in the base schema
<T> Optional<T>           node.parseExtension(String name, Class<T> type)
```

### `CalmRelationship`

```java
String                  rel.uniqueId()
CalmRelationshipType    rel.relationshipType()   // sealed — see below
Optional<String>        rel.description()
Optional<String>        rel.protocol()
Optional<CalmControls>  rel.controls()
Optional<Object>        rel.getMetadata(String key)
```

### `CalmRelationshipType` — sealed interface

```java
public sealed interface CalmRelationshipType
    permits CalmConnectsType, CalmInteractsType,
            CalmDeployedInType, CalmComposedOfType, CalmOptionsType {}
```

Callers use pattern-matching switch; the compiler rejects non-exhaustive cases:

```java
switch (rel.relationshipType()) {
    case CalmConnectsType   c -> c.source()      // CalmNodeInterface
    case CalmInteractsType  i -> i.actor()       // String
    case CalmDeployedInType d -> d.container()   // String
    case CalmComposedOfType c -> c.container()   // String
    case CalmOptionsType    o -> o.options()     // List<CalmDecision>
}
```

### `CalmInterface`

Arbitrary schema-defined properties sit alongside `unique-id` in the JSON. The whole interface body is available for typed parsing:

```java
String              iface.uniqueId()
<T> T               iface.parseAs(Class<T> type)   // throws CalmExtensionParseException if malformed
```

### `CalmControls` / `CalmControl` / `CalmControlDetail`

```java
// CalmControls
Map<String, CalmControl>  controls.controls()
Optional<CalmControl>     controls.findControl(String controlId)

// CalmControl
String                        control.description()
List<CalmControlDetail>       control.requirements()

// CalmControlDetail
String                        detail.requirementUrl()
Optional<String>              detail.configUrl()
<T> Optional<T>               detail.parseConfig(Class<T> type)
```

### `CalmFlow` / `CalmFlowTransition`

```java
// CalmFlow
String                       flow.uniqueId()
String                       flow.name()
String                       flow.description()
List<CalmFlowTransition>     flow.transitions()
Optional<String>             flow.requirementUrl()
Optional<CalmControls>       flow.controls()

// CalmFlowTransition
String   transition.relationshipUniqueId()
int      transition.sequenceNumber()
String   transition.description()
String   transition.direction()   // "source-to-destination" | "destination-to-source"
```

### `CalmMetadata`

Internal — metadata is surfaced as `getMetadata(key)` and `parseMetadata(Type.class)` on the owning entity rather than as a standalone public type.

---

## Extension / Custom-type Parsing

All four `parseX` methods share the same contract:

- Uses the `ObjectMapper` provided at `CalmArchitecture.parse()` time (default: Jackson with `JavaTimeModule` registered)
- Returns `Optional.empty()` when the target data is absent
- Throws unchecked `CalmExtensionParseException` (wraps `JsonProcessingException`) when the data is present but cannot be deserialized into the requested type

```java
// Node extension property
Optional<MyPortConfig>       node.parseExtension("port-config", MyPortConfig.class)

// Whole metadata object
Optional<MyMetadata>         node.parseMetadata(MyMetadata.class)
Optional<MyMetadata>         arch.parseMetadata(MyMetadata.class)

// Whole interface body
MyPortInterface              iface.parseAs(MyPortInterface.class)

// Control detail config block
Optional<MyEncryptionConfig> detail.parseConfig(MyEncryptionConfig.class)
```

---

## Build

`calm-models/pom.xml` changes:

- `<packaging>jar</packaging>` (was `pom`)
- Runtime dependency: `jackson-databind`, `jackson-datatype-jsr310`
- Test dependencies: `junit-jupiter`, `assertj-core`
- Java 21 (inherited from root `pluginManagement`)

---

## Testing

Test fixtures: one or two representative CALM JSON documents stored under `src/test/resources/`.

Test coverage:
- Parse a full architecture fixture; assert node count, relationship count, flow count
- `findNodeById` — found and not-found cases
- `findNodesByType` — correct filtering
- `getLinkedNodes` — correct traversal for connects, interacts, deployed-in
- `getRelationships` — node appears as source, destination, and container
- `parseExtension` — present (happy path), absent (`Optional.empty()`), malformed (throws `CalmExtensionParseException`)
- `parseMetadata` — same three cases
- `parseAs` on interface — happy path and malformed
- `parseConfig` on control detail — same three cases
- Relationship type sealed switch — each of the five variants
