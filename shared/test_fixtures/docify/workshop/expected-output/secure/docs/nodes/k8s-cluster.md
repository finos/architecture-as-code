---
architecture: ../../../../../../command/generate/expected-output/conference-secure-signup-amended.arch.json
url-to-local-file-mapping: ../../../../url-mapping-secure.json
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
k8s-cluster[k8s-cluster]:::highlight;
load-balancer -- Deployed In --> k8s-cluster;
attendees -- Deployed In --> k8s-cluster;
attendees-store -- Deployed In --> k8s-cluster;
classDef highlight fill:#f2bbae;
```

## Controls
### Security

Security requirements for the Kubernetes cluster

<div class="table-container">
    <table>
        <thead>
        <tr>
            <th>Key</th>
            <th>Value</th>
        </tr>
        </thead>
        <tbody>
        <tr>
            <td><b>0</b></td>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Requirement Url</b></td>
                            <td>
                                https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json
                                    </td>
                        </tr>
                        </tbody>
                    </table>
            </td>
        </tr>
        </tbody>
    </table>
</div>


## Metadata
<p class="empty-message">No metadata defined.</p>
