---
id: load-balancer
title: Load Balancer
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | load-balancer                   |
| **Node Type**       | network             |
| **Name**            | Load Balancer                 |
| **Description**     | The attendees service, or a placeholder for another application          |
| **Data Classification** |  |
| **Run As**          |                 |
</div>

## Interfaces
    | Unique ID | Host | Port | Url |
    |-----------|------|------|-----|
        | load-balancer-host-port | localhost | 80 |  |


## Related Nodes
```mermaid
graph TD;
load-balancer[load-balancer]:::highlight;
conference-website -- Connects --> load-balancer;
load-balancer -- Connects --> attendees;
k8s-cluster -- Deployed In --> load-balancer;
classDef highlight fill:#f2bbae;

```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
