---
architecture: ../../conference-signup.arch.json
url-to-local-file-mapping: ../../../url-to-local-file-mapping.json
id: index
title: Welcome to CALM Documentation
sidebar_position: 1
slug: /
---

# Welcome to CALM Documentation

This documentation is generated from the **CALM Architecture-as-Code** model.

## High Level Architecture
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph k8s-cluster["Kubernetes Cluster"]
        direction TB
            attendees["Attendees Service"]:::node
            attendees-store["Attendees Store"]:::node
            load-balancer["Load Balancer"]:::node
        end
        class k8s-cluster boundary

    conference-website["Conference Website"]:::node

    conference-website -->|Request attendee details| load-balancer
    load-balancer -->|Forward| attendees
    attendees -->|Store or request attendee details| attendees-store



```

## Nodes
- [Conference Website](nodes/conference-website)
- [Load Balancer](nodes/load-balancer)
- [Attendees Service](nodes/attendees)
- [Attendees Store](nodes/attendees-store)
- [Kubernetes Cluster](nodes/k8s-cluster)

## Relationships
- [Conference Website Load Balancer](relationships/conference-website-load-balancer)
- [Load Balancer Attendees](relationships/load-balancer-attendees)
- [Attendees Attendees Store](relationships/attendees-attendees-store)
- [Deployed In K8s Cluster](relationships/deployed-in-k8s-cluster)

## Flows
- [Conference Signup Flow](flows/flow-conference-signup)

## Metadata
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
            <th>Kubernetes</th>
            <td>
                <table class="nested-table">
                        <tbody>
                        <tr>
                            <td><b>Namespace</b></td>
                            <td>
                                conference
                                    </td>
                        </tr>
                        </tbody>
                    </table>        </td>
        </tr>
        </tbody>
    </table>
</div>

## ADRs
_No ADRs defined._
