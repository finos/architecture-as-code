## Enterprise Trading System without Interfaces [render-interfaces=false include-containers="all" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph enterprise-bank["Enterprise Bank"]
        direction TB
                subgraph account-system["Account System"]
                direction TB
                    account-svc["Account Service"]:::node
                end
                class account-system boundary
                subgraph client-system["Client System"]
                direction TB
                    client-svc["Client Service"]:::node
                end
                class client-system boundary
                subgraph messaging-system["Messaging System"]
                direction TB
                    message-bus["Message Bus Kafka"]:::node
                end
                class messaging-system boundary
                subgraph position-system["Position System"]
                direction TB
                    position-svc["Position Service"]:::node
                end
                class position-system boundary
                subgraph product-system["Product System"]
                direction TB
                    product-svc["Product Service"]:::node
                end
                class product-system boundary
                subgraph reporting-system["Reporting System"]
                direction TB
                    reporting-svc["Reporting Service"]:::node
                end
                class reporting-system boundary
                subgraph risk-system["Risk System"]
                direction TB
                    risk-svc["Risk Service"]:::node
                end
                class risk-system boundary
                subgraph trading-system["Trading System"]
                direction TB
                    trade-svc["Trade Service"]:::node
                    trading-ui["Trading UI"]:::node
                end
                class trading-system boundary
        end
        class enterprise-bank boundary


    trading-ui -->|User places trades| trade-svc
    trade-svc -->|Update positions sync| position-svc
    trade-svc -->|Publish TradeEvent| message-bus
    message-bus -->|TradeEvent → Position| position-svc
    message-bus -->|TradeEvent → Accounting| account-svc
    message-bus -->|TradeEvent → Risk| risk-svc
    message-bus -->|TradeEvent → Reporting| reporting-svc
    trade-svc -->|Validate product| product-svc
    trade-svc -->|Fetch client info| client-svc



```

## Enterprise Trading System with Interfaces [render-interfaces=true include-containers="all" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph enterprise-bank["Enterprise Bank"]
        direction TB
                subgraph account-system["Account System"]
                direction TB
                    account-svc["Account Service"]:::node
                        account-svc__iface__account-api["◻ Account API"]:::iface
                end
                class account-system boundary
                subgraph client-system["Client System"]
                direction TB
                    client-svc["Client Service"]:::node
                        client-svc__iface__client-info["◻ Client Info API"]:::iface
                end
                class client-system boundary
                subgraph messaging-system["Messaging System"]
                direction TB
                    message-bus["Message Bus Kafka"]:::node
                        message-bus__iface__trade-events-topic["◻ Trade Events Topic"]:::iface
                end
                class messaging-system boundary
                subgraph position-system["Position System"]
                direction TB
                    position-svc["Position Service"]:::node
                        position-svc__iface__position-api["◻ Position API"]:::iface
                        position-svc__iface__position-updates["◻ Position Updates"]:::iface
                end
                class position-system boundary
                subgraph product-system["Product System"]
                direction TB
                    product-svc["Product Service"]:::node
                        product-svc__iface__product-lookup["◻ Product Lookup API"]:::iface
                end
                class product-system boundary
                subgraph reporting-system["Reporting System"]
                direction TB
                    reporting-svc["Reporting Service"]:::node
                        reporting-svc__iface__reports["◻ Reports API"]:::iface
                end
                class reporting-system boundary
                subgraph risk-system["Risk System"]
                direction TB
                    risk-svc["Risk Service"]:::node
                        risk-svc__iface__risk-check["◻ Risk Check API"]:::iface
                end
                class risk-system boundary
                subgraph trading-system["Trading System"]
                direction TB
                    trade-svc["Trade Service"]:::node
                        trade-svc__iface__trade-api["◻ Trade API"]:::iface
                        trade-svc__iface__trade-events["◻ Trade Events Publisher"]:::iface
                    trading-ui["Trading UI"]:::node
                        trading-ui__iface__web-ui["◻ Web Interface"]:::iface
                end
                class trading-system boundary
        end
        class enterprise-bank boundary


    trading-ui__iface__web-ui -->|User places trades| trade-svc__iface__trade-api
    trade-svc__iface__trade-api -->|Update positions sync| position-svc__iface__position-updates
    trade-svc__iface__trade-events -->|Publish TradeEvent| message-bus__iface__trade-events-topic
    message-bus__iface__trade-events-topic -->|TradeEvent → Position| position-svc__iface__position-api
    message-bus__iface__trade-events-topic -->|TradeEvent → Accounting| account-svc__iface__account-api
    message-bus__iface__trade-events-topic -->|TradeEvent → Risk| risk-svc__iface__risk-check
    message-bus__iface__trade-events-topic -->|TradeEvent → Reporting| reporting-svc__iface__reports
    trade-svc__iface__trade-api -->|Validate product| product-svc__iface__product-lookup
    trade-svc__iface__trade-api -->|Fetch client info| client-svc__iface__client-info

    trading-ui -.- trading-ui__iface__web-ui
    trade-svc -.- trade-svc__iface__trade-api
    trade-svc -.- trade-svc__iface__trade-events
    position-svc -.- position-svc__iface__position-api
    position-svc -.- position-svc__iface__position-updates
    account-svc -.- account-svc__iface__account-api
    product-svc -.- product-svc__iface__product-lookup
    client-svc -.- client-svc__iface__client-info
    risk-svc -.- risk-svc__iface__risk-check
    reporting-svc -.- reporting-svc__iface__reports
    message-bus -.- message-bus__iface__trade-events-topic


```