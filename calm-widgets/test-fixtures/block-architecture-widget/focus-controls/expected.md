## Default Architecture (No Focus)
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    api-service["API Service"]:::node
    database-server["Database Server"]:::node
    frontend-app["Frontend Application"]:::node
    payment-processor["Payment Processing Service"]:::node
    web-server["Web Server"]:::node

    web-server -->|Web server connects to API service| api-service
    api-service -->|API service connects to database| database-server
    frontend-app -->|Frontend connects to payment processor| payment-processor



```

## Focus by Exact Control ID with No Edges [focus-controls="security-hardening" edges="none"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    web-server["Web Server"]:::node




```

## Focus by Exact Control ID with Connected Edges [focus-controls="security-hardening" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    api-service["API Service"]:::node
    web-server["Web Server"]:::node

    web-server -->|Web server connects to API service| api-service



```

## Focus by Shared Control [focus-controls="authentication"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    api-service["API Service"]:::node
    database-server["Database Server"]:::node
    web-server["Web Server"]:::node

    web-server -->|Web server connects to API service| api-service
    api-service -->|API service connects to database| database-server



```

## Focus by Compliance Standard [focus-controls="GDPR"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;






```

## Focus by Multiple Relationship Controls [focus-controls="api-gateway-security,data-pipeline-security"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    frontend-app["Frontend Application"]:::node
    payment-processor["Payment Processing Service"]:::node

    frontend-app -->|Frontend connects to payment processor| payment-processor



```

## Focus by Multiple Text Search [focus-controls="OAuth2,TLS 1.3,enterprise.com"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    api-service["API Service"]:::node
    frontend-app["Frontend Application"]:::node
    payment-processor["Payment Processing Service"]:::node
    web-server["Web Server"]:::node

    web-server -->|Web server connects to API service| api-service
    frontend-app -->|Frontend connects to payment processor| payment-processor



```