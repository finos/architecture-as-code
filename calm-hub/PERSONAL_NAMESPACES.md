# Personal Namespaces

> **Status: proposed, not built.** This document describes the target design.
> [ADR 0018](decisions/0018-personal-namespaces.md) records the decisions that are
> hard to change later. Tracked in
> [#3075](https://github.com/finos/architecture-as-code/issues/3075).

A personal namespace is a private namespace for scratch work. Each user can create
one without an admin. Only the owner can read it until they grant access to other
users.

## Configuration

| Property | Default | Meaning |
|---|---|---|
| `calm.namespaces.personal.enabled` | `false` | Turns the feature on |
| `calm.namespaces.personal.root` | `users` | The parent namespace of all personal namespaces. It must match the namespace pattern |

Hub ignores `enabled=true`, and logs a warning, when:

- auth is off (`calm.auth.enabled=false`)
- Hub is read-only (`calm.readonly=true`)
- `calm.database.mode=github`

With `calm.auth.allow-public-read=true`, all users can read personal namespaces.
Hub logs a warning at start up and does not stop.

## Names

The name is `<root>.<segment>`. To make the segment, Hub takes the principal name
and changes each `.`, `@` and `_` to `-`. Letter case does not change.

| Principal | Personal namespace |
|---|---|
| `alice` | `users.alice` |
| `mark.scott` | `users.mark-scott` |
| `mark.scott@example.com` | `users.mark-scott-example-com` |
| `j_smith` | `users.j-smith` |
| `Alice` | `users.Alice` (not the same as `users.alice`) |

A principal that contains any other character, for example a space, has no
personal namespace. The API returns 422 for it.

Two principals can give the same segment, for example `mark.scott` and
`mark-scott`. The first one to create the namespace owns it. The second gets 409
(see [Clashes](#clashes)).

## API

Both endpoints need an authenticated caller and no namespace grant. They declare
`@Produces(MediaType.APPLICATION_JSON)`.

### `GET /api/calm/me/namespace`

Returns the caller's personal namespace and whether it is theirs.

```json
{ "name": "users.mark-scott", "exists": true, "owned": true }
```

| Case | Status | Body |
|---|---|---|
| Not created yet | 200 | `exists: false`, `owned: false` |
| Created by the caller | 200 | `exists: true`, `owned: true` |
| Taken by a different principal | 200 | `exists: true`, `owned: false` |
| Principal cannot be made into a segment | 422 | Error |
| Feature off | 404 | Error |

`owned` is true when the caller has ADMIN on the namespace.

### `PUT /api/calm/me/namespace`

Creates the caller's personal namespace. The request has no body. A second call
changes nothing.

| Case | Status |
|---|---|
| Created | 201, with `Location: /api/calm/namespaces/<name>` |
| Exists and the caller has ADMIN on it | 200 |
| Exists and the caller has no ADMIN on it | 409 |
| Principal cannot be made into a segment | 422 |
| Feature off | 404 |

On create, Hub:

1. creates the namespace with the description `Personal namespace for <principal>`.
2. gives the caller `admin` on the namespace.
3. does not add the `*` read grant that `NamespaceService.createNamespace` adds.

The path has no `{namespace}` parameter, so `AuditRequestFilter` cannot find the
entity from the path. The resource stages an `AuditContext` for NAMESPACE CREATE,
as `NamespaceResource.createNamespace` does.

## Grants

| Namespace | Grants |
|---|---|
| Root (`users`) | `*` read. Created at start up if it does not exist |
| `users.alice` | `alice` admin. No `*` read |

READ needs a grant at each level, so all users can see the root, and only Alice
can see `users.alice`. Alice adds and removes grants with the existing
`/api/calm/namespaces/{namespace}/user-access` endpoints and the entitlements panel.

If the root exists at start up without a `*` read grant, Hub does not add one. It
logs a warning, because owners cannot read their own namespaces until an admin
adds the grant.

ADMIN on the root gives WRITE and ADMIN on every personal namespace, because WRITE
and ADMIN need a grant at one level only. It does not give READ, but an admin can
grant READ to themselves. Give root ADMIN to GLOBAL_ADMIN users only.

## Clashes

Hub never gives a grant on a namespace that exists. It does not record an owner:
the owner is the user with the ADMIN grant.

When the owner deletes their empty namespace, Hub also deletes its grants. Then
another principal with the same segment can create it. Content in the namespace
stops a delete, so a clash cannot take content.

A user whose segment is taken can ask an admin for a normal namespace.

## Changes to existing endpoints

| Endpoint | Change when the feature is on |
|---|---|
| `POST /api/calm/namespaces` | Returns 400 for a child of the root, for GLOBAL_ADMIN too. Personal namespaces come only from `PUT /api/calm/me/namespace` |
| `DELETE /api/calm/namespaces/{namespace}` | No change. The owner can delete their empty namespace |
| `GET /api/calm/namespaces` | No change. The list already holds only readable namespaces |

When the feature is off, the root is a normal namespace and none of these changes apply.

## Hub UI

- The home page shows a **My namespace** card when the feature is on. It calls
  `GET /api/calm/me/namespace`:
  - If the namespace is not created, the card shows the name and a **Create**
    button, which calls the `PUT`.
  - If the caller owns it, the card shows the name, a link to the namespace, and a
    copy button for the CLI.
  - If it is taken, the card says so and tells the user to ask an admin.
- The namespace list hides the root when it has no content of its own.

## CLI

No CLI change is planned yet. A user copies the namespace name from the UI and
uses it with `calm hub push`. Later work can add:

- `calm hub whoami`, which prints the principal and the personal namespace.
- A `@me` value for the namespace option of `calm hub push`, which calls the `PUT`
  first.

## Out of scope

| Item | Where |
|---|---|
| Share links for documents in a private namespace | A separate issue, as agreed on #3075 |
| Archive, and move documents out of a personal namespace | [#2856](https://github.com/finos/architecture-as-code/issues/2856) |
| Personal domains | Not planned |
| Clean-up when a user leaves | Not planned. An admin deletes the content and the namespace |

## Build outline

| Part | Content |
|---|---|
| Config | A `@ConfigMapping(prefix = "calm.namespaces.personal")` class, with a start-up check of the root name and of the mode |
| Start up | Create the root and its `*` read grant if the root does not exist |
| Service | `PersonalNamespaceService`: make the segment, find the state, create the namespace and the ADMIN grant |
| Resource | `PersonalNamespaceResource` for `/api/calm/me/namespace`, with the staged audit context |
| `NamespaceResource` | Reject a child of the root when the feature is on |
| Tests | Unit tests for the segment rules and each status in the tables above. Integration tests for MongoDB and NitriteDB. JaCoCo needs 90% line coverage for each class |
| Docs | [PERMISSIONS.md](PERMISSIONS.md), the README configuration section, and the CALM Hub learning guide |
