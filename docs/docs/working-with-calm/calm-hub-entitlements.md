---
id: calm-hub-entitlements
title: CALM Hub Entitlements
sidebar_position: 5
---

# CALM Hub Entitlements

CALM Hub uses a hierarchical permission model to control who can read, write, and administer namespaces, and a flat permission model for control domains. This page explains how both models work and how to configure access.

---

## Permission Levels

Every access grant specifies one of three permission levels:

| Permission | What it allows |
| :--- | :--- |
| `read` | Read any document in the namespace or domain |
| `write` | Create documents (implies `read`) |
| `admin` | Full control: read, write, and manage entitlements for other users (implies `read` and `write`) |

---

## Namespace Permissions

### Hierarchy

Namespaces in CALM Hub use `.` as a separator to express parent/child relationships:

```
org
org.ecosystem
org.ecosystem.system
```

Access grants are evaluated across the full ancestor chain, not just the directly-targeted namespace.

### Reading: AND across the ancestor chain

To **read** a namespace, a user must have a sufficient grant at the requested namespace **and every ancestor namespace**.

If any level in the chain is missing a grant for the user, access is denied — even if the target namespace itself has a grant.

**Example**

| Namespace | `*` (public) grant | `bob` grant |
| :--- | :--- | :--- |
| `org` | `read` | — |
| `org.ab` | `read` | — |
| `org.ab.cd` | — | `read` |
| `org.ab.cd.de` | `read` | — |

- **Anyone** can read `org` and `org.ab` (public grant at both levels).
- **Only `bob`** can read `org.ab.cd` (no public grant at that level; `bob` has an explicit grant).
- **Only `bob`** can read `org.ab.cd.de` — even though it has a public grant, the AND check fails at `org.ab.cd` for everyone else.

This rule makes it possible to have a publicly visible parent namespace with restricted child namespaces. Removing a public grant from a namespace automatically restricts access to all its descendants, without needing to change those descendants.

### Writing and Administering: OR across the ancestor chain

To **write** or **admin** a namespace, a user must have a sufficient grant at the requested namespace **or any ancestor namespace**.

A grant at `org` is sufficient to write anything under `org.ecosystem`, `org.ecosystem.system`, and so on. This lets you delegate broad access with a single grant rather than one per sub-namespace.

### Creating Namespaces

To create a **top-level namespace** (e.g. `org`), a user must be a global admin.

To create a **child namespace** (e.g. `org.ecosystem`), a user must be a global admin **or** have `admin` on the direct parent namespace (`org` in this example).

---

## Domain Permissions

Control domains use a **flat** permission model — there is no ancestor chain. A grant on domain `payments` applies only to `payments`; it does not cascade to any other domain.

| Permission | What it allows |
| :--- | :--- |
| `read` | Read content in the domain |
| `write` | Read and write content in the domain |
| `admin` | Read, write, and manage entitlements for the domain |

Only global admins can create and delete domains. Domain admin grants are managed through the admin UI or the `/api/calm/domains/{domain}/user-access` endpoints.

---

## Public Access: the `*` Username

The reserved username `*` represents **anyone** — including unauthenticated users if your deployment allows it. A `*` grant at a namespace or domain means it is open to all users at that permission level.

```
username: *
permission: read
namespace: org.ab
```

`*` grants are evaluated by the same AND/OR rules as named user grants. You manage them through the same API or admin UI — `*` is just a username value that matches everyone.

When a namespace is created, CALM Hub automatically inserts a `* read` grant so the namespace is publicly readable by default. To restrict a namespace, delete that `* read` grant. The same applies to domains.

:::warning
`*` can be granted `write`, but **not `admin`** — attempts to create a wildcard admin grant on any namespace or domain are rejected with `400 Bad Request`. This prevents accidental elevation of all users to administrators.
:::

---

## Global Access Modes

### `allow-public-read` flag

Setting `calm.auth.allow-public-read=true` makes every namespace readable by everyone, bypassing all per-namespace checks. This is the simplest option for fully open deployments. The default is `false`.

### Global admin

A user with `admin` on the special `GLOBAL` namespace bypasses all namespace-level and domain-level permission checks. Use this for super-administrators who need unrestricted access. Global admins can:

- Read and write all namespaces and domains
- Create and delete namespaces and domains
- Manage entitlements for any namespace or domain, including granting further GLOBAL admin access

To bootstrap a new deployment, create the first GLOBAL admin grant via the admin UI in `no-auth` mode (or via the Swagger UI at `/q/swagger-ui`), then switch to a secured auth profile.

:::note
The GLOBAL namespace is a sentinel value — it is not a real namespace in the store and cannot be used to store documents.
:::

---

## Worked Example

Consider three users on a hub with the following grants:

| Username | Permission | Namespace |
| :--- | :--- | :--- |
| `*` | `read` | `org` |
| `*` | `read` | `org.ab` |
| `mark` | `write` | `org.ab` |
| `carol` | `admin` | `org.ab.cd` |
| `bob` | `read` | `org.ab.cd` |

**What can each user do with `org.ab.cd`?**

| User | Can read? | Can write? | Can admin? |
| :--- | :--- | :--- | :--- |
| Anyone (unauthenticated) | No (`org.ab.cd` has no `*` read grant) | No | No |
| `mark` | No (no grant at `org.ab.cd` for mark or `*` — AND fails at that level) | Yes (write grant at `org.ab` is an ancestor — OR passes) | No |
| `carol` | Yes (admin at `org.ab.cd` implies read; `*` read at ancestors passes the AND check) | Yes | Yes |
| `bob` | Yes (`*` at ancestors + own read at `org.ab.cd`) | No | No |

---

## Managing Entitlements

### Admin UI

The easiest way to manage entitlements is the built-in admin UI, available at `/admin` in your CALM Hub instance. Users with any admin entitlement can access it; the sections visible depend on your permission level:

- **Namespace Access** — available to any namespace admin; manage grants for namespaces you administer
- **Domain Access** — available to global admins only; manage grants for any domain
- **Global Admin Access** — available to global admins only; grant or revoke GLOBAL admin access for other users

### REST API

Entitlements can also be managed directly through the REST API. Use the [Swagger UI](http://localhost:8080/q/swagger-ui) to explore available operations.

**Grant `bob` read access to `org.ab.cd`:**

```http
POST /api/calm/namespaces/org.ab.cd/user-access
Content-Type: application/json

{
  "username": "bob",
  "permission": "read"
}
```

**Make `org.ab` publicly readable:**

```http
POST /api/calm/namespaces/org.ab/user-access
Content-Type: application/json

{
  "username": "*",
  "permission": "read"
}
```

**Remove public access from `org.ab`:**

```http
DELETE /api/calm/namespaces/org.ab/user-access/{id}
```

**Grant `carol` admin access to the `payments` domain:**

```http
POST /api/calm/domains/payments/user-access
Content-Type: application/json

{
  "username": "carol",
  "permission": "admin"
}
```

---

## Restricting a Namespace

To make a namespace private:

1. Find the `* read` grant for the namespace using `GET /api/calm/namespaces/org.ab/user-access`.
2. Delete it with `DELETE /api/calm/namespaces/org.ab/user-access/{id}`.

Once removed, only users with explicit grants — or a write/admin grant on an ancestor — can access that namespace.

:::note
Removing the `*` grant at a parent namespace cascades access restriction down the tree automatically, because child namespaces still require the AND check to pass at every ancestor.
:::
