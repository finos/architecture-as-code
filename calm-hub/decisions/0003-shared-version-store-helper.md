# ADR 0003: Shared header/version store helper

**Status**: Proposed — not yet implemented. Depends on
[ADR 0001](0001-versioned-artefact-storage.md) and
[ADR 0002](0002-version-key-encoding.md).

## Context

ADR 0001 gives each of the 7 versioned types a header collection (reusing
the existing collection name) plus a new `<type>Versions` collection. Per
ADR 0001's "no shared base class" convention (each of the 8 existing stores
duplicates read/write/version logic independently today), the new shape
needs equivalent code reuse via a shared *helper*, not shared storage or
inheritance — the same pattern as the existing `MongoUpsertPush`
(push+upsert-with-duplicate-retry) and `MongoResourceSlice` (`$slice`
pagination) static helpers.

Looked at the current implementation in detail —
`MongoArchitectureStore`/`NitriteArchitectureStore` plus both existing
helpers — to ground the new helper's operations in what each store
actually needs to do today: list summaries (paged), create the entity,
list versions, get one version's content, create a version (reject if
exists), and force-write a version (upsert regardless).

## Decision

Two helper classes, mirroring the existing per-backend split (no shared
base class across backends): `MongoVersionDocumentStore` and a Nitrite
counterpart. Each exposes the primitive operations every store needs
against its `(header collection, version collection)` pair:

- `headerExists(namespace, resourceId) -> boolean`
- `createHeader(namespace, resourceId, name, description)`
- `createVersion(namespace, resourceId, version, content)` — throws if the
  version already exists
- `upsertVersion(namespace, resourceId, version, content)` — force-write,
  used by the update-in-place path
- `getVersion(namespace, resourceId, version) -> content or not-found`
- `listVersions(namespace, resourceId) -> List<String>`
- `listSummariesPaged(namespace, page) -> List<NamespaceResourceSummary>`

### Two of the three existing shared helpers retire

- **`MongoUpsertPush`'s retry-on-duplicate-key logic becomes
  unnecessary.** It exists because the old shape upserts into a shared
  per-namespace array document, which can race between two concurrent
  first-writes to a brand-new namespace. In the new shape, `resourceId`
  comes from the atomic counter (`MongoCounterStore`) before the header
  insert happens — there's no genuine race to retry, just a plain
  `insertOne` backed by a unique index on `(namespace, resourceId)`.
- **`MongoResourceSlice`'s `$slice` projection becomes unnecessary too.**
  It exists to page into an array field on one shared document. Headers
  are now one document per resource, so `listSummariesPaged` is ordinary
  `skip()`/`limit()` on the header collection.
- Both helpers stay in place for `MongoControlStore`, which keeps the old
  shape (ADR 0001 excludes Control from this redesign).
- `VersionKeySelector` (version-count/latest-version comparison) is
  unaffected — `versionCount` is now a stored field (see below), not
  computed from a loaded map, so its `versionCount()` method's callers
  move into this helper's `createVersion`; `latestVersionKey()` is
  unused by the helper (ADR 0001 decided against a `latestVersion` field)
  but is left in place for any caller that still needs it against a
  loaded version list.

### `createVersion` maintains the header's `versionCount`

Per ADR 0001's revised decision, `versionCount` is denormalized on the
header (not computed via aggregation). `createVersion` therefore performs
two writes: insert the version document, then an atomic `$inc` on the
header's `versionCount`. See ADR 0001's *Decision* section for the accepted
drift risk if a crash lands between the two.

### Existence checking must use the header, not the version list

A header can legitimately have zero versions (that's the point of
splitting header from version — see ADR 0001). So `listVersions` returning
an empty list is **not** evidence the resource doesn't exist — callers that
need to distinguish "exists with 0 versions" from "doesn't exist" must call
`headerExists` explicitly, not infer non-existence from an empty version
list the way `getArchitectureVersions` does today (its `ArchitectureDoc ==
null` check conflates "namespace has no matching architecture array entry"
with "architecture not found," which happened to be safe under the old
shape but would be wrong under the new one).

### Nitrite

Same two-collection shape and the same operation set. Whether the existing
store-instance-wide `ReentrantReadWriteLock` (currently coarse: one lock
per store, not per-namespace or per-resource) can be narrowed under the new
shape is a real question — smaller, more numerous documents plausibly
reduce lock hold times and contention — but it's a performance question,
not a correctness one, and isn't resolved by this ADR. Left as a follow-up
to revisit if profiling after implementation shows it matters.

## Consequences

- Each of the 7 stores' Mongo/Nitrite implementations shrinks to calling
  the shared helper plus type-specific glue (constructing the right
  `Document`/domain object, translating exceptions), replacing the
  duplicated read/write/version logic every store currently hand-rolls.
- `MongoControlStore` is unaffected — out of scope per ADR 0001, still
  uses `MongoUpsertPush`/`MongoResourceSlice` directly.
- Test impact: as already noted in ADR 0001, all 8
  `TestMongo<X>StoreShould`/`TestNitrite<X>StoreShould` classes need
  rewriting; the shared helpers themselves need their own dedicated test
  classes (`TestMongoVersionDocumentStoreShould` etc.), consistent with how
  `MongoUpsertPush`/`MongoResourceSlice` are tested today.
