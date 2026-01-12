---
id: 07-complete-architecture
title: "Build a Complete Architecture"
sidebar_position: 7
---

# Build a Complete E-Commerce Microservice Architecture

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 45-60 minutes

## Overview

Consolidate everything you've learned by building a realistic, complete microservice architecture from scratch.

## Learning Objectives

By the end of this tutorial, you will:
- Combine all CALM concepts into a comprehensive architecture
- Create a realistic e-commerce system with multiple services
- Practice the complete workflow from design to validation
- Have a reference architecture to use in future tutorials

## Prerequisites

Complete the previous tutorials first. You'll use all the skills you've learned:
- Nodes
- Relationships
- Visualization
- Interfaces
- Metadata

## Step-by-Step Guide

### 1. The System to Build

You'll create an **Order Processing System** with these components:

**Actors:**
- Customer (places orders)
- Admin (manages inventory)

**Services:**
- API Gateway (public entry point)
- Order Service (manages orders)
- Inventory Service (tracks stock)
- Payment Service (processes payments)

**Databases:**
- Order Database (stores orders)
- Inventory Database (stores product stock)

**System:**
- E-Commerce Platform (contains all services)

This gives you a realistic microservice architecture with multiple interaction patterns.

### 2. Create the New Architecture File

Start fresh to practice everything from scratch.

**Prompt:**
```text
Create a new file at architectures/ecommerce-platform.json

This should be a complete CALM architecture for an e-commerce order processing system with:

1. Top-level metadata:
   - owner: your email
   - version: "1.0.0"
   - created: today's date
   - description: "E-commerce order processing platform"
   - tags: ["ecommerce", "microservices", "orders"]

2. Actor nodes:
   - Customer actor
   - Admin actor

3. Service nodes:
   - API Gateway (node-type: "service")
   - Order Service
   - Inventory Service  
   - Payment Service

4. Database nodes:
   - Order Database
   - Inventory Database

5. System node:
   - E-Commerce Platform (contains all services)

Each node should have:
- All required properties (unique-id, node-type, name, description)
- At least one interface where appropriate (services and databases)
- Metadata (owner, repository placeholder, deployment-type, etc.)

Use the CALM 1.1 schema and ensure it validates.
```

:::note
CALM Chat mode is smart and will likely add some relationships automatically based on the node structure, even though you didn't explicitly ask for them. This is helpful AI assistance, but review what it created before proceeding.
:::

**Visualize what was created:**
1. Save the file (`Ctrl+S` / `Cmd+S`)
2. Open preview (`Ctrl+Shift+C` / `Cmd+Shift+C`)
3. Look at what relationships were automatically added

### 3. Verify and Adjust the Relationships

Now verify the relationships match what we want.

**Prompt:**
```text
Update architectures/ecommerce-platform.json to ensure it has exactly these relationships:

1. Interacts relationships (actor to service):
   - Customer interacts with API Gateway
   - Admin interacts with API Gateway

2. Connects relationships (service to service, service to database):
   - API Gateway connects to Order Service
   - API Gateway connects to Inventory Service
   - Order Service connects to Order Database
   - Order Service connects to Payment Service
   - Inventory Service connects to Inventory Database

3. Composed-of relationship:
   - E-Commerce Platform is composed of: API Gateway, Order Service, Inventory Service, Payment Service, Order Database, Inventory Database

Check the existing relationships and:
- Add any that are missing from the list above
- Remove any that don't match the requirements
- Ensure each relationship has a unique-id and description
- Ensure the appropriate relationship type is used
- Ensure connects relationships reference specific interfaces
- Add metadata where relevant (SLAs, monitoring, etc.)

Ensure the file validates.
```

### 4. Visualize the Complete Architecture

This is where the VSCode extension really shines:

**Steps:**
1. **Save your file** (`Ctrl+S` / `Cmd+S`)
2. Open preview (`Ctrl+Shift+C` / `Cmd+Shift+C`)
3. You should now see a complex microservice architecture with:
   - 8 nodes visualized
   - Multiple relationships showing different connection types
   - Clear visual distinction between actors, services, databases, and systems

### 5. Navigate the Architecture

Use the tree view to explore:

**Steps:**
1. Open the CALM sidebar (click CALM icon in Activity Bar)
2. Expand **Nodes** - you should see all 8+ nodes
3. Expand **Relationships** - you should see all 8+ relationships
4. Click on different elements to see them in the diagram
5. Use **search** to find specific nodes (try searching "order")

**This is much easier than scrolling through 200+ lines of JSON!**

### 6. Refine Using Visual Feedback

As you look at the visualization, you might notice improvements:

