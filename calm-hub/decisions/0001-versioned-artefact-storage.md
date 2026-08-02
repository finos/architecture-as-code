# ADR 0001: Versioned artefact storage redesign

**Status**: Accepted — partially implemented. Architecture uses this shape on
both backends, complete with its version 2 → 3 migration
(`MongoArchitectureVersionSplitStep` / `NitriteArchitectureVersionSplitStep`),
so an existing deployment's data moves on first startup after upgrading. The
other six versioned types still use the old shape, which is the incremental
rollout this ADR describes rather than a divergence from it. Tracked in
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
  (`store/nitrite/`), new `SchemaMigrationStep`s, and a migration pathway
  for existing production data in both backends.
- **`mongo/init-mongo.js` seeds the new shape and declares the schema
  already migrated.** It hand-writes documents in the storage shape, so it
  changes with it — but changing the documents alone is not enough, and the
  reason is worth stating because it is not obvious and it bites hard.

  A fresh database starts at schema version 0, so `SchemaMigrationRunner`
  would run every step on first startup. Step 0
  (`MongoIndexInitializationStep`) creates a *unique* index on
  `<type>.namespace`, permitting one document per namespace — which
  new-shape seed data violates before any migration reaches the collection
  (`finos.fluxnova` alone seeds six architectures). Step 0 would throw, the
  runner would leave the migration lock held, and CalmHub would refuse
  every request until an administrator cleared it by hand. Not a
  degradation: the stack does not come up. Step 0 is a committed step and
  therefore immutable, so it cannot be taught to skip that index.

  So the seed script also writes the `schemaVersion` marker at the latest
  version, and the runner returns before taking the lock. The cost is that
  skipping step 0 skips *all* the indexes it creates, not just the
  problematic one, so the seed script now creates them itself — including
  for the six types that have not migrated. **That inventory is duplicated
  and must be kept in step with `MongoIndexInitializationStep` and with
  each new migration step.** When a type migrates, three things move
  together: its seed documents, its entry in the seed's index list, and
  `LATEST_SCHEMA_VERSION`.

  This was chosen over the alternative of seeding the old shape and letting
  the migration convert it on first startup, which would have kept the
  index inventory in one place at the cost of a seed script permanently
  expressing a shape the application cannot read.
- **Also in scope, and easy to miss**: `MongoSearchStore` /
  `NitriteSearchStore`. They read each entity collection directly rather
  than through its store interface, so a type that migrates without its
  search path moving too fails *silently* — the array lookup returns null
  for a header document, the loop skips every document, and that type
  returns no search results at all, with nothing logged. Both stores now
  carry an array-shaped and a header-shaped path, since the two coexist
  until all seven types have moved.
- **Out of scope**: the domain interfaces (`ArchitectureStore` etc. stay
  unchanged — REST/service layers untouched). Controls and Decorators are
  deliberately deferred, not addressed by this ADR — see
  [ADR 0004](0004-defer-control-and-decorator-storage.md). Domains are out
  of scope for an unrelated reason: the `domains` collection isn't a
  versioned artefact at all, just a grouping mechanism, so it doesn't have
  the growth problem this ADR addresses.
- **Also out of scope, for reasons worth stating** so nobody re-adds them:
  the Nitrite seed scripts (`nitrite/init-nitrite.sh`,
  `nitrite/seed-readonly.sh`) seed exclusively over the REST API against a
  writable instance, so they follow the storage shape automatically and need
  no changes (see *Migration and rollback*); and
  `MongoIndexInitializationStep` cannot be touched at all, because a
  committed migration step is immutable (same section).

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
etc.**: only one new collection has to be introduced (`architectureVersions`)
rather than two, and every existing index/ops reference to `architectures`
stays valid throughout — no cutover to a differently-named collection.
Accepted tradeoff: `architectures` no longer holds full content
post-migration, just headers — mildly misleading to anyone running a raw
`db.architectures.findOne()` without knowing about this ADR.

Note this is **not** an in-place shrink of each existing document. The
old-shape document is one per *namespace* holding an **array** of
architectures, each with its own embedded `versions` map — so the migration
is a genuine **1 → N fan-out**: one namespace document becomes N header
documents (one per architecture) plus M version documents, and the original
namespace document is replaced rather than edited down. Reusing the
collection name is about avoiding a second new collection and keeping the
name stable, not about making the rewrite smaller.

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
  old-shape → new-shape fan-out: read every old-shape namespace document
  and, for each entry in its resource array, write one header document plus
  one version document per entry in that resource's `versions` map, then
  verify no version data was lost or reordered.
- **A new step per resource type, never an edit to an existing one.** A
  committed `SchemaMigrationStep` is immutable: `SchemaMigrationRunner`
  records the schema version in `SchemaVersionStore` and runs each step
  once, so a deployment already past version N never re-runs step N.
  Editing a shipped step would therefore change behaviour only on *fresh*
  deployments, silently diverging them from existing ones with nothing to
  catch it.
- **Each new step must also transition its collection's indexes.**
  `MongoIndexInitializationStep` created a unique index on `namespace`
  *alone* for every entity collection — that enforces exactly one document
  per namespace, which is the old shape and directly contradicts the header
  collection's one-document-per-`(namespace, resourceId)`. Since that step
  is immutable (above), each per-type migration step drops the old
  `{namespace: 1}` unique index on its own collection and creates
  `{namespace: 1, <type>Id: 1}` on the header collection and
  `{namespace: 1, <type>Id: 1, version: 1}` on `<type>Versions`, before
  fanning out the data. Dropping must tolerate the index already being
  absent, to preserve the idempotency `SchemaMigrationStep` asks for.
- Read-only pre-seeded Nitrite images bake the `.db` file at image-build
  time, and a database opened with `readOnly(true)` genuinely has no runtime
  migration path. **Despite that, the seed scripts need no changes.**
  `seed-readonly.sh` boots the real application in standalone *writable*
  mode and then runs `init-nitrite.sh`, which populates it purely over
  HTTP — there are no direct `.db` or database writes in either script. The
  seeders therefore emit whatever shape the store layer writes at that
  commit, with no knowledge of document shape and nothing to keep in step.
  This also means there's no ordering constraint against the rest of the
  migration: a partially-migrated codebase bakes an image consistent with
  the code that will read it.
- What *does* need checking for read-only images: the baked `.db` must
  record the latest schema version, so that at runtime
  `SchemaMigrationRunner` sees `version == latest` and skips acquiring the
  migration lock rather than attempting a write against a read-only
  database. The runner's javadoc states it already handles this case —
  worth verifying against a built image, not designing for.
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
- A real "approaching/exceeding 16MB" regression test now exists, in
  `integration/performance/MongoDocumentSizeLimitIntegration.java` (via
  `../mvnw -P integration verify`, TestContainers). It has to run against a
  real Mongo because mocked unit tests can only simulate
  `MongoWriteException`, never trigger the actual enforcement. It asserts
  both halves of this ADR's claim with the same ~2MB payload: **Pattern**,
  still one document per namespace, accumulates history until a write is
  rejected and must surface an honest `413`; **Architecture**, now one
  document per version, accepts ~24MB of history without any write failing.
  When Pattern migrates, the `413` half moves to a type that hasn't yet.

### Open questions (all now resolved)

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
