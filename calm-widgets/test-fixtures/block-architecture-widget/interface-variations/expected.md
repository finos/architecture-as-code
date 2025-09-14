## Node-to-Node Connections without Interfaces [render-interfaces=false include-containers="none" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    inventory-svc["Inventory Service"]:::node
    order-svc["Order Service"]:::node

    order-svc -->|REST API call to reserve stock| inventory-svc



```

## Interface-to-Interface Connections [render-interfaces=true include-containers="none" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


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
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

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