**Prompt:**
```text
Looking at the visualization of my e-commerce architecture, suggest improvements:
- Are there missing connections?
- Should any relationships use different types?
- Are the interfaces complete?
- Is the metadata comprehensive?
```

Make any suggested improvements, save, and watch the diagram update.

### 7. Validate the Complete Architecture

```bash
calm validate -a architectures/ecommerce-platform.json
```

You should see:
- ✅ No validation errors
- 8+ nodes total (2 actors, 4 services, 2 databases, 1 system)
- 8+ relationships
- Interfaces on all services and databases
- Metadata at multiple levels

### 8. Compare Architectures

You now have two complete architectures. Compare them:

**Prompt:**
```text
Compare my two architectures:
- architectures/my-first-architecture.json
- architectures/ecommerce-platform.json (this tutorial, built all at once)

What did I learn? Which approach (incremental vs all-at-once) works better for different scenarios?
```

## Congratulations! 🎉

You've completed the Beginner Tutorials! You now have the foundational skills to:

✅ **Create** nodes representing architectural components  
✅ **Connect** nodes with appropriate relationship types  
✅ **Visualize** architectures with the VSCode extension  
✅ **Define** interfaces for integration points  
✅ **Document** with metadata for governance  
✅ **Build** complete, realistic architectures  

## Architecture Summary

Your e-commerce architecture should look something like this:

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-Commerce Platform                          │
│  ┌─────────────┐                                                │
│  │   Customer  │──────┐                                         │
│  │   (actor)   │      │ interacts                               │
│  └─────────────┘      │                                         │
│                       ▼                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐     │
│  │    Admin    │──│  API Gateway │──│    Order Service    │     │
│  │   (actor)   │  └──────────────┘  └─────────────────────┘     │
│  └─────────────┘         │                    │                 │
│                          │                    ├──► Order DB     │
│                          │                    │                 │
│                          │                    └──► Payment Svc  │
│                          ▼                                      │
│                  ┌────────────────┐                             │
│                  │ Inventory Svc  │──► Inventory DB             │
│                  └────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## What's Next?

🎉 **Congratulations!** You've completed the beginner tutorials and can now model complete architectures with CALM.

