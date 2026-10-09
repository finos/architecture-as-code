# ADR 0008: Pattern implementations are found by reading the architecture's `$schema`

**Status**: Proposed and Implemented. The code is written and working:
`GET /calm/namespaces/{ns}/patterns/{name}/versions/{version}/implementations`,
`PatternImplementationStore` and its two backends. The design is still open.
[#2918](https://github.com/finos/architecture-as-code/issues/2918) carries the
`needs-input` label and states that the choice between the three approaches is
for maintainers to weigh. No maintainer has yet agreed the one taken here, so
this is not `Accepted`. Read it as a worked proposal with an implementation
attached, rather than as settled practice.

This ADR changes no storage shape, adds no migration step, and adds no schema
version.

## Context

[#2918](https://github.com/finos/architecture-as-code/issues/2918) asks CalmHub
to answer one question: which architectures implement pattern Y? A pattern
maintainer needs the answer before changing a pattern. A reviewer needs it to
confirm that an architecture derives from an approved pattern.

The data model does not record that relationship. `Architecture` holds
`namespace`, `name`, `description`, `id`, `version` and the raw JSON.
`ArchitectureRequest` accepts no pattern reference on write. Only the document
itself carries a trace. `shared/src/commands/generate/components/instantiate.ts`
sets a generated architecture's `$schema` to the pattern's `$id`.

The issue offers three approaches and chooses none of them:

| | Approach |
|---|---|
| A | Match the stored `$schema` when the query runs |
| B | Store an indexed `sourcePattern` on the architecture, and backfill it |
| C | Infer "implements" by comparing structure |

C is rejected. It turns "implements" into a similarity judgement with no
threshold. A governance tool that invents a dependency is worse than one that
reports none.

The choice is A or B. Four findings decide it.

**B finds no architecture that A misses.** To fill in `sourcePattern` for
architectures already stored, you must read each `$schema` and resolve it. That
is A. B's migration *is* A, run once.

**B's one distinctive capability is one CALM does not want.** A separate field
would let an architecture claim it came from a pattern without claiming it
conforms to one. `$schema` cannot express that, because it is also the
validation target. `shared/src/document-loader/loading-helpers.ts` reads it to
decide what `calm validate -a` checks the architecture against. Splitting the
two would suit an architecture that derives from a pattern and then diverges
under an approved exception. CALM treats a pattern as a contract instead. An
architecture meets that contract or it has left it. The remedy for an approved
divergence is to change the pattern, or to fork it.

Splitting them would also cost more than it returns. Six call sites outside the
hub already read `$schema` to find an architecture's pattern, across `shared`
and `calm-server`. A second field gives two answers to one question, held in
different places, free to disagree. `post-bump-validate.ts` reads `$schema`
precisely to catch an architecture drifting out of conformance. An architecture
recording lineage without conformance would defeat that check by design.

**Neither approach can use an index.** MongoDB refuses an index key whose field
name starts with `$`. This was verified against 4.4.3, which the integration
suite runs, and against 8.0.32:

```
createIndex({"content.$schema": 1})
  → Index key contains an illegal field name: field name starts with '$'
```

A wildcard index on `content.$**` is created without complaint, and gives no
usable plan. `explain()` on that path is itself rejected with
`FieldPath field names may not start with '$'`. Projection fails for the same
reason. Only a query on the field works. B would therefore have to copy the
value onto a differently-named field purely to make it indexable.

**Scan cost does not decide this.** The issue's checklist asks for "scan cost
vs. indexed lookup" as if that settles the question. Measured over 3000
architecture versions of about 40KB each, 115MB in total, a match in the
database took 1.4ms. An indexed lookup on a copied field took 0.6ms. Both are
noise against the request.

Two further points of context.

The issue calls the URL-to-identity mapping "the crux for A and B either way".
It is already solved. `shared/src/hub/document-id-utils.ts` parses this exact
URL shape, and its `validateDocumentId` skips `baseUrl` when it compares.
Matching the path and ignoring the host is established behaviour.

The issue also describes the storage as `versions: {"1-0-0": <blob>}`.
[ADR 0001](0001-versioned-artefact-storage.md) replaced that shape. Each
architecture version is now its own document, with the body under `content`, so
the scan reads bounded documents rather than one namespace-wide document.

## Decision

Answer the query by reading `content.$schema` when the request runs. Add no
domain field, write no migration, change no write path.

**Match the path. Never match the host.** A reference is recognised by its
`/calm/namespaces/{ns}/patterns/{name}/versions/{version}` suffix. A stored
`$schema` carries the base URL the hub served under when the architecture was
generated. Comparing whole URLs would lose every reference as soon as a
deployment moved. Within one hub the path is unambiguous, because the unique
index on `resource_mappings` guarantees that namespace, type and name identify
one resource.

**Pin the match to one pattern version.** The canonical `$id` includes
`/versions/{v}`, so a version-pinned match is what the data gives. "Any version
of this pattern" is a different question, suited to retirement and migration
progress rather than blast radius. It belongs on its own path if anyone wants
it.

**Match the version in every spelling the API accepts.** `VERSION_REGEX` admits
six spellings of one version, from `1.0.0` to `100`, and
`CalmDocumentParser.rewriteId` writes the requested path spelling into `$id`
without canonicalising it. `calm generate` then copies that into the
architecture's `$schema`. Both the stored reference and the incoming request can
therefore use any spelling, and comparing the strings verbatim misses every pair
that disagrees. The database expression is an alternation of the separator
spellings that fold back through `CanonicalVersion` to the requested version. An
optional-separator expression is not equivalent: it matches `1100` for `1.10.0`,
but `CanonicalVersion` reads `1100` as `11.0.0`. The in-memory path folds both
sides through `CanonicalVersion`. The response echoes the canonical form.

**Return 404 when the pattern version does not exist.** Resolving the pattern
name alone is not enough. A request for a version that was never written would
otherwise return an empty list, which reads the same as a version nothing
implements. That is the ambiguity this ADR refuses to ship for the unresolvable
count. It would be worse here, because the response also echoes the requested
version back as though it were real. `getPatternVersions` returns
version strings rather than the pattern body, so the check costs one indexed
read.

**Page only when the caller asks.** The endpoint accepts `limit` and `offset`
through the shared `PaginationQueryParams`, and defaults to
`PageRequest.UNPAGED`. A fixed cap is deliberately not applied.
`SearchStore.MAX_RESULTS_PER_TYPE` caps search at 50 because search returns top
matches and nobody expects completeness. This answers a blast-radius question,
where returning the first 50 of 500 would report a change as safe when it is
not. A caller who wants a bounded response can ask for one. A caller who does
not gets every match.

**Report no count of architectures the hub could not resolve.** An empty list is
ambiguous: it reads the same whether nothing implements the pattern or nothing
in the hub records a pattern at all. A count of unresolvable architectures would
separate the two, and it still does not belong here. An architecture in one
namespace can implement a pattern in another, so the search spans every
namespace the caller can read. Any honest count describes that same set, so it
changes with the caller and never with the pattern. Two different patterns
return the same number to one caller. That makes it a property of the hub, which
a caller can read once and reuse. Computing it on each request roughly doubles
the database work for an answer the caller already holds. Documentation states
the limitation instead, and the write-path warning under Consequences surfaces
it where it is created.

**Match in the database on MongoDB. Match in memory on Nitrite.** MongoDB cannot
project `content.$schema` any more than it can index it, so filtering in the
application means streaming every architecture body across the wire. Measured on
3000 architecture versions of about 40KB each, matching in the database took
1.4ms. Pulling the collection over and filtering it in Java took 63ms and moved
115MB. That gap grows with the collection, because it is a transfer cost rather
than a comparison cost. Nitrite has no such option. It stores content as an
opaque JSON string, and CalmHub creates no Nitrite indexes at all, so it reads
and parses each version. That is this backend's standing cost, not a choice made
here.

**Run the query on demand, and cache nothing.** A request costs four reads
before the scan: the pattern name to its numeric id, that pattern's version
list, the match itself, and one bulk name lookup per namespace in the results.
Only the match scans. Every other read is an indexed point lookup. The scan's
work is proportional to what the caller may see. On MongoDB the namespace filter
that enforces permissions is also the prefix of the existing unique index on
`architectureVersions`. The index therefore selects the caller's namespaces,
and the `$schema` comparison runs over what it returns. Measured on 3000 architecture
versions across 20 namespaces:

| Caller's scope | Plan | Documents examined |
|---|---|---|
| Two namespaces | `IXSCAN` | 300 |
| Every namespace, by public read or `GLOBAL admin` | `COLLSCAN` | 3000 |

The second row is not a missed optimisation. A caller who may see every
namespace has nothing excluded, so every document is in scope by definition.
Sending an explicit list of all 20 namespaces produces an `IXSCAN` over the same
3000 documents. It takes slightly longer, because it walks the index as well. Only an index on the `$schema` comparison itself would change that, and
MongoDB does not allow one.

Both costs grow in proportion to the collection. `CountsService` sets a
precedent for a short TTL cache over an expensive aggregate read, and this query
does not take it. At 1.4ms the cache would buy nothing, and it would add a
staleness window to an answer used for governance. Should a hub grow far enough
for a full-visibility caller to feel it, the remedy is a cache of that shape. It
is not worth building before a real hub shows the need. Callers can already page.

**Scope the matches to the caller's readable namespaces**, through the same
`ReadableScope` resolution that `SearchResource` uses. A caller who may not read
the pattern's own namespace gets 403 from `@PermissionsAllowed`, as on the other
namespace endpoints.

## Consequences

- An architecture is found only when it says so itself. In practice that means
  someone generated it from a pattern fetched from this hub. Generated from a
  pattern file on disk, it carries that file's own `$id`. Written by hand, or
  posted through the numeric API, it carries whatever the author supplied.
  The endpoint matches none of these and reports none of them. An empty list
  therefore does not distinguish "nothing implements this pattern" from
  "nothing here records a pattern at all".
- Ignoring the host means a reference to a *different* hub matches, when the
  namespace, name and version agree. Separating them would need trust in the
  host, and the host is the part that does not survive a move.
- The `$schema` comparison can never use an index. Adding one later means
  copying the value onto a differently-named field, which is B. The namespace
  index narrows the work to the caller's own namespaces. A caller who may read
  everything therefore scans everything, because everything is in their scope.
- **Nothing validates `$schema` on write, on either API.** The name-based API
  checks the architecture's own `$id` and stops there. The numeric API checks
  nothing. The hub therefore accepts an architecture whose `$schema` names a
  pattern that does not resolve, and this endpoint is the first thing to notice.
  A warning on the write path is tracked separately. It changes two write paths
  rather than this query, and it can only improve data written after it ships.
- How useful this is on the first day depends on how much of a real hub's
  content carries a resolvable `$schema`. Nobody has measured that. If the
  fraction is small, the remedy is the write-path warning above and not B. B
  would backfill from the same `$schema` values, so it would find the same
  architectures.
- **GitHub storage mode has no implementation of this lookup.** The lookup finds
  architectures whose `$schema` holds a hub pattern address. GitHub mode is
  read-only, so this hub writes no architecture there. Its files are authored in
  the repository, and its pattern versions are commit SHAs, which
  `VERSION_REGEX` rejects on this path. How many GitHub-mode architectures carry
  such an address anyway has not been measured.
  A scan of every architecture file per request is not worth building on that
  unknown. A semver request returns 404, because GitHub mode has no semver
  version, and a SHA returns 400. The store behind the endpoint returns 501, as
  GitHub-mode writes do, should a request ever reach it.
