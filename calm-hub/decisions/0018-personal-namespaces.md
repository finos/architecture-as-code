# ADR 0018: Personal namespaces

**Status**: Proposed. Not built. The design is in
[PERSONAL_NAMESPACES.md](../PERSONAL_NAMESPACES.md).

## Context

[#3075](https://github.com/finos/architecture-as-code/issues/3075) asks for a
namespace for scratch work that each user can get without help from an admin.

Facts in the code:

- Namespaces are hierarchical. `users.alice` is a child of `users`. To create a
  child, the parent must exist and the caller must have ADMIN on the parent or
  GLOBAL_ADMIN.
- READ needs a grant at each level of the namespace. WRITE and ADMIN need a grant
  at one level ([PERMISSIONS.md](../PERMISSIONS.md)).
- `NamespaceService.createNamespace` always adds a `*` read grant.
- Hub checks `@PermissionsAllowed` before the resource method runs. A caller with
  no grant on a namespace that does not exist gets 403.
- The principal comes from the identity provider: `preferred_username` for OIDC,
  `Remote-User` for `proxy-auth`. It can contain `.`, `@` and `_`. A namespace
  segment allows only `[A-Za-z0-9-]`.
- Deleting a namespace also deletes all of its grants.

## Decision

**Name.** A personal namespace is `<root>.<segment>`. The root is `users` unless
the operator sets another. The segment is the principal name, with each `.`, `@`
and `_` changed to `-`. Letter case does not change. Hub does not give a personal
namespace to a principal with any other character.

**Explicit creation.** A user creates their personal namespace with one
idempotent request. Hub does not create it on the first write. The first write
fails the permission check before any resource code runs, and a permission check
must not create data.

**Grants.** On creation, Hub gives ADMIN to the owner and does not add the `*`
read grant. Other users cannot see the namespace until the owner grants access.
At start up, Hub creates the root if it does not exist, with a `*` read grant,
because READ needs a grant at each level.

**No claim on an existing namespace.** Hub creates the namespace and the owner
grant only when the namespace does not exist. If it exists and the caller has
no ADMIN on it, Hub returns 409. Thus two principals with the same segment, for
example `mark.scott` and `mark-scott`, cannot share a namespace: the second gets
409. Hub does not record an owner. The owner is the user with the ADMIN grant.

**Reserved root.** When the feature is on, the general create endpoint rejects a
child of the root. All personal namespaces come from the personal namespace
request, so none has a `*` read grant.

**Off by default.** The operator turns the feature on. Hub does not turn it on
when:

- auth is off (`no-auth`), because all callers have one principal and every
  check passes.
- Hub is read-only (`calm.readonly=true`) or in GitHub mode, because writes fail.

## Consequences

- A user can start scratch work, and share it with the existing grant endpoints,
  without an admin.
- A user whose segment is taken gets no personal namespace. An admin can create a
  normal namespace for them.
- ADMIN on the root gives WRITE and ADMIN on every personal namespace, but not
  READ until that user grants it. Only GLOBAL_ADMIN users should hold it.
- With `calm.auth.allow-public-read=true`, all users can read personal
  namespaces. Hub logs a warning at start up.
- When the owner deletes their empty namespace, its grants go too. Then another
  principal with the same segment can create it.
- If the operator turns the feature off, existing personal namespaces stay as
  normal namespaces with their grants.
- Archiving and moving documents out of a personal namespace is
  [#2856](https://github.com/finos/architecture-as-code/issues/2856).
