# ADR 0020: Decorator storage — one document per decorator

**Status**: Implemented for MongoDB and NitriteDB.

## Context

[#3639](https://github.com/finos/architecture-as-code/issues/3639) and
[#3696](https://github.com/finos/architecture-as-code/issues/3696). All decorators of a
namespace are in one document, as an array. Each read loads the full array and filters it in
Java, also `getDecoratorById`. A request for one architecture's decorators costs O(N·T) and
transfers all N decorators. The document has no size limit other than the 16MB MongoDB limit.

[ADR 0004](0004-defer-control-and-decorator-storage.md) deferred this design because
decorators are not versioned and did not have the growth problem of ADR 0001.

## Decision

Store one document per decorator. Copy `type` and `target` to the top level, and index them:

| Index | Purpose |
|---|---|
| `(namespace, decoratorId)` unique | `getDecoratorById`, update, delete |
| `(namespace, target, type)` | Filtered reads. `target` is an array, so this is a multikey index |
| `(namespace, supersedes)` unique, partial | The supersede lock: a decorator has at most one successor |

`target` on the decorator stays the only record of what a decorator applies to. We do not
keep a list of decorator IDs on the architecture (option A in #3696), because each decorator
write would then also have to update each target architecture, and the two could get out of
step.

The REST API does not change.

The history fields of [ADR 0017](0017-reserved-decorator-types-and-decorator-history.md)
(`supersedes`, `supersededBy` and the Hub-set times) move to the top level of each document.
A list filters out superseded decorators in the query. History and delete follow the links with
one indexed find for each decorator. We do not use `$graphLookup`, because it puts the full
history in one result document, which fails when the history is larger than 16 MB.

A supersede is now two writes, because a standalone MongoDB has no transactions. Hub inserts the
successor first, then marks the old decorator. The unique `(namespace, supersedes)` index is the
lock, so two concurrent supersedes of one decorator cannot both succeed. If Hub stops between the
two writes, both decorators stay current, and a delete of the successor removes both. A
`supersededBy` that points to no decorator can then come only from a failed delete, so a delete
accepts such a decorator as current and removes what is left of its history.

## Consequences

- `MongoDecoratorSplitStep` (schema version 17 → 18) migrates existing data at startup.
  It drops the old unique `namespace_1` index, which `MongoIndexInitializationStep` creates.
- **No downgrade.** An older CALM Hub reads the first decorator document as if it were the
  namespace document. Back up the `decorators` collection before the upgrade.
- If a namespace has two decorators with the same ID, the step fails. CALM Hub then refuses
  requests until an operator removes the duplicate and clears the migration lock.
- Entries without an integer ID or a `decorator` object were never returned by the API. The
  step keeps them in `decoratorsUnmigrated` and does not delete them.
- The 16 MB limit now applies to one decorator, not to a namespace.
- `init-mongo.js` seeds the new shape and pins schema version 18.
- `NitriteDecoratorSplitStep` does the same split for NitriteDB, with the same rules, so the
  two stores keep the same shape. Nitrite has no indexes here, so it filters by target in memory.
  Nitrite writes hold one lock, and a supersede writes in the same order as MongoDB.
  Read-only images are seeded at build time, so they get the new shape when they are rebuilt.
