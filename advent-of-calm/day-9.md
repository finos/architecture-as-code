# Day 9: Model a Business Flow

## Overview
Map business processes to technical architecture using flows, connecting business intent to implementation.

## Objective and Rationale
- **Objective:** Create a flow that traces an order processing business process across your e-commerce architecture
- **Rationale:** Flows bridge business and technology by showing how business processes map to technical components. Essential for business-IT alignment, impact analysis, and understanding system behavior.

## Requirements

### 1. Understand Flows

Flows consist of:
- **unique-id:** Identifier for the flow
- **name:** Business process name
- **description:** What the flow represents
- **transitions:** Ordered steps referencing relationships
  - `relationship-unique-id`: Which connection is used
  - `sequence-number`: Order in the flow (1, 2, 3...)
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

### 4. Add a Second Flow: User Authentication

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

> **Tip:** Notice how steps 4 and 5 reuse the same relationships but with `destination-to-source` direction - this models the response flowing back.

### 5. Visualize Flows

Flows appear in the CALM Model Elements view and can be visualized as sequence diagrams.

**Steps:**
1. Save `architectures/ecommerce-platform.json`
2. Open the **CALM Model Elements** view in the sidebar
3. Expand the **Flows** section - you should see your two flows listed
4. Click on a flow (e.g., `order-processing-flow`)
5. The preview will now show both:
   - The architecture diagram (as before)
   - A **sequence diagram** showing the flow's transitions in order
6. **Take a screenshot** showing the architecture with the flow sequence diagram

### 6. Add Flow Controls (Optional Advanced)

Flows can have their own controls!

**Prompt:**
```text
Add a controls section to the order-processing-flow in architectures/ecommerce-platform.json:

Add an "audit" control with:
- description: "All order processing steps must be logged for audit compliance"
- requirements:
  - requirement-url: "https://internal-policy.example.com/audit/transaction-logging"
    config (inline): { "log-level": "detailed", "retention-days": 365 }
```

### 7. Document Your Flows

For the purposes of your learning record, create a document detailing the purpose of flows and their detail.

Later on in your Advent of CALM journey we will explore getting CALM to create documentation detailing your architecture and its flows.

**File:** `docs/flows-guide.md`

**Content:**
```markdown
# Business Flows

## Order Processing Flow

**ID:** order-processing-flow  
**Purpose:** Track customer orders from placement to payment

### Steps
1. Customer submits order (Customer → API Gateway)
2. Route to order processing (API Gateway → Order Service)
3. Initiate payment (Order Service → Payment Service)

### Controls
- Transaction logging required for audit compliance

## Inventory Check Flow

**ID:** inventory-check-flow  
**Purpose:** Admin checks and updates inventory stock levels

### Steps
1. Admin requests inventory status (Admin → API Gateway)
2. Route to inventory service (API Gateway → Inventory Service)
3. Query current stock (Inventory Service → Inventory Database)
4. Return stock data (response flow)
5. Return inventory report (response flow)

## Benefits

- **Business Alignment:** Maps technical architecture to business processes
- **Impact Analysis:** Understand which components are involved in each business capability
- **Compliance:** Attach specific controls to business-critical flows
- **Documentation:** Auto-generate flow diagrams and descriptions
```

### 8. Update Your README

Mark Day 9 as complete in your README checklist and mention the new flow artifacts (`docs/flows-guide.md`) so collaborators know where they can explore the business process context.

### 9. Commit Your Work

```bash
git add architectures/ecommerce-platform.json docs/flows-guide.md README.md
git commit -m "Day 9: Model order processing and inventory check flows"
git tag day-9
```

## Deliverables

✅ **Required:**
- `architectures/ecommerce-platform.json` - With 2+ flows
- `docs/flows-guide.md` - Flow documentation
- Screenshots of flow visualization
- Updated `README.md` - Day 9 marked complete

✅ **Validation:**
```bash
# Verify flows exist
grep -q '"flows"' architectures/ecommerce-platform.json

# Check both flows
grep -q 'order-processing-flow' architectures/ecommerce-platform.json
grep -q 'inventory-check-flow' architectures/ecommerce-platform.json

# Validate
calm validate -a architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-9"
```

## Resources

- [CALM Flow Schema](https://github.com/finos/architecture-as-code/blob/main/calm/draft/2025-03/meta/flow.json)
- [Flow Examples](https://github.com/finos/architecture-as-code/tree/main/calm/release)

## Tips

- Flows are ordered - sequence-number matters
- Use bidirectional transitions for request-response patterns
- Flows can reference the same relationships multiple times
- Add flow-specific controls for critical business processes
- Use meaningful descriptions that describe business intent, not just technical details

## Next Steps
Tomorrow (Day 10) you'll link your architecture to Architecture Decision Records (ADRs)!
