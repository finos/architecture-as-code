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
  to a bean from a producer method. (Confirm this against the CDI specification
  before the ADR is accepted.)
- Hub uses no MongoDB transactions. The compose files run MongoDB with no replica
  set, so transactions and change streams are not available.
- A version document has a `metadata` field that is empty on insert and kept on
  upsert.
- Hub already uses `quarkus-scheduler`.

## Decision

**Wrap the stores in the producers.** Each writable producer returns an
`ObservedXStore` that implements the store interface and wraps the selected
implementation. The order is:

1. Before: `warn` and `deny` validators, when they exist, and the decorator trust
   rule.
2. The delegate write.
3. After: record the outbox entry.

A request-scoped `WriteContext` holds the actor, the channel (REST, MCP, mapping,
seed) and the dry-run flag. Store signatures do not change. Seed and migration
writes run as the system actor and skip the hooks.

**Outbox.**

- For a new version, Hub writes `metadata.hooks.pending` in the same insert as
  the version document, so the event and the data commit together.
- For decorators and deletes, Hub writes to an outbox collection.
- A `@Scheduled` relay claims pending entries with a lease, delivers them, then
  removes them.
- A reconcile sweep finds versions with no validation result for their content
  hash and adds them again.
- NitriteDB uses an outbox collection and the same sweep.

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
- Whether NitriteDB version documents have a `metadata` field is not checked.
  If they do not, NitriteDB uses only the outbox collection.
