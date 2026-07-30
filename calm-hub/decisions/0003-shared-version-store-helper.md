# ADR 0003: Shared header/version store helper

**Status**: Accepted — partially implemented. The helpers themselves exist
(`MongoVersionDocumentStore`, `NitriteVersionDocumentStore`,
`SemanticVersionOrder`), but no store calls them yet, so nothing in running
CALM Hub uses this design. Depends on
[ADR 0001](0001-versioned-artefact-storage.md) and
[ADR 0002](0002-version-key-encoding.md).

## Context

ADR 0001 gives each of the 7 versioned types a header collection (reusing
the existing collection name) plus a new `<type>Versions` collection. Each
of the 8 existing stores hand-rolls its own read/write/version logic, so the
new shape needs somewhere for that logic to live once.

Looked at the current implementation in detail —
`MongoArchitectureStore`/`NitriteArchitectureStore` plus both existing
helpers — to ground the new helper's operations in what each store
actually needs to do today: list summaries (paged), create the entity,
list versions, get one version's content, create a version (reject if
exists), and force-write a version (upsert regardless).

## Decision

Two helper classes that each store **composes**, one per backend:
`MongoVersionDocumentStore` and `NitriteVersionDocumentStore`. Each exposes
the primitive operations every store needs against its
`(header collection, version collection)` pair:

- `headerExists(namespace, resourceId) -> boolean`
- `createHeader(namespace, resourceId, name, description)`
- `createVersion(namespace, resourceId, version, content) -> boolean` —
  never overwrites; returns `false` if the version already exists rather
  than throwing. The helper has no way to construct the right exception:
  each store's interface declares its own type
  (`ArchitectureVersionExistsException`, `PatternVersionExistsException`,
  and so on), so choosing the domain meaning of "already there" stays with
  the caller. Genuine write failures still throw `StorageWriteException`.
- `upsertVersion(namespace, resourceId, version, content)` — force-write,
  used by the update-in-place path
- `getVersion(namespace, resourceId, version) -> content or not-found`
- `listVersions(namespace, resourceId) -> List<String>`
- `listSummariesPaged(namespace, page) -> List<NamespaceResourceSummary>`

### Why composition rather than a shared base class

Not simply because the codebase has no base class today — it doesn't, but
what it has instead is duplication, which is no argument for anything. The
reason is that a base class can't actually express what these stores have
in common:

- **Every store implements a different interface, with differently-named
  methods and different checked exception types.**
  `ArchitectureStore.getArchitectureVersions` throws
  `ArchitectureNotFoundException`; `PatternStore.getPatternVersions` throws
  `PatternNotFoundException`. A shared superclass method can't declare the
  right exception per subclass without generic exception parameters plus a
  per-type exception factory to construct them — more machinery than the
  one-line delegation it would replace, and it still wouldn't unify the
  method names the interfaces demand.
- **Two backends mean two hierarchies.** Mongo and Nitrite share no storage
  API, so a base class helps within a backend at best, and the
  cross-backend duplication (the part actually worth removing) stays.
- **The stores are CDI beans** selected by `@LookupIfProperty` and narrowed
  with `@Typed`. Keeping them plain implementors of their interface, each
  holding a helper, avoids entangling that wiring with an inheritance chain.

Composition also keeps the seam honest: the helper knows about documents and
collections, the store knows about domain objects and exceptions, and
neither leaks into the other.

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

The count write is **best-effort, and never fails the version write**. It
runs only after the version document is durably stored, so a failure there
— whether the header is missing or the write itself errors — is logged at
`WARN` and swallowed rather than propagated. Propagating it would report
failure for a version that was in fact written, and a caller retrying that
"failure" would then be told the version already exists: strictly worse
than the understated count ADR 0001 already accepts, since that costs a
display number off by one rather than a wrong answer. `upsertVersion`
maintains the count on the same terms, incrementing only when it actually
inserted.

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

Same two-collection shape and the same operation set, but **uniqueness
cannot be delegated to the database the way the Mongo helper delegates it
to a unique index**. CalmHub creates no Nitrite indexes at all — checked
across `store/nitrite/` and `config/`, there is not a single `createIndex`
call, and `MongoIndexInitializationStep`'s javadoc says so outright: *"In
standalone/Nitrite mode the indexes are irrelevant — Nitrite stores use
`ReentrantLock` for concurrency control instead."*

So `NitriteVersionDocumentStore` must perform its own
check-then-write for duplicate rejection (does this
`(namespace, resourceId, version)` already exist?) **inside** the store's
existing write lock. That is genuinely safe here rather than a
check-then-act race, because Nitrite is single-process embedded and the
lock serialises every write to the store — unlike Mongo, where concurrent
application instances share one database and only a DB-level constraint can
arbitrate.

The practical consequence is that the two helpers are not symmetric:
`createVersion` on the Mongo side can insert optimistically and translate a
`DUPLICATE_KEY` error, while the Nitrite side must look first. Both present
the same result to callers.

Whether the existing store-instance-wide `ReentrantReadWriteLock`
(currently coarse: one lock per store, not per-namespace or per-resource)
can be narrowed under the new shape is a separate, still-open question —
smaller, more numerous documents plausibly reduce lock hold times and
contention — but it's a performance question, not a correctness one, and
isn't resolved by this ADR. Note that narrowing it would interact with the
check-then-write above: any narrower lock must still serialise writes to
the same `(namespace, resourceId, version)`, or uniqueness stops holding.
Left as a follow-up to revisit if profiling after implementation shows it
matters.

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
