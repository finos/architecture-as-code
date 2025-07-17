---
id: attendees
title: Attendees Service
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | attendees                   |
| **Node Type**       | service             |
| **Name**            | Attendees Service                 |
| **Description**     | The attendees service, or a placeholder for another application          |
| **Data Classification** |  |
| **Run As**          |                 |
</div>

## Interfaces
    | Unique ID | Host | Port | Url |
    |-----------|------|------|-----|
        | attendees-image |  |  |  |
        | attendees-port |  | 8080 |  |


## Related Nodes
```mermaid
graph TD;
attendees[attendees]:::highlight;
load-balancer -- Connects --> attendees;
attendees -- Connects --> attendees-store;
k8s-cluster -- Deployed In --> attendees;
classDef highlight fill:#f2bbae;

```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
