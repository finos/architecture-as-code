## Custom Theme Colors
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#e0f7fa,stroke:#00838f,stroke-width:2px,stroke-dasharray: 5 4,color:#000;
classDef node fill:#ffffff,stroke:#01579b,stroke-width:1px,color:#000;
classDef iface fill:#b3e5fc,stroke:#01579b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fff9c4,stroke:#f57f17,stroke-width:2px,color:#000;
classDef actor fill:#c5e1a5,stroke:#558b2f,stroke-width:2px,color:#000;
classDef service fill:#ffccbc,stroke:#d84315,stroke-width:2px,color:#000;


    user([👤 User]):::actor
    app[/"⚙️ Application"/]:::service

    user --> app


```
