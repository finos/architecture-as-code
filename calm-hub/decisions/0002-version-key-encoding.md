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
- The version-comparison logic in `VersionKeySelector.latestVersionKey()`
  (currently splitting on `"-"`) needs to split on `"."` instead, or be
  made separator-agnostic if any transitional dash-encoded data must still
  be read (see migration note below).
- **Migration cost**: the `SchemaMigrationStep` that fans out old
  documents into new version documents (ADR 0001) must convert each dash
  key to dot form during the fan-out (`"1-0-0".replace('-', '.')`) —
  trivial, one-time, contained entirely within that migration step. No
  ongoing dual-format handling is needed once migration has run, since
  CalmHub's rollback story (ADR 0001) is backup-based rather than
  additive/dual-write.
