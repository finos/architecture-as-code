# ADR 0017: Reserved decorator types and decorator history

**Status**: Proposed. Not built. It needs the write seam in
[ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md).

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

**Check against a known Standard.** When a decorator's `$schema` is a Standard
that Hub holds, Hub checks the decorator against it before the write and returns
400 if it is not valid. The check goes through the `ArchitectureValidator`, so
Hub holds no schema rules
([#2716](https://github.com/finos/architecture-as-code/issues/2716)). A decorator
with an unknown `$schema` is accepted as today.

**Reserved types are append-only.** Hub rejects an update of a reserved-type
decorator with 409. A writer creates a new decorator, and Hub records
`supersedes` with the id of the old one. Hub stores `supersedes` beside the
decorator, not in the decorator document or in `data`, so the document stays
valid against its Standard and a writer cannot set it. A list returns only the
current decorators, unless the caller asks for history. Only GLOBAL_ADMIN can
delete a reserved-type decorator.

## Consequences

- Validation and control evaluations are trusted by type, not by the caller's
  claim.
- A write of a decorator with a known Standard needs calm-server. If calm-server
  is not available, the write fails.
- Reserved-type decorators grow without limit. Retention is a later decision.
- Decorator storage needs a Hub-owned field. This is the first part of the
  decorator design that ADR 0004 deferred.