**Continue Learning:**
- Explore the [Core Concepts](/docs/core-concepts/) for deeper understanding
- Check out [Working with CALM](/docs/working-with-calm/) for CLI and tooling details
- Join the [FINOS Architecture as Code community](https://github.com/finos/architecture-as-code/discussions)

## Complete Reference Example

Here's a complete, validated e-commerce architecture you can use as a reference:

<details>
<summary>📄 Complete ecommerce-platform.json (click to expand)</summary>

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "metadata": {
    "owner": "platform-team@example.com",
    "version": "1.0.0",
    "created": "2026-01-09",
    "description": "E-commerce order processing platform",
    "tags": ["ecommerce", "microservices", "orders"],
    "status": "production"
  },
  "nodes": [
    {
      "unique-id": "customer",
      "node-type": "actor",
      "name": "Customer",
      "description": "End user who browses products and places orders"
    },
    {
      "unique-id": "admin",
      "node-type": "actor",
      "name": "Admin",
      "description": "Administrator who manages inventory and monitors orders"
    },
    {
      "unique-id": "api-gateway",
      "node-type": "service",
      "name": "API Gateway",
      "description": "Public entry point for all client requests, handles routing and authentication",
      "interfaces": [
        {
          "unique-id": "gateway-https",
          "protocol": "HTTPS",
          "host": "api.ecommerce.example.com",
          "port": 443
        }
      ],
      "metadata": {
        "tech-owner": "platform-team@example.com",
        "repository": "https://github.com/example/api-gateway",
        "deployment-type": "kubernetes",
        "sla-tier": "tier-1"
      }
    },
    {
      "unique-id": "order-service",
      "node-type": "service",
      "name": "Order Service",
      "description": "Manages order lifecycle from creation to fulfillment",
      "interfaces": [
        {
          "unique-id": "order-api",
          "protocol": "HTTPS",
          "port": 8080
        }
      ],
      "metadata": {
        "tech-owner": "orders-team@example.com",
        "repository": "https://github.com/example/order-service",
        "deployment-type": "kubernetes"
      }
    },
    {
      "unique-id": "inventory-service",
      "node-type": "service",
      "name": "Inventory Service",
      "description": "Tracks product stock levels and availability",
      "interfaces": [
        {
          "unique-id": "inventory-api",
          "protocol": "HTTPS",
          "port": 8081
        }
      ],
      "metadata": {
        "tech-owner": "inventory-team@example.com",
        "repository": "https://github.com/example/inventory-service",
        "deployment-type": "kubernetes"
      }
    },
    {
      "unique-id": "payment-service",
      "node-type": "service",
      "name": "Payment Service",
      "description": "Processes payment transactions securely",
      "interfaces": [
        {
          "unique-id": "payment-api",
          "protocol": "HTTPS",
          "port": 8082
        }
      ],
      "metadata": {
        "tech-owner": "payments-team@example.com",
        "repository": "https://github.com/example/payment-service",
        "deployment-type": "kubernetes",
        "pci-compliant": true
      }
    },
    {
      "unique-id": "order-database",
      "node-type": "database",
      "name": "Order Database",
      "description": "PostgreSQL database storing order records and history",
      "interfaces": [
        {
          "unique-id": "order-db-jdbc",
          "protocol": "JDBC",
          "port": 5432
        }
      ],
      "metadata": {
        "database-type": "PostgreSQL",
        "version": "15",
        "backup-frequency": "daily"
      }
    },
    {
      "unique-id": "inventory-database",
      "node-type": "database",
      "name": "Inventory Database",
      "description": "PostgreSQL database storing product inventory levels",
      "interfaces": [
        {
          "unique-id": "inventory-db-jdbc",
          "protocol": "JDBC",
          "port": 5433
        }
      ],
      "metadata": {
        "database-type": "PostgreSQL",
        "version": "15",
        "backup-frequency": "daily"
      }
    },
    {
      "unique-id": "ecommerce-platform",
      "node-type": "system",
      "name": "E-Commerce Platform",
      "description": "Complete e-commerce order processing system"
    }
  ],
  "relationships": [
    {
      "unique-id": "customer-to-gateway",
      "description": "Customer accesses the platform through the API Gateway",
      "relationship-type": {
        "interacts": {
          "actor": "customer",
          "nodes": ["api-gateway"]
        }
      }
    },
    {
      "unique-id": "admin-to-gateway",
      "description": "Admin accesses the platform through the API Gateway",
      "relationship-type": {
        "interacts": {
          "actor": "admin",
          "nodes": ["api-gateway"]
        }
      }
    },
    {
      "unique-id": "gateway-to-orders",
      "description": "API Gateway routes order requests to Order Service",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "api-gateway",
            "interfaces": ["gateway-https"]
          },
          "destination": {
            "node": "order-service",
            "interfaces": ["order-api"]
          }
        }
      },
      "metadata": {
        "latency-sla": "100ms",
        "protocol": "REST"
      }
    },
    {
      "unique-id": "gateway-to-inventory",
      "description": "API Gateway routes inventory requests to Inventory Service",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "api-gateway",
            "interfaces": ["gateway-https"]
          },
          "destination": {
            "node": "inventory-service",
            "interfaces": ["inventory-api"]
          }
        }
      },
      "metadata": {
        "latency-sla": "100ms",
        "protocol": "REST"
      }
    },
    {
      "unique-id": "orders-to-database",
      "description": "Order Service persists order data to the database",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "order-service",
            "interfaces": ["order-api"]
          },
          "destination": {
            "node": "order-database",
            "interfaces": ["order-db-jdbc"]
          }
        }
      },
      "metadata": {
        "connection-pool-size": 20
      }
    },
    {
      "unique-id": "orders-to-payment",
      "description": "Order Service calls Payment Service to process payments",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "order-service",
            "interfaces": ["order-api"]
          },
          "destination": {
            "node": "payment-service",
            "interfaces": ["payment-api"]
          }
        }
      },
      "metadata": {
        "latency-sla": "500ms",
        "retry-policy": "exponential-backoff"
      }
    },
    {
      "unique-id": "inventory-to-database",
      "description": "Inventory Service persists stock data to the database",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "inventory-service",
            "interfaces": ["inventory-api"]
          },
          "destination": {
            "node": "inventory-database",
            "interfaces": ["inventory-db-jdbc"]
          }
        }
      },
      "metadata": {
        "connection-pool-size": 20
      }
    },
    {
      "unique-id": "platform-composition",
      "description": "E-Commerce Platform contains all services and databases",
      "relationship-type": {
        "composed-of": {
          "container": "ecommerce-platform",
          "nodes": [
            "api-gateway",
            "order-service",
            "inventory-service",
            "payment-service",
            "order-database",
            "inventory-database"
          ]
        }
      }
    }
  ]
}
```

</details>

:::tip Validate the Example
You can copy this JSON to test validation:
```bash
calm validate -a architectures/ecommerce-platform.json
```
You should see no errors and no warnings.
:::

## Resources

- [CALM Schema Reference](https://calm.finos.org/release/1.1/meta/calm.json)
- [CALM CLI Documentation](https://github.com/finos/architecture-as-code/tree/main/cli)
- [FINOS Community Discussions](https://github.com/finos/architecture-as-code/discussions)
