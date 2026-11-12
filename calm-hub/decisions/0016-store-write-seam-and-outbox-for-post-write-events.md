# ADR 0016: Store write seam and outbox for post-write events

**Status**: Proposed. Not built. Hub has no domain events today.

## Context

Async validation ([ADR 0015](0015-architecture-validation-is-a-hub-feature-behind-an-spi.md))
and the `event-subscriber` extension point
([#3396](https://github.com/finos/architecture-as-code/issues/3396)) must see
every write, whatever the channel.

Facts in the code:

- Many callers write directly to the stores: REST resources, MCP tools
  (`ArchitectureTools`, `PatternTools`, `DecoratorTools`), the name-based mapping
  service, promotion and `StandaloneDemoSeeder`. A JAX-RS filter sees only REST.
- Each store bean comes from a producer in `store/producer/`, which selects the
  MongoDB, NitriteDB or GitHub implementation. A CDI `@Decorator` does not apply
  to a bean from a producer method. A spike `@QuarkusTest` in calm-hub confirmed
  this in ArC: the same `@Decorator` applied to a class bean and not to a
  producer bean.
- Hub uses no MongoDB transactions. The compose files run MongoDB with no replica
  set, so transactions and change streams are not available.
- A version document in MongoDB and in NitriteDB has a `metadata` field that is
  empty on insert and kept on upsert.
- Hub already uses `quarkus-scheduler`.

## Decision

**Wrap the stores in the producers.** Each writable producer returns an
`ObservedXStore` that implements the store interface and wraps the selected
implementation. The order is:

1. Before: `warn` and `deny` validators, when they exist, and the decorator
   rules in [ADR 0017](0017-reserved-decorator-types-and-decorator-history.md).
   For a write that does not create or overwrite a version, write a `prepared`
   outbox entry.
2. The delegate write.
3. After: mark the outbox entry `ready`.

A request-scoped `WriteContext` holds the actor, the channel (REST, MCP, mapping,
seed), the dry-run flag and the pending event. Store signatures do not change.
Data that must be in the same write as the document is below the wrapper: the
version-document helpers read the pending event from `WriteContext`, and the
decorator store reads `supersedes`
([ADR 0017](0017-reserved-decorator-types-and-decorator-history.md)) from it. Seed and migration
writes run as the system actor and skip the hooks. Hub's own decorator writes,
for example `validation` results, skip the checks in ADR 0017, but Hub records
an outbox entry for them, so subscribers see them.

**Outbox.**

- For a new version, the version-document helpers write
  `metadata.hooks.pending` from `WriteContext` in the same insert as the version
  document, so the event and the data commit together. A PUT overwrite
  (`allow.put.operations`) sets it in the same update as `content`, with a
  `version.updated` event.
- For decorators and deletes, Hub writes the outbox entry before the write, as
  above.
- A `@Scheduled` relay claims `ready` and pending entries with a lease, delivers
  them, then removes them. When a `prepared` entry is older than the lease, the
  write may not have happened. The relay checks the store (the decorator
  exists, or the resource is gone), then delivers the entry or drops it.
- A reconcile sweep finds versions that have at least one rule source and no
  validation result for their content hash, and adds them again. It also
  retries `validator-error` results, with an exponential backoff up to a limit.
- The relay and the sweep do not run when `calm.readonly=true`, because the
  database is read-only.
- MongoDB and NitriteDB use the same `metadata` field, outbox collection and
  sweep.

**Delivery.** At least once, with a stable event id. Order is kept only for one
resource in one namespace. More than one Hub replica needs the lease.

**Event format.** Events are thin and shaped as CloudEvents: `id` is the event
id, `type` is for example `org.finos.calm.hub.architecture.version.created`, and
`subject` is the version URL. `data` holds the namespace, resource id, version,
actor, channel and content SHA-256. It does not hold the document. Delivery over
HTTP is signed as Standard Webhooks specifies. A subscriber that needs the
document reads it with its own Hub grant
([ADR 0010](0010-extension-identity-is-a-hub-signed-assertion.md)).

**GitHub mode.** Writes return 501, so there are no write events. The sync job
emits one "synced" event for each commit.

## Consequences

- REST, MCP, the mapping API and promotion all pass through one seam. A new store
  method is a compile error in the wrapper until the wrapper handles it.
- The audit gap for MCP writes can close in the same wrapper, in a later change.
- Consumers must be idempotent, because the relay can deliver an event more than
  once.
- An event can arrive seconds after the write. Nothing in Hub depends on it
  arriving in the same request.
