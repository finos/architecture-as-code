---
id: calm-hub-entitlements
title: CALM Hub Entitlements
sidebar_position: 5
---

# CALM Hub Entitlements

CALM Hub uses a hierarchical permission model to control who can read, write, and administer namespaces. This page explains how that model works and how to configure access.

---

## Permission Levels

Every access grant specifies one of three permission levels:

| Permission | What it allows |
| :--- | :--- |
| `read` | Read any document in the namespace |
| `write` | Create documents in the namespace (implies `read`) |
| `admin` | Full control: read, write, and manage entitlements for other users in the namespace (implies `read` and `write`) |

---

## Namespace Hierarchy

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

---

## Public Access: the `*` Username

The reserved username `*` represents **anyone** — including unauthenticated users if your deployment allows it. A `*` grant at a namespace means that namespace is open to all users at that permission level.

```
username: *
permission: read
namespace: org.ab
```

`*` grants are evaluated by the same AND/OR rules as named user grants. You manage them through the same API — `*` is just a username value that matches everyone.

When a namespace is created, CALM Hub automatically inserts a `* read` grant so the namespace is publicly readable by default. To restrict a namespace, delete that `*` grant.

:::tip
`*` can be granted `write` or `admin` as well — useful for private internal deployments where all authenticated users should be able to contribute freely.
:::

---

## Global Access Modes

### `allow-public-read` flag

Setting `calm.auth.allow-public-read=true` makes every namespace readable by everyone, bypassing all per-namespace checks. This is the simplest option for fully open deployments. The default is `false`.

### Global admin

A user with `admin` on the special `GLOBAL` namespace bypasses all namespace-level permission checks. Use this for super-administrators who need unrestricted access. Global admins can also manage control domains.

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

## Managing Entitlements via the API

Entitlements are managed through the `/user-access` REST endpoints. Use the [Swagger UI](http://localhost:8080/q/swagger-ui) to explore available operations.

**Grant `bob` read access to `org.ab.cd`:**

```http
POST /user-access
Content-Type: application/json

{
  "username": "bob",
  "permission": "read",
  "namespace": "org.ab.cd"
}
```

**Make `org.ab` publicly readable:**

```http
POST /user-access
Content-Type: application/json

{
  "username": "*",
  "permission": "read",
  "namespace": "org.ab"
}
```

**Remove public access from `org.ab`:**

```http
DELETE /user-access/{id}
```

---

## Restricting a Namespace

To make a namespace private:

1. Find the `* read` grant for the namespace using `GET /user-access?namespace=org.ab`.
2. Delete it with `DELETE /user-access/{id}`.

Once removed, only users with explicit grants — or a write/admin grant on an ancestor — can access that namespace.

:::note
Removing the `*` grant at a parent namespace cascades access restriction down the tree automatically, because child namespaces still require the AND check to pass at every ancestor.
:::
