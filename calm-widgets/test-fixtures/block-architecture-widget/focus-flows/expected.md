## Default Architecture with All Flows
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

        subgraph ecommerce-platform["E-Commerce Platform"]
        direction TB
                subgraph core-services["Core Services"]
                direction TB
                    order-service["Order Service"]:::node
                    user-service["User Service"]:::node
                end
                class core-services boundary
                subgraph customer-edge["Customer Edge"]
                direction TB
                    api-gateway["API Gateway"]:::node
                    web-app["Web Application"]:::node
                end
                class customer-edge boundary
                subgraph notifications-system["Notifications System"]
                direction TB
                    notification-service["Notification Service"]:::node
                end
                class notifications-system boundary
                subgraph data-platform["Operational Data"]
                direction TB
                    order-db["Order Database"]:::node
                    user-db["User Database"]:::node
                end
                class data-platform boundary
                subgraph payments-system["Payments System"]
                direction TB
                    payment-service["Payment Service"]:::node
                end
                class payments-system boundary
        end
        class ecommerce-platform boundary


    web-app -->|HTTP requests| api-gateway
    api-gateway -->|User operations| user-service
    api-gateway -->|Order operations| order-service
    order-service -->|Process payment| payment-service
    payment-service -->|Payment notification| notification-service
    user-service -->|Store user data| user-db
    order-service -->|Store order data| order-db



```

## Single Flow without Containers [focus-flows="order-flow" include-containers="none"]
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


    api-gateway["API Gateway"]:::node
    notification-service["Notification Service"]:::node
    order-service["Order Service"]:::node
    payment-service["Payment Service"]:::node
    web-app["Web Application"]:::node

    web-app -->|HTTP requests| api-gateway
    api-gateway -->|Order operations| order-service
    order-service -->|Process payment| payment-service
    payment-service -->|Payment notification| notification-service



```

## User Flow Focus [focus-flows="user-flow"]
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

        subgraph ecommerce-platform["Ecommerce Platform"]
        direction TB
                subgraph core-services["Core Services"]
                direction TB
                    user-service["User Service"]:::node
                end
                class core-services boundary
                subgraph customer-edge["Customer Edge"]
                direction TB
                    api-gateway["API Gateway"]:::node
                    web-app["Web Application"]:::node
                end
                class customer-edge boundary
                subgraph data-platform["Data Platform"]
                direction TB
                    user-db["User Database"]:::node
                end
                class data-platform boundary
        end
        class ecommerce-platform boundary


    web-app -->|HTTP requests| api-gateway
    api-gateway -->|User operations| user-service
    user-service -->|Store user data| user-db



```

## Multiple Flows Combined [focus-flows="order-flow,user-flow"]
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

        subgraph ecommerce-platform["Ecommerce Platform"]
        direction TB
                subgraph core-services["Core Services"]
                direction TB
                    order-service["Order Service"]:::node
                    user-service["User Service"]:::node
                end
                class core-services boundary
                subgraph customer-edge["Customer Edge"]
                direction TB
                    api-gateway["API Gateway"]:::node
                    web-app["Web Application"]:::node
                end
                class customer-edge boundary
                subgraph data-platform["Data Platform"]
                direction TB
                    user-db["User Database"]:::node
                end
                class data-platform boundary
                subgraph notifications-system["Notifications System"]
                direction TB
                    notification-service["Notification Service"]:::node
                end
                class notifications-system boundary
                subgraph payments-system["Payments System"]
                direction TB
                    payment-service["Payment Service"]:::node
                end
                class payments-system boundary
        end
        class ecommerce-platform boundary


    web-app -->|HTTP requests| api-gateway
    api-gateway -->|User operations| user-service
    api-gateway -->|Order operations| order-service
    order-service -->|Process payment| payment-service
    payment-service -->|Payment notification| notification-service
    user-service -->|Store user data| user-db



```