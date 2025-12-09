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

        ### Security

        Security requirements for the Kubernetes cluster

        <div className="table-container">
            <table>
                <thead>
                <tr>
                    <th>Requirement URL</th>
                    <th>Config</th>
                </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                                <a href="https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json" target="_blank">
                                    https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json
                                </a>
                        </td>

                        <td>
                                <a href="https://calm.finos.org/getting-started/controls/micro-segmentation.config.json" target="_blank">
                                    https://calm.finos.org/getting-started/controls/micro-segmentation.config.json
                                </a>

                        </td>
                    </tr>
                </tbody>
            </table>
        </div>


## Metadata
  _No Metadata defined._
