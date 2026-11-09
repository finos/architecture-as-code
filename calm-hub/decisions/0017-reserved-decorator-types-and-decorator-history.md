# ADR 0017: Reserved decorator types and decorator history

**Status**: Proposed. Not built. It needs the write seam in
[ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md) and one
document per decorator in each store.

## Context

Some decorators are evidence: `validation` results
([ADR 0015](0015-architecture-validation-is-a-hub-feature-behind-an-spi.md)) and
`control-evaluation` results from a policy engine. A reader must trust who wrote
them and see how they changed.

Facts in the code:

- `DecoratorResource` and the MCP `DecoratorTools` accept a decorator of any type
  from a caller with WRITE scope.
- `updateDecorator` edits a decorator in place. Hub keeps no history
  ([ADR 0004](0004-defer-control-and-decorator-storage.md)).
- Hub does not check a decorator against the Standard in its `$schema`.
- Hub seeds the calm-schema decorator Standards, for example control-evaluation.

## Decision

**Reserved types.** Hub keeps a map of decorator type to allowed writers.
`validation` maps to `system`, and the operator cannot change this. The operator
adds other types, for example `control-evaluation` to the policy engine's
service account ([ADR 0010](0010-extension-identity-is-a-hub-signed-assertion.md)).
The ADR 0016 wrapper enforces the map for REST and MCP and returns 403 to any
other writer. A type that is not in the map keeps today's rule.

`system` is a flag in `WriteContext` that only Hub code sets. It is not a
principal name, so a caller named `system` (for example through the
`proxy-auth` header) is not Hub. When auth is off (`no-auth`), all callers have
one principal and Hub cannot tell them apart. Then a type that maps to a service
account accepts any writer, and `validation` stays Hub-only.

**Check against a known Standard.** When a validator is configured and a
decorator's `$schema` is a Standard that Hub holds, Hub checks the decorator
against it before the write and returns 400 if it is not valid. The check goes
through the `ArchitectureValidator`, with the calm-server schema-only mode in
ADR 0015, so Hub holds no schema rules
([#2716](https://github.com/finos/architecture-as-code/issues/2716)). If the
validator call fails, Hub rejects a reserved type with 503 and accepts other
types as today. With no validator, or with an unknown `$schema`, Hub accepts the
decorator as today.

**Hub's own writes skip these checks**
([ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md)). Thus
Hub can record a `validator-error` result when calm-server is not available.

**Reserved types are append-only.** An update replaces the whole decorator, so Hub
checks both the stored type and the new type, and rejects the update with 409 if
either is reserved. A writer creates a new decorator. Each type in the map has a
key in `data`, of one or more fields: `source.id` for `validation`, and
`control.unique-id`, `control.attached-to` and `change.commit` for
`control-evaluation`. The same control key can be on many elements, and each
change has its own result, as the Standard says. A missing field is a value of
its own. The operator sets the key for each type that it adds. A
new decorator supersedes the current decorator with the same type, target and
key value, and Hub records `supersedes` with the id of the old one. Hub stores
`supersedes` beside the decorator, not in the decorator document or in `data`,
so the document stays valid against its Standard and a writer cannot set it.
Hub has no transactions, so two writers can supersede the same decorator. The
current decorator for a key is the one with the highest id, because decorator ids
come from one counter. `supersedes` records what the writer saw, and reads do not
depend on it. A list returns only the current decorators, unless the caller asks
for history. Only GLOBAL_ADMIN can delete a reserved-type decorator.

**One document per decorator first.** Today MongoDB and NitriteDB keep all the
decorators of a namespace in one document. With history, that document reaches
the MongoDB 16 MB limit
([ADR 0001](0001-versioned-artefact-storage.md)), and then every decorator write
in the namespace fails. Before reserved types ship, both stores keep one
document for each decorator. MongoDB moves with a new `SchemaMigrationStep` and
the same change to `init-mongo.js`.

## Consequences

- Validation and control evaluations are trusted by type, not by the caller's
  claim.
- Only a reserved-type write needs the validator. If it is configured and not
  available, that write fails with 503. Other writes, and Hub's own writes, do
  not need it.
- Reserved-type decorators grow without limit. Retention is a later decision.
  With one document per decorator, growth does not block writes.
- Decorator storage changes shape and needs a Hub-owned field. This is the
  first part of the decorator design that ADR 0004 deferred.
