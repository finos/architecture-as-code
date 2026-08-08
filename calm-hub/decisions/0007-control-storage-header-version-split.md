# ADR 0007: Control storage — header/version split via two composed helper instances

**Status**: Accepted. Implemented alongside this record — closes
[#2884](https://github.com/finos/architecture-as-code/issues/2884).

## Context

[ADR 0004](0004-defer-control-and-decorator-storage.md) deferred Control's
redesign until real implementation experience from
[ADR 0001](0001-versioned-artefact-storage.md)–[0003](0003-shared-version-store-helper.md)
existed to inform it, rather than speculating up front. That work has since
shipped: all seven other versioned types (Architecture, Pattern, Flow,
Standard, Interface, Timeline, ADR) now store one *header* document per
resource and one *version* document per version, via a shared composed
helper (`MongoVersionDocumentStore` / `NitriteVersionDocumentStore`).

Control is the one remaining type on the old shape: one document per
*domain*, holding an array of controls, each with a versioned `requirement`
map **and** a nested `configurations` array whose entries each carry their
own versioned `versions` map — double-nested, one level deeper than the
other seven, and reached in Mongo via `arrayFilters` (`$[ctrl]`/`$[cfg]`).
It shares the same unbounded-growth problem #2884 describes: every version
of every control and every configuration in a domain accumulates forever in
one document, risking MongoDB's 16MB limit.

## Decision

**Compose `MongoVersionDocumentStore`/`NitriteVersionDocumentStore` twice,
unmodified, once per versioning axis.** This is possible because `controlId`
(`MongoCounterStore.getNextControlSequenceValue()`) and `configurationId`
(`getNextControlConfigurationSequenceValue()`) are both drawn from **global**
atomic counters, not scoped per-domain or per-control — so neither needs a
compound key to stay unique.

1. **Requirement level** reuses the helper exactly as the other seven types
   do: `namespace = domain`, `resourceId = controlId`, header collection
   `controls` (name reused, matching how the other seven kept their existing
   collection name as the header), version collection `controlVersions`
   (new), `idField = "controlId"`.
2. **Configuration level** composes a second instance of the same helper,
   with a synthetic composite namespace `domain + "::" + controlId`
   (`DomainStore`'s `DOMAIN_REGEX` disallows `:`, so this can never collide
   with a real domain), `resourceId = configurationId`, header collection
   `controlConfigurations` (new), version collection
   `controlConfigurationVersions` (new), `idField = "configurationId"`. The
   composite namespace scopes *listing* ("configurations belonging to this
   control") — uniqueness already comes from the global counter.

Neither `MongoVersionDocumentStore` nor `NitriteVersionDocumentStore`
required any code change. `MongoControlStore`/`NitriteControlStore` become
thin translations between `ControlStore`'s methods and calls against the two
composed instances, the same shape every other migrated store already has.

This also retires `VersionKeySelector` and dash-encoded version keys
(`"1-0-0"`) entirely — Control adopts `CanonicalVersion`/dot-separated
versions like every other type, finishing what
[ADR 0002](0002-version-key-encoding.md) left as Control's one exception.

### The migration fan-out is new code, not a reuse of `MongoVersionSplitMigration`

`MongoVersionSplitMigration`/`NitriteVersionSplitMigration` (the shared
fan-out used by the other seven types) hard-code the old grouping field as
`namespace` and perform a single-level fan-out (one array → one header +
version pair). Control's old-shape document groups by `domain`, not
`namespace`, and needs a **two-level** fan-out from one shared read: each
`controls[]` entry becomes a control header + version(s), and each of *that*
control's nested `configurations[]` entries becomes a configuration header +
version(s) under the composite namespace. Retrofitting that into the shared
class for one caller would have made it harder to read for the seven types
that don't need it. `MongoControlSplitMigration`/`NitriteControlSplitMigration`
are new, Control-specific classes that mirror the shared ones' structure
(id-list-then-refetch for Mongo to bound memory, delete-old-document only
after both fan-outs for it succeed, `collapseToCanonicalVersions` duplicated
locally the same way it is already duplicated between the Mongo and Nitrite
versions of the shared helper) without touching the shared classes or any of
the other seven types' steps.

### Collection names

| Level | Header | Version | `idField` |
|---|---|---|---|
| Requirement | `controls` (reused) | `controlVersions` (new) | `controlId` |
| Configuration | `controlConfigurations` (new) | `controlConfigurationVersions` (new) | `configurationId` |

### Schema version

The migration step is `fromVersion() == 13` (advancing schema 13 → 14) —
the next free slot as of this writing. Three other steps independently
claimed the versions in between while this work was in flight:
[ADR 0006](0006-denormalize-adr-title-onto-header.md)'s
`MongoAdrTitleBackfillStep`/`NitriteAdrTitleBackfillStep` (`10` → `11`),
`MongoResourceMappingIndexStep` (`11` → `12`), and
`MongoPatternLayoutIndexStep` (`12` → `13`). Since a committed
`SchemaMigrationStep`'s `fromVersion()` is immutable once shipped, this step
must not merge before whatever is genuinely latest on `main` at that time —
check `fromVersion()` on the migration steps registered on `main` and
renumber this one if another step has claimed `13` in the meantime.

## Consequences

- Closes #2884 fully: all eight originally-affected types are now on
  bounded-growth storage. `DecoratorStore` remains untouched — it was never
  versioned and never shared the growth problem (ADR 0004) — so ADR 0004 is
  now fulfilled with respect to Control but still open with respect to
  Decorator, which has no urgency of its own.
- `MongoUpsertPush` loses its last caller in `MongoControlStore` but keeps
  two others (`MongoLayoutStore`, `MongoDecoratorStore`) — it is not deleted.
- `VersionKeySelector` and its test are deleted — zero remaining callers.
- Every read of a domain's controls or a control's configurations no longer
  loads the entire domain document (Mongo) or replaces it wholesale on every
  write (Nitrite) — the specific memory/blast-radius concern #2884 raised
  for Control is gone along with the 16MB ceiling.
- `mongo/init-mongo.js` moves its Control seed data (file-loaded controls
  plus the three inline Permitted Connection / Micro-Segmentation / MCP
  Guardrail controls) from the old nested shape into the four new
  collections, and `LATEST_SCHEMA_VERSION` advances to 12.
