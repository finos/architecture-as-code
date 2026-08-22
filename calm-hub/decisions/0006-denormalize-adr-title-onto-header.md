# ADR 0006: Denormalize ADR title onto the header

**Status**: Implemented.

## Context

[#2946](https://github.com/finos/architecture-as-code/issues/2946) (split out of
review on [#2935](https://github.com/finos/architecture-as-code/pull/2935), parent
redesign [#2884](https://github.com/finos/architecture-as-code/issues/2884)):
`MongoSearchStore`/`NitriteSearchStore`'s `searchAdrCollection` resolves the latest
revision's title for every ADR header it scans — `1 + 2N` round trips for `N` headers
scanned, uncapped until 50 *matches* are found (the cap doesn't bound headers scanned).
On Nitrite it's worse: 2 lock acquisitions and 2 unindexed full-collection scans per
header, since Nitrite creates no indexes at all.

ADR is the only versioned type this happens to, because it's the only one whose header
carries no denormalized display field. Every other type — Architecture, Pattern, Flow,
Standard, Interface, Timeline — writes its `name`/`description` onto the header via
`{Mongo,Nitrite}VersionDocumentStore#updateHeaderDetails`/`updatePresentHeaderDetails`
on every version write (e.g. `MongoArchitectureStore.java:156`,
`MongoPatternStore.java:146`), so their search path reads the header alone, in one
query. ADR's header is created with `createHeader(namespace, id, null, null)` and never
updated again — its title has only ever lived in the revision content.

[ADR 0001](0001-versioned-artefact-storage.md) rejected a `latestVersion` pointer on the
header: "a cached pointer would be one more place for staleness bugs with no current
consumer." That same ADR, in the same section, later **reversed** an equivalent
rejection for `versionCount` once a real consumer existed — `calm-hub-ui`'s
`ItemCard.tsx` reads it on every namespace listing page view — reasoning that reads
vastly outnumber writes for that field. ADR title now has exactly that shape of
consumer: search, at scale, versus a title write only on ADR creation or a subsequent
revision. This ADR follows 0001's own precedent rather than reopening its `latestVersion`
rejection: it denormalizes a resolved *value* (the title string), not a pointer into the
version collection, and only for ADR — the one type actually missing it.

Four options were on the table (batch the version reads; cache with a TTL like
`CountsService`'s; revisit 0001's rejection generically; or this one). Batching was the
issue's leading suggestion, but denormalizing turned out simpler once it was clear ADR
was the outlier rather than the norm: it needed no new query shape, no second read path,
and made ADR consistent with six of seven sibling types instead of adding a new kind of
read exclusively for it. A `CountsService`-style TTL cache was rejected for the same
reason 0001's own writeup gives when discussing that pattern: it does nothing for a cold
cache and adds a staleness window that denormalizing-at-write-time avoids outright.

## Decision

`MongoAdrStore`/`NitriteAdrStore` write a denormalized copy of the title onto the ADR
header on every write:

- **First version** (`createAdrForNamespace`): resolves the title from
  `adrMeta.getAdr().getTitle()`, falling back to the literal `"Untitled ADR"` when it's
  null/blank, and passes that directly into `createHeader(...)`. There is no existing
  header title a blank one could "leave standing," so a first version needs its own
  placeholder rather than reusing `updatePresentHeaderDetails`'s no-op-on-blank behaviour.
- **Later revisions** (`writeRevision`, shared by `updateAdrForNamespace` and
  `updateAdrStatus`): calls `documentStore.updatePresentHeaderDetails(namespace, id,
  adrMeta.getAdr().getTitle(), null)` after the version write succeeds — the existing
  helper already no-ops on a null/blank title, so a revision that omits one leaves the
  header's current title standing rather than overwriting it with a placeholder.

A one-time migration step per backend (`MongoAdrTitleBackfillStep`,
`NitriteAdrTitleBackfillStep`, schema version 10 → 11) backfills every pre-existing ADR
header with no title: resolves it from the latest revision, same `"Untitled ADR"`
fallback if the revision has none or can't be read.

`searchAdrCollection` on both backends now reads `header.getString("name")` directly,
falling back to `"ADR " + adrId"` only for a header that predates both the write-path
change and the backfill (there should be none after the migration runs, but the search
path stays defensive rather than assuming it). This is now structurally identical to
`searchHeaderCollection` — one query, no version-collection reads, no lock contention on
Nitrite's `adrVersions` collection at all.

`NamespaceAdrSummary`/`toAdrSummary` (the `getAdrsForNamespace` listing) is **not**
changed — it still resolves `status` from the latest revision, which isn't denormalized
by this ADR (out of scope: nothing in #2946 needs `status` off the header). Only `title`
moves.

## Consequences

- Creating a version is no longer a single write for ADR either — same trade-off ADR
  0001 already accepted for `versionCount`: a crash between the version write and the
  header title update leaves the header's title stale until the next successful
  revision write. Blast radius is a display string, not lost or corrupted content.
- `MongoSearchStore`/`NitriteSearchStore` no longer construct a second
  `{Mongo,Nitrite}VersionDocumentStore` over `adrs`/`adrVersions` at all — the Nitrite
  class javadoc's "read-only, do not add a write path through this field" caveat about
  that second instance no longer applies, because the field is gone.
- Existing deployments need the schema-version-11 backfill to run once before every ADR
  header has a title; until then, search still functions correctly via the `"ADR "
  + adrId"` fallback for any header the backfill hasn't reached yet.
- `calm-hub/mongo/init-mongo.js`'s ADR seed entries now carry a top-level `name` field
  (mirroring what every other seeded type already does), and
  `LATEST_SCHEMA_VERSION` is bumped to 11 so a fresh seed declares the backfill already
  applied — consistent with ADR 0001's "why this matters" note on keeping the seed
  script's declared version in step with new migration steps.
