## Default Architecture (No Focus)
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;

        subgraph app-container["Application Container"]
        direction TB
            service-a["Service A"]:::node
            service-b["Service B"]:::node
        end
        class app-container boundary

    admin-panel["Admin Panel"]:::node
    api-gateway["API Gateway"]:::node
    auth-service["Authentication Service"]:::node
    business-service["Business Logic Service"]:::node
    client-app["Client Application"]:::node
    core-service["Core Processing Service"]:::node
    data-service["Data Access Service"]:::node
    edge-gateway["Edge Gateway"]:::node
    external-api["External Payment API"]:::node
    legacy-system["Legacy Mainframe"]:::node
    mobile-client["Mobile Client"]:::node
    admin-actor["System Administrator"]:::node
    user-actor["User"]:::node
    web-portal["Web Portal"]:::node

    client-app -->|Client connects to API gateway| api-gateway
    api-gateway -->|Gateway routes authentication requests| auth-service
    api-gateway -->|Gateway routes business logic requests| business-service
    business-service -->|Business service accesses data| data-service
    business-service -->|Business service integrates with payment API| external-api
    user-actor -->|User interacts with web portal| web-portal
    admin-actor -->|Admin interacts with admin panel| admin-panel
    web-portal -->|Portal connects to service A| service-a
    mobile-client -->|Mobile client connects via WebSocket| edge-gateway
    edge-gateway -->|Gateway to core service via gRPC| core-service
    core-service -->|Core service to legacy via message queue| legacy-system



```

## Single Relationship Focus [focus-relationships="client-gateway-connection"]
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;


    api-gateway["API Gateway"]:::node
    client-app["Client Application"]:::node

    client-app -->|Client connects to API gateway| api-gateway



```

## Multiple Related Relationships [focus-relationships="gateway-auth-route,gateway-business-route"]
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;


    api-gateway["API Gateway"]:::node
    auth-service["Authentication Service"]:::node
    business-service["Business Logic Service"]:::node

    api-gateway -->|Gateway routes authentication requests| auth-service
    api-gateway -->|Gateway routes business logic requests| business-service



```

## Relationship with Connected Edges [focus-relationships="business-data-connection" edges="connected"]
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;


    business-service["Business Logic Service"]:::node
    data-service["Data Access Service"]:::node

    business-service -->|Business service accesses data| data-service



```

## Actor Interactions [focus-relationships="user-interacts-portal,admin-interacts-panel"]
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;


    admin-panel["Admin Panel"]:::node
    admin-actor["System Administrator"]:::node
    user-actor["User"]:::node
    web-portal["Web Portal"]:::node

    user-actor -->|User interacts with web portal| web-portal
    admin-actor -->|Admin interacts with admin panel| admin-panel



```

## Container Deployment [focus-relationships="services-deployed-container"]
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
%%{init: {"layout": "elk", "flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e1e4f0,stroke:#204485,stroke-dasharray: 5 4,stroke-width:1px,color:#000000;
classDef node fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef iface fill:#f0f0f0,stroke:#b6b6b6,stroke-width:1px,font-size:10px,color:#000000;
classDef highlight fill:#fdf7ec,stroke:#f0c060,stroke-width:1px,color:#000000;

        subgraph app-container["Application Container"]
        direction TB
            service-a["Service A"]:::node
            service-b["Service B"]:::node
        end
        class app-container boundary





```