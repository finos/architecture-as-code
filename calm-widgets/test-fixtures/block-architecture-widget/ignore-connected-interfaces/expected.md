## Focus on payment-api with all interfaces rendered [focus-interfaces="payment-api" edges="connected" render-interfaces=true]
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


    fraud-service["Fraud Detection Service"]:::node
        fraud-service__iface__fraud-check-api["◻ fraud-check-api"]:::iface
        fraud-service__iface__risk-model-iface["◻ risk-model-iface"]:::iface
        fraud-service__iface__score-db-iface["◻ score-db-iface"]:::iface
    notification-service["Notification Service"]:::node
        notification-service__iface__email-iface["◻ email-iface"]:::iface
        notification-service__iface__sms-iface["◻ sms-iface"]:::iface
    payment-service["Payment Service"]:::node
        payment-service__iface__payment-api["◻ payment-api"]:::iface
        payment-service__iface__audit-log-iface["◻ audit-log-iface"]:::iface

    payment-service__iface__payment-api -->|Payment Service calls Fraud Detection before authorising a transaction| fraud-service__iface__fraud-check-api
    payment-service__iface__payment-api -->|Payment Service triggers notifications on transaction events| notification-service__iface__email-iface

    payment-service -.- payment-service__iface__payment-api
    payment-service -.- payment-service__iface__audit-log-iface
    fraud-service -.- fraud-service__iface__fraud-check-api
    fraud-service -.- fraud-service__iface__risk-model-iface
    fraud-service -.- fraud-service__iface__score-db-iface
    notification-service -.- notification-service__iface__email-iface
    notification-service -.- notification-service__iface__sms-iface


```

## Focus on payment-api ignoring connected node interfaces [focus-interfaces="payment-api" edges="connected" render-interfaces=true ignore-connected-interfaces=true]
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


    fraud-service["Fraud Detection Service"]:::node
        fraud-service__iface__fraud-check-api["◻ fraud-check-api"]:::iface
    notification-service["Notification Service"]:::node
        notification-service__iface__email-iface["◻ email-iface"]:::iface
    payment-service["Payment Service"]:::node
        payment-service__iface__payment-api["◻ payment-api"]:::iface

    payment-service__iface__payment-api -->|Payment Service calls Fraud Detection before authorising a transaction| fraud-service__iface__fraud-check-api
    payment-service__iface__payment-api -->|Payment Service triggers notifications on transaction events| notification-service__iface__email-iface

    payment-service -.- payment-service__iface__payment-api
    fraud-service -.- fraud-service__iface__fraud-check-api
    notification-service -.- notification-service__iface__email-iface


```