# Conference Registration System - Block Architecture

This diagram shows the system components and their relationships in a block architecture view.

## Full System View

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

## Flow-based View

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph k8s-cluster["K8s Cluster"]
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


    class attendees highlight

```

## Focus on One Load Balancer

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    attendees["Attendees Service"]:::node
    conference-website["Conference Website"]:::node
    load-balancer["Load Balancer"]:::node

    conference-website -->|Request attendee details| load-balancer
    load-balancer -->|Forward| attendees


    class load-balancer highlight

```

## Full View with Interfaces
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
                attendees__iface__attendees-image["◻ attendees-image"]:::iface
                attendees__iface__attendees-port["◻ attendees-port"]:::iface
            attendees-store["Attendees Store"]:::node
                attendees-store__iface__database-image["◻ database-image"]:::iface
                attendees-store__iface__database-port["◻ database-port"]:::iface
            load-balancer["Load Balancer"]:::node
                load-balancer__iface__load-balancer-host-port["◻ load-balancer-host-port"]:::iface
        end
        class k8s-cluster boundary

    conference-website["Conference Website"]:::node
        conference-website__iface__conference-website-url["◻ conference-website-url"]:::iface

    conference-website -->|Request attendee details| load-balancer
    load-balancer -->|Forward| attendees
    attendees -->|Store or request attendee details| attendees-store

    conference-website -.- conference-website__iface__conference-website-url
    load-balancer -.- load-balancer__iface__load-balancer-host-port
    attendees -.- attendees__iface__attendees-image
    attendees -.- attendees__iface__attendees-port
    attendees-store -.- attendees-store__iface__database-image
    attendees-store -.- attendees-store__iface__database-port


```