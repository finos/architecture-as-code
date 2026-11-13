# ADR 0019: Decorator storage — one document per decorator

**Status**: Proposed. Implemented for MongoDB in a draft PR. NitriteDB is not changed yet.

## Context

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

`target` on the decorator stays the only record of what a decorator applies to. We do not
keep a list of decorator IDs on the architecture (option A in #3696), because each decorator
write would then also have to update each target architecture, and the two could get out of
step.

The REST API does not change.

## Consequences

- `MongoDecoratorSplitStep` (schema version 16 → 17) migrates existing data at startup.
  It drops the old unique `namespace_1` index, which `MongoIndexInitializationStep` creates.
- **No downgrade.** An older CALM Hub reads the first decorator document as if it were the
  namespace document. Back up the `decorators` collection before the upgrade.
- If a namespace has two decorators with the same ID, the step fails. CALM Hub then refuses
  requests until an operator removes the duplicate and clears the migration lock.
- Entries without an integer ID or a `decorator` object were never returned by the API. The
  step keeps them in `decoratorsUnmigrated` and does not delete them.
- `init-mongo.js` seeds the new shape and pins schema version 17.
- NitriteDB still uses the old shape. It needs its own step and store change.
