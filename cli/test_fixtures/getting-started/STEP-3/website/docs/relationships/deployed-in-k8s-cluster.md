---
id: deployed-in-k8s-cluster
title: Deployed In K8s Cluster
---

## Details
<div className="table-container">
| Field               | Value                    |
|---------------------|--------------------------|
| **Unique ID**       | deployed-in-k8s-cluster                   |
| **Description**      |  Components deployed on the k8s cluster   |
</div>

## Related Nodes
```mermaid
graph TD;
k8s-cluster -- Deployed In --> load-balancer;
k8s-cluster -- Deployed In --> attendees;
k8s-cluster -- Deployed In --> attendees-store;

```

## Controls
    _No controls defined._

## Metadata
  _No Metadata defined._
