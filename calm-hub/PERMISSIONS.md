# Structure of CalmHub permissions system

CalmHub drives its permission system from the in-memory database.
Entitlements are stored as `UserAccess` records.

## Structure of entitlements model

Entitlements are applied at a per-namespace level, at domain level for control requirements and configurations.

The available actions are the following. 

| Action  | Description                                                                                                                                                                       |
|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `read`  | Can read any documents of that type in the namespace.                                                                                                                             |
| `write` | Can write any documents of that type in the namespace. This includes deleting them. Note that by default resources in CalmHub are immutable, so this usually means 'create' only. |
| `admin` | Can do anything to all resource types, and also grant entitlements to other users in the namespace.                                                                               |

For example, `read` means the user can read all resources in that NS.

Please note that each entitlement implies all previous levels - i.e. `write` implies `read`.
`admin` implies `read` and `write` on all resource types.

## Global admin

Some resources aren't tied to any one namespace.
Creating namespaces and managing core schemas requires the `admin` role, with the namespace `GLOBAL` in the database.

**NOTE**: Global admin also gives you the right to manage domains. 
There's only one notion of global admin.

## Global READ mode

It's possible to configure CalmHub to grant `read` to all users by default.

To do this, set the property `calm.hub.allow.public.read=true`.
By default this property is `false`.

