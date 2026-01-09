---
id: 07-complete-architecture
title: "7. Build a Complete Architecture"
sidebar_position: 7
---

# Tutorial 7: Build a Complete E-Commerce Microservice Architecture

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

Complete Tutorials 1-6 first. You'll use all the skills you've learned:
- Nodes (Tutorial 2)
- Relationships (Tutorial 3)
- Visualization (Tutorial 4)
- Interfaces (Tutorial 5)
- Metadata (Tutorial 6)

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

**Take a screenshot** of your complete e-commerce architecture visualization!

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
- architectures/my-first-architecture.json (Tutorials 2-6, built incrementally)
- architectures/ecommerce-platform.json (Tutorial 7, built all at once)

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
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │    Admin    │──│  API Gateway │──│    Order Service    │    │
│  │   (actor)   │  └──────────────┘  └─────────────────────┘    │
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

You've completed the beginner tutorials! You now have two paths:

### Apply Your Skills: How-To Guides

Ready to tackle specific tasks? The **How-To Guides** show you how to accomplish common goals:

- [Define Controls](../../how-to/modeling/controls) - Add security and compliance requirements
- [Model Business Flows](../../how-to/modeling/flows) - Document workflow sequences
- [Generate Documentation](../../how-to/documentation/docify) - Create docs from your architecture
- [See all How-To Guides →](../../how-to/)

### Test Yourself: Challenges

Put your skills to the test with role-based challenges:

- [Enterprise Architect Challenge](../challenges/enterprise-architect) - Build a complete enterprise view
- [Product Developer Challenge](../challenges/product-developer) - Focus on implementation details
- [See all Challenges →](../challenges/)

## Resources

- [CALM Schema Reference](https://github.com/finos/architecture-as-code/tree/main/calm)
- [CALM CLI Documentation](https://github.com/finos/architecture-as-code/tree/main/cli)
- [FINOS Community Discussions](https://github.com/finos/architecture-as-code/discussions)
