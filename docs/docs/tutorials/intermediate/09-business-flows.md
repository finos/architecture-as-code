---
id: 09-business-flows
title: "Model Business Flows"
sidebar_position: 3
---

# Model Business Flows

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Map business processes to technical architecture using flows, connecting business intent to implementation.

## Learning Objectives

By the end of this tutorial, you will:
- Understand the structure of CALM flows and transitions
- Create flows that trace business processes through your architecture
- Use bidirectional transitions to model request-response patterns
- Visualize flows as sequence diagrams in the VSCode extension
- Optionally attach flow-level controls for compliance

## Prerequisites

Complete [Controls for Non-Functional Requirements](./08-controls) first.

## Step-by-Step Guide

### 1. Understand Flows

Flows consist of:
- **unique-id:** Identifier for the flow
- **name:** Business process name
- **description:** What the flow represents
- **transitions:** Ordered steps referencing relationships
  - `relationship-unique-id`: Which connection is used
  - `sequence-number`: Order in the flow (1, 2, 3…)
  - `description`: What happens in this step
  - `direction`: `source-to-destination` or `destination-to-source`

### 2. Map Your E-Commerce Order Flow

Open `architectures/ecommerce-platform.json`.

First, identify the relationship unique-ids from your Day 7 architecture that form the order flow path:
- Customer → API Gateway (interacts relationship)
- API Gateway → Order Service (connects relationship)
- Order Service → Payment Service (connects relationship)

**Prompt:**
```text
Add a flows array at the top level of architectures/ecommerce-platform.json (after controls, before nodes).

Create a flow with:
- unique-id: "order-processing-flow"
- name: "Customer Order Processing"
- description: "End-to-end flow from customer placing an order to payment confirmation"
- transitions array referencing the ACTUAL relationship unique-ids from my architecture:
  1. The customer-to-gateway interacts relationship, sequence-number: 1, description: "Customer submits order via web interface", direction: "source-to-destination"
  2. The gateway-to-order-service connects relationship, sequence-number: 2, description: "API Gateway routes order to Order Service", direction: "source-to-destination"
  3. The order-service-to-payment-service connects relationship, sequence-number: 3, description: "Order Service initiates payment processing", direction: "source-to-destination"

Look up the exact relationship unique-ids from my relationships array and use those.
```

> **Note:** Your relationship unique-ids may differ based on how Copilot named them in Day 7. The AI will look up your actual IDs.

### 3. Validate Flow Structure

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 4. Add a Second Flow: Inventory Stock Check

**Prompt:**
```text
Add a second flow to the flows array in architectures/ecommerce-platform.json:

- unique-id: "inventory-check-flow"
- name: "Inventory Stock Check"
- description: "Admin checks and updates inventory stock levels"
- transitions using the ACTUAL relationship unique-ids from my architecture:
  1. Admin → API Gateway (interacts): "Admin requests inventory status", direction: "source-to-destination"
  2. API Gateway → Inventory Service (connects): "Route to inventory service", direction: "source-to-destination"
  3. Inventory Service → Inventory Database (connects): "Query current stock levels", direction: "source-to-destination"
  4. Inventory Database → Inventory Service (same relationship): "Return stock data", direction: "destination-to-source"
  5. Inventory Service → API Gateway (same relationship): "Return inventory report", direction: "destination-to-source"

Look up the exact relationship unique-ids from my relationships array.
```

> **Tip:** Notice how steps 4 and 5 reuse the same relationships but with `destination-to-source` direction — this models the response flowing back.

### 5. Visualize Flows

Flows appear in the CALM Model Elements view and can be visualized as sequence diagrams.

**Steps:**
1. Save `architectures/ecommerce-platform.json`
2. Open the **CALM Model Elements** view in the sidebar
3. Expand the **Flows** section — you should see your two flows listed
4. Click on a flow (e.g., `order-processing-flow`)
5. The preview will show both the architecture diagram and a **sequence diagram** showing the flow's transitions in order

### 6. Add Flow Controls (Optional Advanced)

Flows can have their own controls.

**Prompt:**
```text
Add a controls section to the order-processing-flow in architectures/ecommerce-platform.json:

Add an "audit" control with:
- description: "All order processing steps must be logged for audit compliance"
- requirements:
  - requirement-url: "https://internal-policy.example.com/audit/transaction-logging"
    config (inline): { "log-level": "detailed", "retention-days": 365 }
```

### 7. Commit Your Work

```bash
git add architectures/ecommerce-platform.json
git commit -m "Day 9: Model order processing and inventory check flows"
git tag day-9
```

## Key Concepts

### Flow Structure

```json
{
  "flows": [
    {
      "unique-id": "order-processing-flow",
      "name": "Customer Order Processing",
      "description": "End-to-end flow from order to payment",
      "transitions": [
        {
          "relationship-unique-id": "customer-to-gateway",
          "sequence-number": 1,
          "description": "Customer submits order",
          "direction": "source-to-destination"
        }
      ]
    }
  ]
}
```

### Bidirectional Transitions

The same relationship can appear multiple times in a flow with different directions to model request-response:

```json
{ "relationship-unique-id": "svc-to-db", "sequence-number": 3, "direction": "source-to-destination" },
{ "relationship-unique-id": "svc-to-db", "sequence-number": 4, "direction": "destination-to-source" }
```

### When to Use Flows

- Tracing a business capability end-to-end
- Impact analysis ("which services are in my order flow?")
- Generating sequence diagrams for documentation
- Attaching compliance controls to a specific process

## Resources

- [CALM Flow Schema](https://github.com/finos/architecture-as-code/blob/main/calm/draft/2025-03/meta/flow.json)
- [Flow Examples](https://github.com/finos/architecture-as-code/tree/main/calm/release)

## Next Steps

In the [next tutorial](./10-adr-linking), you'll link Architecture Decision Records to your architecture to create traceability from decisions to implementation!
