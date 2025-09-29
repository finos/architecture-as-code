## Domain-Only View [node-types="domain" focus-nodes="order-domain,catalog-domain,customer-domain,inventory-domain,billing-domain"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;


    billing-domain["Billing Domain"]:::node
    catalog-domain["Catalog Domain"]:::node
    customer-domain["Customer Domain"]:::node
    inventory-domain["Inventory Domain"]:::node
    order-domain["Order Domain"]:::node

    order-domain -->|Needs product data| catalog-domain
    order-domain -->|Needs customer profile| customer-domain
    order-domain -->|Reserves inventory| inventory-domain
    order-domain -->|Requests payment authorization| billing-domain


    class order-domain highlight
    class catalog-domain highlight
    class customer-domain highlight
    class inventory-domain highlight
    class billing-domain highlight

```

## Full Architecture with Containers [include-containers="all" edges="connected"]
```mermaid
%%{init: {"flowchart": {"htmlLabels": false}}}%%
flowchart TB
classDef boundary fill:#f8fafc,stroke:#64748b,stroke-dasharray: 5 4,stroke-width:2px,color:#000;
classDef node fill:#ffffff,stroke:#1f2937,stroke-width:1px,color:#000;
classDef iface fill:#f1f5f9,stroke:#64748b,stroke-width:1px,font-size:10px,color:#000;
classDef highlight fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#000;

        subgraph commerce-platform["Commerce Platform"]
        direction TB
                subgraph billing-domain["Billing Domain"]
                direction TB
                    billing-svc["Billing Service"]:::node
                end
                class billing-domain boundary
                subgraph catalog-domain["Catalog Domain"]
                direction TB
                    catalog-svc["Catalog Service"]:::node
                end
                class catalog-domain boundary
                subgraph customer-domain["Customer Domain"]
                direction TB
                    customer-svc["Customer Service"]:::node
                end
                class customer-domain boundary
                subgraph inventory-domain["Inventory Domain"]
                direction TB
                    inventory-svc["Inventory Service"]:::node
                end
                class inventory-domain boundary
                subgraph order-domain["Order Domain"]
                direction TB
                    checkout-svc["Checkout Service"]:::node
                    order-svc["Order Service"]:::node
                    order-ui["Order UI"]:::node
                end
                class order-domain boundary
        end
        class commerce-platform boundary


    order-ui -->|User places order| order-svc
    order-svc -->|Fetch product details| catalog-svc
    order-svc -->|Retrieve customer profile| customer-svc
    order-svc -->|Reserve inventory| inventory-svc
    checkout-svc -->|Authorize payment| billing-svc
    order-domain -->|Needs product data| catalog-domain
    order-domain -->|Needs customer profile| customer-domain
    order-domain -->|Reserves inventory| inventory-domain
    order-domain -->|Requests payment authorization| billing-domain



```