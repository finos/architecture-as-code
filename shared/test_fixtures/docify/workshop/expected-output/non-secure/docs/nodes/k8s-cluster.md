---
architecture: ../../../../../../command/generate/expected-output/conference-signup.arch.json
node-id: k8s-cluster
id: "k8s-cluster"
title: "Kubernetes Cluster"
---

# Kubernetes Cluster

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>k8s-cluster</td>
        </tr>
        <tr>
            <th>Name</th>
            <td>Kubernetes Cluster</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>Kubernetes Cluster with network policy rules enabled</td>
        </tr>
        <tr>
            <th>Node Type</th>
            <td>system</td>
        </tr>
        </tbody>
    </table>
</div>

## Interfaces
<p class="empty-message">No interfaces defined.</p>

## Related Nodes
```mermaid
graph TD;
k8s-cluster[Kubernetes Cluster]:::highlight;
load-balancer[Load Balancer] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
attendees[Attendees Service] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
attendees-store[Attendees Store] -- Deployed In --> k8s-cluster[Kubernetes Cluster];
classDef highlight fill:#f2bbae;
```

## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
