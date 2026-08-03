# ADR 0003: Shared header/version store helper

**Status**: Implemented. All fourteen store implementations — seven types, two
backends — compose `MongoVersionDocumentStore` / `NitriteVersionDocumentStore`
rather than hand-rolling their own read/write/version logic.

The operation list below grew five times during the rollout, each time
because a type's existing behaviour could not otherwise be preserved. Worth
reading as a record of what the original design missed:

- `updateHeaderDetails` — a version write also renames the resource.
- `updatePresentHeaderDetails` — Pattern, Flow and Timeline guard those
  fields on blank where Architecture, Standard and Interface overwrite
  unconditionally. That is a real difference between the types, not an
  inconsistency to tidy, so both operations exist.
- `deleteHeader` — compensation for a failed first version write, which the
  old shape's single atomic push made impossible.
- `createFirstVersion` — that compensation used correctly, which every store
  had been repeating. Not a new primitive; it exists because getting it wrong
  strands a header no endpoint can remove.
- `getLatestVersion` / `getLatestVersionContent` and a pluggable version
  comparator — both for ADR, whose revisions are integers and whose summary
  is built from the latest revision's content rather than from the entity.
  Neither reinstates the `latestVersion` header pointer ADR 0001 rejected;
  they recompute.

`MongoVersionSplitMigration` / `NitriteVersionSplitMigration` were extracted
when Pattern became the second type to need the fan-out, and are shared by
all seven. Depends on [ADR 0001](0001-versioned-artefact-storage.md) and
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
- `updateHeaderDetails(namespace, resourceId, name, description)` — added
  while porting Architecture, having been missed when this list was first
  derived. Writing a version also *renames* the resource: the old shape
  `$set` the entity's `name` and `description` in the same atomic update
  that wrote the version content, so both version-write paths change the
  display name. Without this operation that behaviour would have been
  dropped silently.

  Two consequences of the split worth stating, because neither is
  reversible by the caller:

  - **It must be called only after the version write succeeds.** Under the
    old shape a rejected create — the version already exists — matched
    nothing and so left the name untouched. Calling it first would rename
    on a request that then fails with a 409.
  - **The old shape's atomicity is genuinely gone.** A failure here reports
    an error for a version that was in fact stored. It is still translated
    and thrown rather than swallowed the way the `versionCount` write is:
    that field is a derived counter whose drift ADR 0001 accepts, whereas
    these are user-supplied values, and dropping a rename silently is a
    wrong answer rather than a display number off by one.

  Note this faithfully preserves a bug: a `null` name overwrites a stored
  one, and `ArchitectureRequest` validates neither field, so a version
  write carrying only `architectureJson` wipes the display name. Preserved
  deliberately — fixing it is a behaviour change, not part of a port.
- `createFirstVersion(namespace, resourceId, content)` — added while porting
  Pattern, when the routine it replaces reached its fourth identical copy.

  It is not a new primitive but `createVersion` plus `deleteHeader` used
  correctly: writing the first version of a just-created resource and, if
  that fails, removing the header again. The split shape makes that
  compensation necessary — the old shape wrote the resource and its first
  version in one document write, so a failure left nothing behind — and
  there is no delete endpoint for any of these types, so a header stranded
  with `versionCount: 0` stays visible in listings and search permanently.

  That is why it belongs here rather than in each store. A per-store copy
  is a correctness routine duplicated once per type per backend, fourteen
  times at full rollout, with nothing to flag a fix applied to one and
  missed in another. It depends on nothing type-specific: the helper
  already knows its own id field, and `INITIAL_VERSION` moved with it.

  The "version already exists" branch looks unreachable and is still
  treated as a failure: the id has just come from the counter, so nothing
  should hold its `1.0.0`. If something does — a rewound counter, a
  restored database — reporting success would return 201 for content that
  was never stored.

### Two supporting classes the helpers own

Both are small, stateless, and shared by the two backends so the shape's
rules can't drift apart between them.

- **`SemanticVersionOrder`** — the comparator `listVersions` sorts with. An
  unsorted Mongo query has no defined order and a plain string sort puts
  `1.10.0` before `1.9.0`, so ordering had to become explicit once versions
  were rows rather than map keys. Deliberately *not* a change to
  `VersionKeySelector`, which keeps parsing dashes for Control — see
  [ADR 0002](0002-version-key-encoding.md). It delegates to the existing
  `Semver` record rather than parsing versions a second time.
- **`CanonicalVersion`** — folds every accepted spelling of a version onto
  one stored form, applied at every helper entry point that takes a version.
  This is the part of [ADR 0002](0002-version-key-encoding.md) that turned
  out to need more than writing a dot instead of a dash.
  `VERSION_REGEX` makes *both* separators optional, so `1.0.0`, `1-0-0`,
  `1.0-0`, `1-0.0`, `1.00` and `100` are six spellings of one version and
  the API accepts all of them. The old shape wrote the version as a map key
  via `replace('.', '-')`, which folded four of the six together and left
  `100` and `1.00` as keys of their own — one logical version already stored
  under three different keys. Storing the version as a *field value* without
  canonicalising would have made each spelling its own document, invisible
  to a read using any of the other five. Neither backend can catch that:
  Mongo's unique index is per stored string, and Nitrite has no index at
  all. Ordering can't fix it either — `SemanticVersionOrder` ranks the
  spellings equally but cannot merge them.

  It reuses `ResourceValidationConstants.VERSION_REGEX` rather than
  restating the pattern, which points from the store layer at the resource
  layer. That coupling is deliberate: the set of spellings to fold is
  exactly the set the API accepts, so a second copy would be a bug waiting
  on the two to drift. Input the regex rejects passes through untouched —
  validation belongs to the resource layer, and a store that rewrote
  unrecognised input would turn a rejectable request into a document stored
  under a version nobody asked for.

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
- Neither helper is deleted, and "retire" means only that the *migrated*
  types stop calling them — an earlier draft of this ADR said both stay
  solely for `MongoControlStore`, which was never accurate. As of
  Architecture: `MongoUpsertPush` still has eight callers (Pattern, ADR,
  Flow, Standard, Interface, Timeline, Decorator, Control), and
  `MongoResourceSlice` has exactly one — `MongoPatternStore` — because it
  only ever served Architecture and Pattern. So `MongoResourceSlice` is
  deletable the moment Pattern migrates, while `MongoUpsertPush` outlives
  the whole redesign: Decorator and Control both keep the old shape
  permanently (ADR 0004).
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
list the way `getArchitectureVersions` used to (its `ArchitectureDoc ==
null` check conflated "namespace has no matching architecture array entry"
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
