---
id: k8s-cluster
title: Kubernetes Cluster
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | k8s-cluster                   |
| **Node Type**       | system             |
| **Name**            | Kubernetes Cluster                 |
| **Description**     | Kubernetes Cluster with network policy rules enabled          |
| **Data Classification** |  |
| **Run As**          |                 |
</div>

## Interfaces
    _No interfaces defined._


## Related Nodes
```mermaid
graph TD;
k8s-cluster[k8s-cluster]:::highlight;
k8s-cluster -- Deployed In --> load-balancer;
k8s-cluster -- Deployed In --> attendees;
k8s-cluster -- Deployed In --> attendees-store;
classDef highlight fill:#f2bbae;

```
## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
