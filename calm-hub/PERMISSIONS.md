# Structure of CalmHub permissions system

CalmHub drives its permission system from the in-memory database.
Entitlements are stored as `UserAccess` records.

## Structure of entitlements model

Entitlements are applied at a per-namespace level, at domain level for control requirements and configurations.
They are separated by resource type.

The available actions are the following. 

| Action                | Description                                                                                                                                                                       |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `RESOURCE_TYPE:read`  | Can read any documents of that type in the namespace.                                                                                                                             |
| `RESOURCE_TYPE:write` | Can write any documents of that type in the namespace. This includes deleting them. Note that by default resources in CalmHub are immutable, so this usually means 'create' only. 
| `namespace:admin`     | Can do anything to all resource types, and also grant entitlements to other users in the namespace.                                                                               |

For example, `architectures:read` means the user can read all architectures in that NS.

Please note that each entitlement implies all previous levels - i.e. `write` implies `read`. 
`namespace:admin` implies `read` and `write` on all resource types.

**You can also use `all` as a resource type to apply that permission to all resource types.** 
For example, `all:write` means you can read and write on all resources.
