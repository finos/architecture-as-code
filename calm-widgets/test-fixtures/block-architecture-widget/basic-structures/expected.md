## Container Composition with No Edges [include-containers="all" edges="none"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph system-a["System A"]
        direction TB
            svc1["Service 1"]:::node
            svc2["Service 2"]:::node
        end
        class system-a boundary
        subgraph system-b["System B"]
        direction TB
            svc3["Service 3"]:::node
        end
        class system-b boundary





```

## Single System with Seeded Edges [focus-nodes="system-a" include-children="all" edges="seeded"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph system-a["System A"]
        direction TB
            svc1["Service 1"]:::node
            svc2["Service 2"]:::node
        end
        class system-a boundary


    svc1 -->|Service 1 calls Service 2| svc2


    class system-a highlight

```

## Single System with Connected Edges [focus-nodes="system-a" include-children="all" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph system-a["System A"]
        direction TB
            svc1["Service 1"]:::node
            svc2["Service 2"]:::node
        end
        class system-a boundary
        subgraph system-b["System B"]
        direction TB
            svc3["Service 3"]:::node
        end
        class system-b boundary


    svc1 -->|Service 1 calls Service 2| svc2
    svc2 -->|Service 2 integrates with Service 3| svc3


    class system-a highlight

```

## Multiple Systems with All Connections [include-containers="all" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": true, "curve": "basis", "padding": 15, "nodeSpacing": 40, "rankSpacing": 60, "useMaxWidth": true}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph system-a["System A"]
        direction TB
            svc1["Service 1"]:::node
            svc2["Service 2"]:::node
        end
        class system-a boundary
        subgraph system-b["System B"]
        direction TB
            svc3["Service 3"]:::node
        end
        class system-b boundary


    svc1 -->|Service 1 calls Service 2| svc2
    svc2 -->|Service 2 integrates with Service 3| svc3



```