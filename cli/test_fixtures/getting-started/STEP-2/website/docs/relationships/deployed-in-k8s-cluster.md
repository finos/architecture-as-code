---
architecture: ../../../conference-signup.arch.json
url-to-local-file-mapping: ../../../../url-to-local-file-mapping.json
relationship-id: deployed-in-k8s-cluster
id: "deployed-in-k8s-cluster"
title: "Deployed In K8s Cluster"
---

# Deployed In K8s Cluster

## Details
<div class="table-container">
    <table>
        <tbody>
        <tr>
            <th>Unique Id</th>
            <td>deployed-in-k8s-cluster</td>
        </tr>
        <tr>
            <th>Description</th>
            <td>Components deployed on the k8s cluster</td>
        </tr>
        </tbody>
    </table>
</div>

## Related Nodes
```mermaid
graph TD;
load-balancer -- Deployed In --> k8s-cluster;
attendees -- Deployed In --> k8s-cluster;
attendees-store -- Deployed In --> k8s-cluster;
classDef highlight fill:#f2bbae;
```

## Controls
_No controls defined._

## Metadata
<p class="empty-message">No metadata defined.</p>
