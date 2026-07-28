# ADR 0002: Version field encoding — dots, not dashes

**Status**: Proposed — not yet implemented. Depends on
[ADR 0001](0001-versioned-artefact-storage.md).

## Context

In the current (pre-redesign) shape, each versioned entity document embeds
a `versions` map keyed by version string, e.g.
`versions: { "1-0-0": { ...content } }`. Mongo field names cannot contain
`.`, so every store dash-encodes the version before using it as a map key
and reverses the encoding on read — e.g. `MongoStandardStore`,
`MongoInterfaceStore`, and `MongoControlStore` all call
`version.replace('.', '-')` on write and the inverse on read.

The REST API's canonical external representation is dot-separated
(`"1.0.0"`); `ResourceValidationConstants.VERSION_REGEX` already accepts
both `.` and `-` as separators (`^(0|[1-9][0-9]*)[-.]?...`), so callers can
technically pass either today, but dashes only exist internally because of
the Mongo map-key constraint — they are not a deliberate domain choice.

ADR 0001 moves `version` from being a map *key* to being a document
*field value* (one document per `(namespace, resourceId, version)` tuple in
the new `<type>Versions` collections). The "no `.` in Mongo field names"
constraint that motivated dash-encoding no longer applies once version is a
field value rather than a key name.

## Decision

Store the `version` field using the **dot-separated canonical form**
(`"1.0.0"`), matching the API's external representation. Delete the
`replace('.', '-')` / `replace('-', '.')` round-trip entirely — it becomes
dead code once no store uses version as a map key.

## Consequences

- Removes a whole class of conversion bugs (forgetting one direction of the
  replace, or double-converting) across all 7 versioned stores.
- Simplifies every store: no encode-on-write/decode-on-read step, and the
  field value handed to Mongo queries is the same string the API received.
- **`VersionKeySelector` needs no change at all** — neither a switch to
  `"."` nor a separator-agnostic rewrite, both of which an earlier draft of
  this ADR called for. Its two methods turn out to have completely disjoint
  callers:
  - `latestVersionKey()` — the only separator-sensitive part (it splits on
    `"-"`) — is called **only** by `MongoControlStore` and
    `NitriteControlStore`. Control deliberately keeps the old shape and its
    dash-encoded keys (see
    [ADR 0004](0004-defer-control-and-decorator-storage.md)), so this method
    must be **left alone**: "fixing" it to split on `"."` would break the
    one thing still using it. It retires with Control, whenever that's
    redesigned.
  - `versionCount()` is called by the migrating types
    (Architecture/Pattern/Flow/Standard, both backends) and **never parses
    separators** — it is just `keys.size()`. Those call sites disappear as
    each type migrates, because `versionCount` becomes a stored field on the
    header (ADR 0001). Once Control is the only caller left of the class,
    `versionCount()` has none and can be deleted.
  - Ordering versions in the new shape is therefore **new code alongside**,
    not a modification or a fork of this class — nothing that parses `"-"`
    is used by a migrating type, and nothing a migrating type uses cares
    about the separator.
- **Migration cost**: the `SchemaMigrationStep` that fans out old
  documents into new version documents (ADR 0001) must convert each dash
  key to dot form during the fan-out (`"1-0-0".replace('-', '.')`) —
  trivial, one-time, contained entirely within that migration step.
- Dash-encoded keys do **not** disappear from the database entirely — the
  `controls` collection keeps them for as long as Control keeps the old
  shape (ADR 0004). What this ADR removes is any *shared* code path having
  to handle both formats: dot-separated keys live in the new
  `<type>Versions` collections read by the new helper, dash-encoded keys
  live in `controls` read by `MongoControlStore`/`NitriteControlStore`, and
  the two never meet.
