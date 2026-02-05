## Classic Mode (Default)
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


    api-service["API Service"]:::node
    worker-queue["Background Jobs"]:::node
    user["Customer"]:::node
    load-balancer["Load Balancer"]:::node
    message-bus["Message Bus"]:::node
    payment-system["Payment System"]:::node
    database["PostgreSQL"]:::node
    redis-cache["Redis Cache"]:::node
    web-app["Web Application"]:::node

    user -->|User interacts with web app| web-app
    web-app -->|Web app calls API| api-service
    api-service -->|API queries database| database
    api-service -->|API publishes events| message-bus
    api-service -->|API calls payment service| payment-system
    api-service -->|API reads from cache| redis-cache
    web-app -->|Requests go through load balancer| load-balancer
    load-balancer -->|Load balancer routes to API| api-service
    api-service -->|API queues background jobs| worker-queue



```

## Node Type Shapes Mode [render-node-type-shapes=true]
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
classDef actor fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef database fill:#eef1ff,stroke:#2052a2,stroke-width:1px,color:#000000;
classDef webclient fill:#eef1ff,stroke:#156edf,stroke-width:1px,color:#000000;
classDef service fill:#eef1ff,stroke:#1c60c0,stroke-width:1px,color:#000000;
classDef messagebus fill:#eef1ff,stroke:#1c60c0,stroke-width:1px,color:#000000;
classDef system fill:#eef1ff,stroke:#204485,stroke-width:1px,color:#000000;


    api-service[/"⚙️ API Service"/]:::service
    worker-queue["Background Jobs"]:::node
    user([👤 Customer]):::actor
    load-balancer["Load Balancer"]:::node
    message-bus@{shape: h-cyl, label: "📨 Message Bus"}
    class message-bus messagebus
    payment-system[🏢 Payment System]:::system
    database[(🗄️ PostgreSQL)]:::database
    redis-cache["Redis Cache"]:::node
    web-app[[💻 Web Application]]:::webclient

    user -->|User interacts with web app| web-app
    web-app -->|Web app calls API| api-service
    api-service -->|API queries database| database
    api-service -->|API publishes events| message-bus
    api-service -->|API calls payment service| payment-system
    api-service -->|API reads from cache| redis-cache
    web-app -->|Requests go through load balancer| load-balancer
    load-balancer -->|Load balancer routes to API| api-service
    api-service -->|API queues background jobs| worker-queue



```

## Custom Node Type Mapping [render-node-type-shapes=true node-type-map]
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
classDef actor fill:#eef1ff,stroke:#007dff,stroke-width:1px,color:#000000;
classDef database fill:#eef1ff,stroke:#2052a2,stroke-width:1px,color:#000000;
classDef webclient fill:#eef1ff,stroke:#156edf,stroke-width:1px,color:#000000;
classDef service fill:#eef1ff,stroke:#1c60c0,stroke-width:1px,color:#000000;
classDef messagebus fill:#eef1ff,stroke:#1c60c0,stroke-width:1px,color:#000000;
classDef system fill:#eef1ff,stroke:#204485,stroke-width:1px,color:#000000;


    api-service[/"⚙️ API Service"/]:::service
    worker-queue@{shape: h-cyl, label: "📨 Background Jobs"}
    class worker-queue messagebus
    user([👤 Customer]):::actor
    load-balancer[/"⚙️ Load Balancer"/]:::service
    message-bus@{shape: h-cyl, label: "📨 Message Bus"}
    class message-bus messagebus
    payment-system[🏢 Payment System]:::system
    database[(🗄️ PostgreSQL)]:::database
    redis-cache[(🗄️ Redis Cache)]:::database
    web-app[[💻 Web Application]]:::webclient

    user -->|User interacts with web app| web-app
    web-app -->|Web app calls API| api-service
    api-service -->|API queries database| database
    api-service -->|API publishes events| message-bus
    api-service -->|API calls payment service| payment-system
    api-service -->|API reads from cache| redis-cache
    web-app -->|Requests go through load balancer| load-balancer
    load-balancer -->|Load balancer routes to API| api-service
    api-service -->|API queues background jobs| worker-queue



```