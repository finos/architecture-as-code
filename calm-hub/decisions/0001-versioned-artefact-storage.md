# ADR 0001: Versioned artefact storage redesign

**Status**: Proposed — not yet implemented. Tracked in
[#2884](https://github.com/finos/architecture-as-code/issues/2884).

## Context

Every Mongo store in `calm-hub` (`store/mongo/`) uses a **one document per
namespace (or per domain for Control)** shape: a single Mongo document holds
an array of entities, and each entity carries a `versions` map containing
the **full raw content of every version ever written**. Nothing is ever
deleted (CalmHub is append-only). MongoDB enforces a hard **16MB limit per
BSON document**, inclusive of all nested arrays/sub-documents. At ~40KB per
realistic architecture JSON, a single namespace can hit that ceiling after
roughly **400 version-writes total** across every resource of that type in
the namespace — plausible for any actively-used, long-lived, shared
namespace.

NitriteDB (standalone/embedded mode) has the identical document shape and
the identical unbounded-growth problem, just without Mongo's specific
16MB/BSON ceiling (different storage engine — H2 MVStore, file-backed, not
in-memory; see `NitriteDBConfig.java`). Every Nitrite read/write does a full
in-memory read-modify-write of the entire namespace document, under a
store-instance-wide `ReentrantReadWriteLock` (not per-namespace) — so as
documents grow, lock hold times grow and contention increases across *all*
namespaces for that store, not just the busy one. No hard byte-count wall,
but real memory/perf degradation risk, especially in memory-constrained
embedded deployments (e.g. the pre-seeded read-only Docker images).

### Current shape (as-is)

All 8 Mongo stores (`store/mongo/`) and their Nitrite equivalents
(`store/nitrite/`) share this pattern:

| Store | Collection | Entity fields | Version map field |
|---|---|---|---|
| Architecture | `architectures` | `architectureId`, `name`, `description`, `versions` | `versions` |
| Pattern | `patterns` | `patternId`, `name`, `description`, `versions` | `versions` |
| ADR | `adrs` | `adrId`, `revisions` | `revisions` |
| Flow | `flows` | `flowId`, `name`, `description`, `versions` | `versions` |
| Interface | `interfaces` | `interfaceId`, `name`, `description`, `versions` | `versions` |
| Standard | `standards` | `standardId`, `name`, `description`, `versions` | `versions` |
| Timeline | `timelines` | `timelineId`, `name`, `description`, `versions` | `versions` |
| Control | `controls` (per **domain**) | `controlId`, `requirement` (versions), `configurations[]` (nested, own `versions`) | `requirement` + nested `configurations[].versions` |

Version keys are dash-encoded (`"1-0-0"` instead of `"1.0.0"`) because Mongo
field names can't contain `.`. `MongoControlStore` is the structural
outlier — genuinely double-nested arrays, uses `arrayFilters` with
`$[ctrl]`/`$[cfg]` placeholders to reach two levels deep.

Not in this table: **Decorator** (`decorators` collection). It's a 9th
non-domain, non-control resource type, but it's not versioned —
`updateDecorator` overwrites in place, no `versions` map, no version
history. It doesn't have the unbounded-growth problem this ADR addresses.

No shared base class across the 8 stores in either backend — each
duplicates read/write/version logic independently. Only shared code today:
`MongoUpsertPush` (push+upsert-with-duplicate-retry) and
`MongoResourceSlice` (`$slice`-projection pagination, only used by
Architecture/Pattern). Nitrite has no `$slice` equivalent; pagination is
done in-memory after loading the full array.

## Decision

### Scope

- **In scope**: Mongo store code (`store/mongo/`), Nitrite store code
  (`store/nitrite/`), database initialization/seed scripts
  (`MongoIndexInitializationStep`, `nitrite/init-nitrite.sh`,
  `nitrite/seed-readonly.sh`), and a migration pathway for existing
  production data in both backends.
- **Out of scope**: the domain interfaces (`ArchitectureStore` etc. stay
  unchanged — REST/service layers untouched). Controls and Decorators are
  deliberately deferred, not addressed by this ADR — see
  [ADR 0004](0004-defer-control-and-decorator-storage.md). Domains are out
  of scope for an unrelated reason: the `domains` collection isn't a
  versioned artefact at all, just a grouping mechanism, so it doesn't have
  the growth problem this ADR addresses.

### Shape: two collections per artefact type, one document per version

Move from **one-document-per-namespace** to **one-document-per-version**,
generalized across the 7 versioned types (Control excluded).

- **Header collection reuses the existing collection name**
  (`architectures`, `patterns`, etc.); a new sibling `<type>Versions`
  collection is added (`architectureVersions`, `patternVersions`, etc.) —
  14 collections total.
  - Header collection: one document per `(namespace, resourceId)`, holding
    `name`/`description` (plus `versionCount` and `metadata` — see below).
    This is what lets a resource exist with zero versions — the header doc
    *is* the "this resource exists" record, independent of whether any
    version documents have been written.
  - Version collection: one document per `(namespace, resourceId,
    version)` tuple, holding that version's `content` (plus `metadata` —
    see below).
  - **No `latestVersion` field on the header.** Checked against actual
    usage: `NamespaceResourceSummary` (the summary API type) only exposes
    `name`/`description`/`id`/`versionCount`, never a latest-version
    pointer or its content. A cached pointer would be one more place for
    staleness bugs with no current consumer. If something later needs
    "latest version's content," resolve it by querying the version
    collection sorted by version key — same comparison
    `VersionKeySelector.latestVersionKey()` already does in-memory today,
    applied to stored documents instead of a loaded map.
  - **`versionCount` *is* denormalized on the header** (revised from an
    earlier draft of this ADR, which rejected caching it — see below).
    `NamespaceResourceSummary.versionCount` is read by `calm-hub-ui`'s
    `ItemCard.tsx` on every namespace listing page view; reads of this
    field vastly outnumber writes (creating a version is rare relative to
    browsing a namespace), so the classic counter-cache tradeoff favours
    paying a small write-side cost to avoid computing it on every read. It
    is maintained via an atomic `$inc` on the header document as part of
    the version-creation write path — see
    [ADR 0003](0003-shared-version-store-helper.md) for the mechanism.
  - Consequence: creating a version is no longer one atomic document
    write — it's two: the version document insert, then an atomic `$inc`
    on the header's `versionCount`. If a crash lands between the two, the
    header can undercount by one until corrected. Accepted risk: the
    window is two sequential writes within the same request, the blast
    radius is a display number off by one (not data loss or corrupted
    content), and it doesn't compound across requests. Not justified by
    "we can restore from backup" — that's the *migration* rollback story
    below, an unrelated one-time event, not a standing excuse for ongoing
    drift. Stronger guarantees (a Mongo transaction wrapping both writes)
    would require a replica-set deployment — `local-dev/docker-compose.yml`
    and `deploy/docker-compose.yml` both run Mongo standalone today, so
    this isn't available without a deployment topology change, and wasn't
    judged worth that cost for a version-count badge.
  - **Both the header and version documents get a `metadata` field** — an
    open, schema-free object, empty by default. Not driven by a concrete
    requirement in this ADR; added because this redesign is what makes it
    cheap to add and expensive to retrofit later. Motivated by
    [#2856](https://github.com/finos/architecture-as-code/issues/2856)
    ("Allow archiving of documents in CalmHub"), specifically
    [this comment](https://github.com/finos/architecture-as-code/issues/2856#issuecomment-5050999800),
    which proposes archiving as a `metadata` property (e.g. `{"status":
    "ARCHIVED"}`) set via `PATCH
    .../versions/{version}/metadata` with an
    `application/merge-patch+json` (RFC 7396) body, extensible later to
    other per-version or per-resource metadata (e.g. asset inventory IDs)
    without needing first-class CalmHub support for each one. Under the
    *old* shape, a targeted merge-patch to one version's metadata would
    mean updating one key inside a map nested inside an array inside a
    namespace-wide document — under this ADR's shape, it's a `$set` on one
    small, independently-addressable document. Note from the issue thread
    itself: while scoping #2856, its author (Mark) found this exact
    16MB/growth problem (#2884) and flagged it as a blocker to build #2856
    on top of — this ADR is that prerequisite work. Deliberately not
    designing the archiving feature itself here (that's #2856's own scope,
    a separate future ADR) — just reserving the field so it doesn't
    require another migration when that work starts.

#### Example: an architecture with 2 versions

**Before** (current shape — one `architectures` document per namespace,
this architecture as one array entry with an embedded `versions` map,
dash-encoded keys):

```jsonc
// architectures collection — one document per namespace
{
  "namespace": "finos",
  "architectures": [
    {
      "architectureId": 1,
      "name": "Sample Architecture",
      "description": "...",
      "versions": {
        "1-0-0": { ... },   // full architecture content for v1.0.0
        "1-1-0": { ... }    // full architecture content for v1.1.0
      }
    }
    // ...other architectures in this namespace
  ]
}
```

**After** (this ADR's shape — a header document in `architectures`,
holding identity, the denormalized `versionCount`, and an open `metadata`
object, plus one document per version in the new `architectureVersions`
collection, using the dot-separated version field from
[ADR 0002](0002-version-key-encoding.md) and each carrying its own
`metadata`):

```jsonc
// architectures collection — now one document per resource (the header)
{
  "namespace": "finos",
  "architectureId": 1,
  "name": "Sample Architecture",
  "description": "...",
  "versionCount": 2,
  "metadata": {}
}
```

```jsonc
// architectureVersions collection — one document per version
{ "namespace": "finos", "architectureId": 1, "version": "1.0.0", "content": { ... }, "metadata": {} }
{ "namespace": "finos", "architectureId": 1, "version": "1.1.0", "content": { ... }, "metadata": { "status": "ARCHIVED" } }
```

The full architecture JSON now lives in `content`; the header no longer
holds a `versions` field at all once migration has run.

**Why reuse the existing collection name instead of `architectureHeaders`
etc.**: it turns the migration into "add one new collection, then shrink
the existing documents in place" (extract each `versions` entry into
`architectureVersions`, then `$unset` the `versions` field from the
`architectures` doc) rather than "create two new collections, backfill
both, drop the old one" — smaller, lower-risk migration, and every existing
index/ops reference to the collection name stays valid throughout. Accepted
tradeoff: `architectures` no longer holds full content post-migration, just
headers — mildly misleading to anyone running a raw
`db.architectures.findOne()` without knowing about this ADR.

**Why per-type collections instead of a single shared
`versionedArtifactHeaders`/`versionedArtifacts` pair with a `resourceType`
discriminator**:
- Matches the existing convention — each resource type already has its own
  collection today — so no surprise for anyone querying collections
  directly or for adjacent tooling.
- Smaller blast radius: a bug in one type's write path can't corrupt
  another type's data, since they're physically separate collections.
- Independent migration/rollback per type, matching the incremental
  migration approach below.
- Code reuse still happens via a shared helper (see
  [ADR 0003](0003-shared-version-store-helper.md)), not shared storage —
  same pattern as the existing `MongoUpsertPush`/`MongoResourceSlice`
  static helpers.
- Minor bonus, not the deciding factor: `resourceType` doesn't need to be a
  field in every document or a leading key in every compound index — it's
  implicit in which collection you're querying.

### Migration and rollback

- Migration runs once per deployment via the existing gating/once-only
  mechanism (`SchemaVersionStore` + `SchemaMigrationRunner` +
  `SchemaMigrationStep`, both backends, with a distributed lock) — what's
  needed is a `SchemaMigrationStep` implementation that does the
  old-shape → new-shape fan-out: read every old-shape namespace document,
  write it out as version documents + a header doc, verify no version data
  lost/reordered.
- Read-only pre-seeded Nitrite images (`build-readonly-image.sh`,
  `seed-readonly.sh`) bake the `.db` file at image-build time — the seed
  scripts themselves need updating to produce the new shape directly, not
  just a runtime migration path (there's no "runtime" for a read-only image
  opened with `readOnly(true)`).
- **Rollback story: database backup, not an additive/non-destructive
  migration with a burn-in period.** CalmHub is pre-1.0 — no public
  stability guarantee is broken by a migration that isn't reversible
  in-place, so the extra design/implementation cost of dual-write or
  delayed-delete isn't justified. If the new shape has a bug
  post-migration, restore from backup rather than rolling the schema back.

## Consequences

- Removes the 16MB risk entirely for Mongo (each document is bounded by a
  single version's size, not accumulated history) and removes the
  full-document read-modify-write cost for Nitrite.
- All 8 `TestMongo<X>StoreShould` + 8 `TestNitrite<X>StoreShould` unit test
  classes need rewriting for the new document shape. Integration tests
  (`Mongo<X>Integration.java`) need updating plus a new migration-specific
  integration test. JaCoCo's 90%-per-class gate applies to new
  migration/helper code as usual.
- Need a real "approaching/exceeding 16MB" regression test — currently zero
  tests reference document size limits anywhere in the codebase. The only
  suite hitting a real Mongo instance today is
  `MongoConcurrencyIntegration.java` (via `../mvnw -P integration verify`,
  TestContainers) — natural home for this, since mocked unit tests can only
  simulate `MongoWriteException`, not trigger Mongo's real enforcement.

### Open questions (not yet decided)

- ~~Keep dash-encoded version keys as a document field, or make version a
  proper indexed field now that it's not a map key?~~ Resolved: see
  [ADR 0002](0002-version-key-encoding.md) — dot-separated, dash-encoding
  dropped entirely.
- ~~Need a new shared helper (parallel to `MongoUpsertPush`) since there's
  no base class to override.~~ Resolved: see
  [ADR 0003](0003-shared-version-store-helper.md).
- ~~`MongoControlStore`'s double-nesting doesn't fit this shape as cleanly
  (domain → control → configuration → version, one extra level) — needs
  bespoke design.~~ Deferred, not resolved: see
  [ADR 0004](0004-defer-control-and-decorator-storage.md) — deliberately
  not designed yet, revisit after ADR 0001–0003 ship.
