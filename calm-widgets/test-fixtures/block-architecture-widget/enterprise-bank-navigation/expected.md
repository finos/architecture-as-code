# Block Architecture — Navigation Example (Permutation Test)

This page demonstrates **Mermaid diagrams with clickable nodes** and many permutations.
⚠️ Note: GitHub issue rendering ignores `click`, but if you copy/paste into a `.mmd` file or a markdown site with Mermaid enabled, clicking works.

---

## Trading System without Interfaces [render-interfaces=false focus-nodes="trade-svc,trading-ui,trading-db,message-bus" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    message-bus["Message Bus"]:::node
    trade-svc["Trade Service"]:::node
    trading-db["Trading DB"]:::node
    trading-ui["Trading UI"]:::node

    trading-ui -->|Place Trade| trade-svc
    trade-svc -->|Persist| trading-db
    trade-svc -->|Publish Events| message-bus


    class trade-svc highlight
    class trading-ui highlight
    class trading-db highlight
    class message-bus highlight
        click message-bus "#message-bus" "Jump to Message Bus"
        
        
        click trade-svc "#trade-service" "Jump to Trade Service"
        
        
        click trading-db "#trading-db" "Jump to Trading DB"
        
        
        click trading-ui "#trading-ui" "Jump to Trading UI"
        
        

```

## Trading System with Interfaces [render-interfaces=true focus-nodes="trade-svc,trading-ui,trading-db,message-bus" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    message-bus["Message Bus"]:::node
        message-bus__iface__trade-events-topic["◻ Trade Events Topic"]:::iface
    trade-svc["Trade Service"]:::node
        trade-svc__iface__api["◻ API: /trades"]:::iface
        trade-svc__iface__jdbc["◻ JDBC: trading-db"]:::iface
        trade-svc__iface__events["◻ Topic: trade.events"]:::iface
    trading-db["Trading DB"]:::node
        trading-db__iface__sql["◻ SQL Interface"]:::iface
    trading-ui["Trading UI"]:::node
        trading-ui__iface__web-ui["◻ Web Interface"]:::iface

    trading-ui__iface__web-ui -->|Place Trade| trade-svc__iface__api
    trade-svc__iface__jdbc -->|Persist| trading-db__iface__sql
    trade-svc__iface__events -->|Publish Events| message-bus__iface__trade-events-topic

    trading-ui -.- trading-ui__iface__web-ui
    trade-svc -.- trade-svc__iface__api
    trade-svc -.- trade-svc__iface__jdbc
    trade-svc -.- trade-svc__iface__events
    trading-db -.- trading-db__iface__sql
    message-bus -.- message-bus__iface__trade-events-topic

    class trade-svc highlight
    class trading-ui highlight
    class trading-db highlight
    class message-bus highlight
        click message-bus "#message-bus" "Jump to Message Bus"
        click message-bus__iface__trade-events-topic "#message-bus__iface__trade-events-topic" "Jump to ◻ Trade Events Topic"
                
        
        click trade-svc "#trade-service" "Jump to Trade Service"
        click trade-svc__iface__api "#trade-service-api" "Jump to ◻ API: /trades"
        click trade-svc__iface__jdbc "#trade-service-storage" "Jump to ◻ JDBC: trading-db"
        click trade-svc__iface__events "#trade-service-events" "Jump to ◻ Topic: trade.events"
        
        
        click trading-db "#trading-db" "Jump to Trading DB"
        click trading-db__iface__sql "#trading-db__iface__sql" "Jump to ◻ SQL Interface"
                
        
        click trading-ui "#trading-ui" "Jump to Trading UI"
        click trading-ui__iface__web-ui "#trading-ui__iface__web-ui" "Jump to ◻ Web Interface"
                
        

```

# Details (Anchor Targets)

## Trading System
Some notes about the **Trading System**.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Position System
Some notes about the **Position System**.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.

## Messaging System
Some notes about the **Messaging System**.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi.

## Trading UI
Details about **Trading UI**.

Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.

## Trade Service
Details about **Trade Service**.

Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.

### Trade Service API
Details about the **API interface**.

Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.

### Trade Service Storage
Details about the **storage interface**.

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?

### Trade Service Events
Details about the **events interface**.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Trading DB
Details about **Trading DB**.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## Message Bus
Details about **Message Bus**.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?