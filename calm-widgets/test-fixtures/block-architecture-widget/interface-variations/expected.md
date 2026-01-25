## Node-to-Node Connections without Interfaces [render-interfaces=false include-containers="none" edges="connected"]
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


    inventory-svc["Inventory Service"]:::node
    order-svc["Order Service"]:::node

    order-svc -->|REST API call to reserve stock| inventory-svc



```

## Interface-to-Interface Connections [render-interfaces=true include-containers="none" edges="connected"]
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


    inventory-svc["Inventory Service"]:::node
        inventory-svc__iface__rest["◻ REST API"]:::iface
    order-svc["Order Service"]:::node
        order-svc__iface__rest["◻ REST API"]:::iface

    order-svc -->|REST API call to reserve stock| inventory-svc__iface__rest

    order-svc -.- order-svc__iface__rest
    inventory-svc -.- inventory-svc__iface__rest


```

## Interfaces with Container Context [render-interfaces=true include-containers="all"]
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

        subgraph retail-platform["Retail Platform"]
        direction TB
            inventory-svc["Inventory Service"]:::node
                inventory-svc__iface__rest["◻ REST API"]:::iface
            order-svc["Order Service"]:::node
                order-svc__iface__rest["◻ REST API"]:::iface
        end
        class retail-platform boundary


    order-svc -->|REST API call to reserve stock| inventory-svc__iface__rest

    order-svc -.- order-svc__iface__rest
    inventory-svc -.- inventory-svc__iface__rest


```