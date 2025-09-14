## Single Node Focus [focus-nodes="web-app"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    api-gateway["API Gateway"]:::node
    web-app["Web Application"]:::node

    web-app -->|Web app connects to API gateway| api-gateway


    class web-app highlight

```

## Gateway Node with All Connections [focus-nodes="api-gateway"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph backend-container["Backend Container"]
        direction TB
            order-service["Order Service"]:::node
            user-service["User Service"]:::node
        end
        class backend-container boundary

    api-gateway["API Gateway"]:::node
    load-balancer["Load Balancer"]:::node
    web-app["Web Application"]:::node

    web-app -->|Web app connects to API gateway| api-gateway
    api-gateway -->|Gateway routes to user service| user-service
    api-gateway -->|Gateway routes to order service| order-service
    load-balancer -->|Load balancer routes to API gateway| api-gateway


    class api-gateway highlight

```

## Multiple Services Focus [focus-nodes="user-service,order-service"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph backend-container["Backend Container"]
        direction TB
            order-service["Order Service"]:::node
            payment-service["Payment Service"]:::node
            user-service["User Service"]:::node
        end
        class backend-container boundary

    api-gateway["API Gateway"]:::node
    notification-service["Notification Service"]:::node
    database["PostgreSQL Database"]:::node

    api-gateway -->|Gateway routes to user service| user-service
    api-gateway -->|Gateway routes to order service| order-service
    order-service -->|Order service calls payment service| payment-service
    order-service -->|Order service triggers notifications| notification-service
    user-service -->|User service connects to database| database
    order-service -->|Order service connects to database| database


    class user-service highlight
    class order-service highlight

```

## Database with All Connected Services [focus-nodes="database"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph backend-container["Backend Container"]
        direction TB
            order-service["Order Service"]:::node
            user-service["User Service"]:::node
        end
        class backend-container boundary

    database["PostgreSQL Database"]:::node

    user-service -->|User service connects to database| database
    order-service -->|Order service connects to database| database


    class database highlight

```

## Container Hierarchy with Children [focus-nodes="backend-container" include-children="all"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph backend-container["Backend Services Container"]
        direction TB
            order-service["Order Service"]:::node
            payment-service["Payment Service"]:::node
            user-service["User Service"]:::node
        end
        class backend-container boundary

    api-gateway["API Gateway"]:::node
    notification-service["Notification Service"]:::node
    database["PostgreSQL Database"]:::node
    redis-cache["Redis Cache"]:::node

    api-gateway -->|Gateway routes to user service| user-service
    api-gateway -->|Gateway routes to order service| order-service
    order-service -->|Order service calls payment service| payment-service
    order-service -->|Order service triggers notifications| notification-service
    user-service -->|User service connects to database| database
    order-service -->|Order service connects to database| database
    payment-service -->|Payment service uses cache| redis-cache


    class backend-container highlight

```