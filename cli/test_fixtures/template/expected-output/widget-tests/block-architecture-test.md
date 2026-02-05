---
architecture: ../../../getting-started/STEP-3/conference-signup-with-flow.arch.json
url-to-local-file-mapping: ../../../getting-started/url-to-local-file-mapping.json
---
# Conference Registration System - Block Architecture

This diagram shows the system components and their relationships in a block architecture view.

## Full System View

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif
    darkMode: false
    fontSize: 14px
    edgeLabelBackground: '#d5d7e1'
    lineColor: '#000000'
---
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;

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
---
config:
  theme: base
  themeVariables:
    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif
    darkMode: false
    fontSize: 14px
    edgeLabelBackground: '#d5d7e1'
    lineColor: '#000000'
---
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;

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
---
config:
  theme: base
  themeVariables:
    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif
    darkMode: false
    fontSize: 14px
    edgeLabelBackground: '#d5d7e1'
    lineColor: '#000000'
---
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;


    attendees["Attendees Service"]:::node
    conference-website["Conference Website"]:::node
    load-balancer["Load Balancer"]:::node

    conference-website -->|Request attendee details| load-balancer
    load-balancer -->|Forward| attendees


    class load-balancer highlight

```

## Full View with Interfaces
```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', sans-serif
    darkMode: false
    fontSize: 14px
    edgeLabelBackground: '#d5d7e1'
    lineColor: '#000000'
---
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;

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