# ADR 0005: Layout is a Hub-internal shape, not a CALM schema

**Status**: Implemented.

## Context

The shared, default-layout-persistence feature (saving where an
architecture's nodes are drawn in the CALM Hub visualiser) was originally
built alongside three new files under the community-governed CALM spec
tree:

- `calm/draft/2026-03/meta/layout.json`
- `calm/draft/2026-03/meta/calm-layout.json`
- `calm/draft/2026-03/prototype/layout/fluxnova-microservices.layout.json`

Anything added under `calm/` requires a Schema Change Proposal issue and
approval from the `calm-schema-governance` team (`calm/AGENTS.md`,
`calm/README.md`, enforced by `.github/CODEOWNERS:3` —
`/calm/ @finos/calm-schema-governance`). These files bypassed that review.

Worse, they were not inert once merged. Four separate directory-glob
mechanisms pick up everything under `calm/draft/<version>/meta/` with no
allow-list — the Mongo and Nitrite seed scripts, the read-only Docker
image build, CLI/calm-server/VS Code bundling via
`shared/src/document-loader`, and `.github/workflows/s3-sync.yml` on push
to `main` — so the layout shape would have been silently treated as a
real, published CALM document type without anyone having decided that it
should be one.

Nothing in the running system actually needed the schema to exist.
`LayoutStore` and `LayoutResource` already treat the layout body as an
opaque JSON string, the same convention used for `Timeline`,
`ArchitectureRequest`, and `DecoratorStore`. The frontend never writes a
`$schema` field into a saved layout. The repo's established pattern for a
Hub-only shape that has no external consumer is a plain TypeScript
interface plus a Java domain class with Javadoc and no JSON Schema file at
all — see `UserAccess`, `AuditLogEntry`, and `NamespaceCounts`.
`calm-hub-ui/src/model/layout.ts`'s `CalmLayout`/`CalmLayoutPin` already is
that artifact; it didn't need a schema alongside it.

The `for` field is also a useful illustration of the churn a half-adopted
schema causes: across the three deleted files and the actual Hub code, it
meant three different things — a spec-relative document reference in the
schema, a repo file path in the prototype example, and a Hub API path
(`/api/calm/namespaces/{namespace}/architectures/{architectureId}`) in
`LayoutResource`'s real validation logic. There was never a single,
portable definition of what `for` pointed to; only the Hub's own
behaviour ever gave it concrete meaning.

## Decision

Drop the JSON Schema entirely. The layout shape is documented solely by
`CalmLayout` (`calm-hub-ui/src/model/layout.ts`) on the frontend and by
Javadoc on `LayoutStore`/`LayoutResource` on the backend — no schema file,
draft or otherwise, under `calm/`.

This matches the existing Hub-internal-shape convention already used for
`UserAccess`, `AuditLogEntry`, and `NamespaceCounts`: a TypeScript
interface and a Java domain type are the source of truth, kept in sync by
convention and by the tests that exercise the save/load round trip, not by
schema validation.

## Consequences

- `calm/draft/2026-03/meta/layout.json`, `calm/draft/2026-03/meta/calm-layout.json`,
  and `calm/draft/2026-03/prototype/layout/fluxnova-microservices.layout.json`
  are removed. `calm/draft/2026-03/prototype/` had no other contents and is
  now empty.
- The layout body remains an opaque JSON string at the store layer, as it
  was before this ADR — this is a documentation and file-removal change
  only, not a runtime behaviour change.
- If the layout shape is ever meant to become a real, portable CALM
  document type — consumable outside the Hub, with a stable `for`
  semantics — that requires a fresh Schema Change Proposal and
  `calm-schema-governance` review, not a re-add of the deleted files.
- `TestLayoutResourceShould`'s `VALID_LAYOUT_JSON` fixture no longer
  carries a `$schema` field; the Hub never read or required one.
