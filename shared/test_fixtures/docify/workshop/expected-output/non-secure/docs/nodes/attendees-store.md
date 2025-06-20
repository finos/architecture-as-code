---
id: attendees-store
title: Attendees Store
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | attendees-store                   |
| **Node Type**       | database             |
| **Name**            | Attendees Store                 |
| **Description**     | Persistent storage for attendees          |
| **Data Classification** |  |
| **Run As**          |                 |
</div>

## Interfaces
    | Unique ID | Host | Port | Url |
    |-----------|------|------|-----|
        | database-image |  |  |  |
        | database-port |  | -1 |  |


## Related Nodes
```mermaid
graph TD;
attendees-store[attendees-store]:::highlight;
attendees -- Connects --> attendees-store;
k8s-cluster -- Deployed In --> attendees-store;
classDef highlight fill:#f2bbae;

```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
