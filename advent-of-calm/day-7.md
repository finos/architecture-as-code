# Day 7: Build a Complete E-Commerce Microservice Architecture

## Overview
Consolidate everything you've learned by building a realistic, complete microservice architecture from scratch.

## Objective and Rationale
- **Objective:** Create a new, comprehensive architecture representing a small e-commerce system with 6-8 nodes, multiple relationship types, interfaces, and rich metadata
- **Rationale:** Week 1 ends with synthesis. You've learned nodes (Day 2), relationships (Day 3), visualization (Day 4), interfaces (Day 5), and metadata (Day 6). Now you'll combine all these concepts to create something you could actually deploy and use as a reference architecture.

## Requirements

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

Use the CALM 1.0 schema and ensure it validates.
```

**Note:** CALM Chat mode is smart and will likely add some relationships automatically based on the node structure, even though you didn't explicitly ask for them. This is helpful AI assistance that saves time, but we want to review what it created before proceeding.

**Visualize what was created:**
1. Save the file (Ctrl+S / Cmd+S)
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. Look at what relationships were automatically added

This gives you a starting point, but you'll verify and adjust them in the next step.

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
1. **Save your file** (Ctrl+S / Cmd+S)
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. You should now see a complex microservice architecture with:
   - 8 nodes visualized
   - Multiple relationships showing different connection types
   - Clear visual distinction between actors, services, databases, and systems

**Take a screenshot** of your complete e-commerce architecture visualization!

### 5. Navigate the Architecture

Use the tree view to explore:

**Steps:**
1. Open the CALM sidebar (click CALM icon in Activity Bar)
2. Expand **Nodes** - you should see all 9 nodes
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
- 9 nodes total (2 actors, 4 services, 2 databases, 1 system)
- 8+ relationships
- Interfaces on all services and databases
- Metadata at multiple levels

### 8. Compare Architectures

You now have two complete architectures. Compare them:

**Prompt:**
```text
Compare my two architectures:
- architectures/my-first-architecture.json (Days 2-6, built incrementally)
- architectures/ecommerce-platform.json (Day 7, built all at once)

What did I learn? Which approach (incremental vs all-at-once) works better for different scenarios?
```

### 9. Update Your README

Update your README.md progress:
```markdown
- [x] Day 6: Document with Metadata
- [x] Day 7: Build Complete E-Commerce Architecture
```

```bash
git add architectures/ecommerce-platform.json README.md
git commit -m "Day 7: Build complete e-commerce microservice architecture with visualization"
git tag day-7
```

## Deliverables / Validation Criteria

Your Day 7 submission should include a commit tagged `day-7` containing:

✅ **Required Files:**
- `architectures/ecommerce-platform.json` - Complete, valid CALM architecture with:
  - 9 nodes (2 actors, 4 services, 2 databases, 1 system)
  - 8+ relationships (interacts, connects, composed-of)
  - Interfaces on all services and databases
  - Metadata at architecture, node, and relationship levels
- `docs/screenshots/day-7-ecommerce.png` - Visualization screenshot
- Updated `README.md` - Day 7 marked as complete

✅ **Validation:**
```bash
# Architecture validates without errors
calm validate -a architectures/ecommerce-platform.json

# Check git tag exists
git tag | grep -q "day-7"
```

## Resources
- [CALM Examples](https://github.com/finos/architecture-as-code/tree/main/calm/getting-started)
- [Microservice Architecture Patterns](https://microservices.io/patterns/index.html)

## Tips
- **Use the visualization constantly** - it helps you understand structure as you build
- **Build in stages** - nodes first, then relationships, then interfaces, then metadata
- **Save frequently** - see your architecture grow in the preview
- **Use tree view** - easier to navigate than scrolling JSON
- **Take screenshots** - document your progress visually
- This architecture becomes your **reference example** - keep it realistic

## Week 1 Recap

Congratulations! You've completed Week 1 and learned:

- ✅ **Day 1**: Set up tools and AI assistance
- ✅ **Day 2**: Create nodes (components)
- ✅ **Day 3**: Connect nodes with relationships
- ✅ **Day 4**: Visualize with VSCode extension
- ✅ **Day 5**: Define interfaces (how to connect)
- ✅ **Day 6**: Add metadata (who, what, when, why)
- ✅ **Day 7**: Synthesize everything into a complete architecture

You now have:
- A working CALM development environment with CLI and VSCode extension
- Two complete architectures (learning + e-commerce)
- Understanding of all core CALM concepts
- Visual diagrams of your architectures
- A portfolio piece you can share

## Next Steps

**Week 2 Preview**: Next week you'll learn:
- **Day 8**: Add controls for NFRs (security, performance, compliance)
- **Day 9**: Model business flows through your architecture
- **Day 10**: Link Architecture Decision Records (ADRs)
- **Day 11**: Generate documentation with docify
- **Day 12**: Use CALM as your expert architecture advisor
- **Day 13**: Use CALM as your expert operations advisor

Get ready to level up! 🚀
