# ADR 0017: Reserved decorator types and decorator history

**Status**: Accepted, partly built. Built (#3703, #3716): reserved types with
configured writers, the Standard check, append-only reserved types with
`supersedes` history, and Hub-set timestamps. Not built: the `validation` type,
the `system` flag, supersede by key, and one document per decorator
([#3639](https://github.com/finos/architecture-as-code/issues/3639)). The
`system` flag needs the write seam in
[ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md).

## Context

Some decorators are evidence: `validation` results
([ADR 0015](0015-architecture-validation-is-a-hub-feature-behind-an-spi.md)) and
`control-evaluation` results from a policy engine. A reader must trust who wrote
them and see how they changed.

## Built

`DecoratorWriteService` applies these rules above the store, for REST and MCP.

- **Reserved types.** `calm.decorators.reserved."<type>".writers` lists the
  principal names that may write a type. Any other writer gets 403. A type that
  is not listed keeps the rule that WRITE scope is enough. With `no-auth`, every
  caller is one principal, so a type that lists that principal accepts any writer.
- **Standard check.** When the `$schema` of a decorator is a Standard that Hub
  bundles, Hub checks the decorator with vertx-json-schema before the write and
  returns 400 if it is not valid. Hub accepts a decorator with an unknown
  `$schema` as before. There is no calm-server call.
- **Append-only.** Hub checks the writer for both the stored type and the new
  type. When either is reserved, a `PUT` stores a new decorator that supersedes
  the one it names, and gives 201. The current decorator is the end of the
  `supersedes` chain. A `PUT` on a decorator that is already superseded gives 409,
  also when another write wins the race. Hub stores `supersedes` beside the
  decorator, so the document stays valid against its Standard and a writer
  cannot set it. A list returns only current decorators. The history endpoint
  returns the chain. Only GLOBAL_ADMIN can delete, and a delete removes the
  whole history.
- **Hub-set times.** Hub sets the decorator timestamps, and rejects a client that
  sends them.
- **Size.** MongoDB and NitriteDB keep all decorators of a namespace in one
  document. A write that would pass 16 MB gives 413.

## Decision (not built)

**`validation` is a reserved type that only Hub writes.** `system` is a flag in
`WriteContext` that only Hub code sets. It is not a principal name, so a caller
named `system` (for example through the `proxy-auth` header) is not Hub.
`validation` maps to `system`, and the operator cannot change this. Hub's own
writes skip the writer check and the Standard check
([ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md)), so Hub
can record a `validator-error` result when calm-server is not available. They
still go through the outbox.

**Supersede by key.** Today the writer names the decorator to supersede. For
a type that Hub writes, Hub finds the current decorator itself. Each type has a
key in `data`, of one or more fields: `source.id` for `validation`, and
`control.unique-id`, `control.attached-to` and `change.commit` for
`control-evaluation`. The same control key can be on many elements, and each
change has its own result, as the Standard says. A missing field is a value of
its own. The operator sets the key for each type that it adds. A new decorator
supersedes the current decorator with the same type, target and key value.
Hub has no transactions, so two writers can supersede the same decorator. The
current decorator for a key is then the one with the highest id, because
decorator ids come from one counter.

**One document per decorator.** With a reserved type that grows without limit,
the namespace document reaches the MongoDB 16 MB limit
([ADR 0001](0001-versioned-artefact-storage.md)), and then every decorator write
in the namespace fails. Before `validation` ships, both stores keep one document
for each decorator. MongoDB moves with a new `SchemaMigrationStep` and the same
change to `init-mongo.js`. Tracked in
[#3639](https://github.com/finos/architecture-as-code/issues/3639).

## Consequences

- Validation and control evaluations are trusted by type, not by the caller's
  claim.
- Reserved-type decorators grow without limit. Retention is a later decision.
  Until #3639, the 16 MB limit stops writes to the namespace.
- The `system` flag and supersede by key need the write seam in ADR 0016.
