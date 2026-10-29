# ADR 0015: Architecture validation is a Hub feature behind an SPI, recorded async first

**Status**: Proposed. Not built. It needs the write seam in
[ADR 0016](0016-store-write-seam-and-outbox-for-post-write-events.md) and changes
to calm-server.

## Context

[#3396](https://github.com/finos/architecture-as-code/issues/3396) proposes a
`validator` extension point: Hub calls it before a write, and it can reject the
write. [#3399](https://github.com/finos/architecture-as-code/issues/3399) needs
validation: a namespace binds standards-only Patterns (SOPs), Hub validates each
architecture version against them through calm-server
([#2716](https://github.com/finos/architecture-as-code/issues/2716)), and Hub
records the results as `validation` decorators.

If the first delivery is an extension, Hub's own governance goes through a
manifest, the proxy and an assertion. An operator-installed extension then joins
the governance trust base. Binding resolution, pinned versions, severity mapping
and the trust rule must stay in Hub in any case. Kubernetes reached the same
point: ValidatingAdmissionPolicy is an in-process alternative to admission
webhooks, with policy and binding as separate objects.

Facts in the code:

- calm-server returns 400 when an architecture's `$schema` is not the Pattern's
  `$id`. An SOP is never the `$schema`.
- calm-server fetches each `$ref` itself, only from allowed hosts. A request
  cannot carry documents that Hub has already resolved.
- calm-server allows 100 requests per IP per 15 minutes by default. Hub is one
  client.
- With `allow.put.operations=true`, a PUT overwrites a version, and promotion
  deletes snapshot versions. Versions are not always immutable.
- `DecoratorResource` and the MCP `DecoratorTools` accept a decorator of any type
  from a caller with WRITE scope.
- `decorators.json` in calm-schema 1.3.0 requires at least one `applies-to` item.
  A pass, or an issue on the whole document, has no element id.

## Decision

**One internal interface.** `ArchitectureValidator` takes a request and returns a
result. `CalmServerValidator` is the default implementation. A manifest-declared
`validator` extension becomes a second implementation later, through the proxy.
The interface holds no validation rules, so #2716's rejection of validation in
Java still holds.

**Contract.**

| Part | Content |
|---|---|
| Request | `hubApi`, a request id, `dryRun`, the subject (kind, URL, content SHA-256, document), and a list of rule sources (id, version, role `schema` or `sop`, binding, document), with all referenced documents resolved by Hub |
| Result | One result for each source, with `status` of `pass`, `fail` or `error`, and issues with `severity`, `code`, `message`, JSON `path` and an optional element `unique-id` |

A validator must have no side effects, so Hub can call it for dry runs and for
revalidation.

**Record asynchronously first.** Hub validates after the write, through the
outbox in ADR 0016. A binding change starts a background revalidation of the
versions it affects. In GitHub mode Hub validates after each sync and keeps
results in memory.

**Severity and enforcement are separate.** The binding's `level` (`mandatory` or
`recommended`) sets severity. A new binding field, `action`, sets enforcement:
`record`, `warn` or `deny`. Only `record` ships first. A later `deny` runs the
validator before the version is created, with a short timeout, and fails closed.
Only the operator can set a binding to fail open. No request header can skip a
`deny` binding.

**A failed call is never a pass.** If the validator fails or times out, Hub
records `status: error`.

**Results key on content, not only on the version.** Each result holds the
version URL and the content SHA-256. When the content changes, the old result is
`stale`, and Hub validates again.

**Only Hub writes `validation` decorators.** The decorator store wrapper rejects
a `validation` decorator from any other writer, through REST and MCP. Hub writes
one decorator for each source. A new result supersedes the old one, and Hub does
not edit a decorator in place. Hub's own writes run as `actor: system` and do not
start validation again.

**`applies-to` sentinel.** Until calm-schema allows an empty or missing
`applies-to`, a result with no element id uses the architecture's own id. A
proposal to make `applies-to` optional goes to finos/calm-schema.

## Consequences

- #3399 does not wait for the extension proxy. It needs ADR 0016 and these
  calm-server changes: a standards mode that skips the `$schema` check, a map of
  resolved documents in the request, a source id on each output, and a
  configurable rate limit.
- A publish is never slower and never fails because of validation until a `deny`
  binding exists.
- A version can be published and then shown as failing. The UI must show
  `fail`, `error` and `stale` clearly.
- Revalidation after a binding change can make many calls to calm-server. The
  relay limits the rate.
- Organisation rules that JSON Schema cannot express (for example Spectral rules,
  [#1562](https://github.com/finos/architecture-as-code/issues/1562)) can come as
  a second validator, which adds sources to the same contract.
