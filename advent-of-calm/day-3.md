# Day 3: Connect Nodes with Relationships

## Overview
Expand your architecture by adding multiple nodes and different relationship types to show how they connect, interact, and compose.

## Objective and Rationale
- **Objective:** Add multiple nodes and create different types of relationships (interacts, connects, composed-of) to understand how CALM models architectural connections
- **Rationale:** Architectures are about connections, not just components. Different relationship types serve different purposes. Understanding when to use each type and the `oneOf` constraint pattern is critical for CALM mastery.

## Requirements

### 1. Understand Relationship Types

CALM supports four core relationship types (you can only use **one** per relationship):

- **interacts**: Actor/human interactions with services (e.g., user → web application)
- **connects**: Infrastructure/technical connections (e.g., service → database, service → message queue)
- **deployed-in**: Deployment topology (e.g., service → cluster/region) - *we'll cover this later in the Advent of CALM*
- **composed-of**: Hierarchical composition (e.g., system → services)

Today we'll work with **interacts**, **connects**, and **composed-of**.

### 2. Step-by-Step Relationship Building

We'll build up your architecture in stages, adding different relationship types.

#### Step 2a: Add a Database and Connect It

**Prompt:**
```text
Update architectures/my-first-architecture.json to add:

1. A database node (node-type: "database") that stores data for my service

2. A "connects" relationship showing that my service connects to this database

The relationship should use the "connects" relationship type with source and destination properties.

Ensure the file still validates against CALM 1.0.
```

**Review the output:**
- ✅ New database node added
- ✅ `relationships` array created (if it didn't exist)
- ✅ Relationship uses `connects` (not interacts!)
- ✅ `source` contains a `node` reference to your service
- ✅ `destination` contains a `node` reference to the database

#### Step 2b: Add an Actor and Show Human Interaction

Now add a human actor who uses your service.

**Prompt:**
```text
Update architectures/my-first-architecture.json to add:

1. An actor node (node-type: "actor") representing an end user or customer who uses my service

2. An "interacts" relationship showing that this actor interacts with my service

The relationship should use the "interacts" relationship type with actor and nodes properties.

Ensure the file still validates.
```

**Review the output:**
- ✅ New actor node added
- ✅ Relationship uses `interacts` (for human-to-service interaction)
- ✅ `actor` property references the actor node
- ✅ `nodes` array contains your service node

**Key learning:** `interacts` is for humans/actors → services, `connects` is for service → infrastructure.

#### Step 2c: Add a System Node for Composition

Finally, create a system-level view showing your service is part of a larger system.

**Prompt:**
```text
Update architectures/my-first-architecture.json to add:

1. A system node (node-type: "system") representing the overall system that contains my service and database

2. A "composed-of" relationship showing that this system is composed of both my service and database

The relationship should use the "composed-of" relationship type with container and nodes properties.

Ensure the file still validates.
```

**Review the output:**
- ✅ New system node added
- ✅ Relationship uses `composed-of`
- ✅ `container` references the system node
- ✅ `nodes` array contains both your service node and database node

### 3. Understand Your Architecture

You should now have:
- **4 nodes**: System, Service, Database, Actor
- **3 relationships**: 
  - Actor **interacts** with Service
  - Service **connects** to Database  
  - System **composed-of** Service and Database

Ask Copilot to explain what you built:

```text
Explain the three different relationship types I just created and why each one is appropriate for its use case.
```

### 4. Experiment with the oneOf Constraint

Try this to understand the constraint:

**Prompt:**
```text
What would happen if I tried to add both "interacts" and "connects" to the same relationship? Show me an example and explain why it would fail validation.
```

### 5. Validate Your Architecture

```bash
calm validate -a architectures/my-first-architecture.json
```

You should see validation succeed with 4 nodes and 3 relationships.

### 6. Commit Your Work

Update your README.md progress:
```markdown
- [x] Day 1: Install CALM CLI and Initialize Repository
- [x] Day 2: Create Your First Node
- [x] Day 3: Connect Nodes with Relationships
```

Track what you've done:
```bash
git add architectures/my-first-architecture.json README.md
git commit -m "Day 3: Add multiple nodes and relationship types (interacts, connects, composed-of)"
git tag day-3
```

## Deliverables / Validation Criteria

Your Day 3 submission should include a commit tagged `day-3` containing:

✅ **Required Files:**
- `architectures/my-first-architecture.json` - Valid CALM architecture with:
  - At least 4 nodes (system, service, database, actor)
  - At least 3 relationships demonstrating different types
  - One "interacts" relationship (actor → service)
  - One "connects" relationship (service → database)
  - One "composed-of" relationship (system contains service and database)
- Updated `README.md` - Day 3 marked as complete

✅ **Validation:**
```bash
# Architecture validates without errors
calm validate -a architectures/my-first-architecture.json

# Check git tag exists
git tag | grep -q "day-3"
```

## Resources
- [CALM Relationship Types](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.0/meta/core.json#L92-L162)
- [Understanding oneOf in JSON Schema](https://json-schema.org/understanding-json-schema/reference/combining#oneOf)

## Tips
- **interacts**: Use for actor/human → service interactions
- **connects**: Use for service → infrastructure (databases, queues, APIs)
- **composed-of**: Use for showing hierarchical containment (system contains services)
- Relationship `unique-id` values should be descriptive (e.g., "user-to-auth-service", "auth-to-db-connection")
- The `description` property on relationships is optional but recommended
- Each relationship can have only **one** type (enforced by oneOf constraint)

## Common Pitfalls

**"Should I use 'interacts' or 'connects'?"**
- **interacts**: Human/actor → service
- **connects**: Service → infrastructure/database/API
- Rule of thumb: If it's a person/external actor, use "interacts"

**"My composed-of relationship won't validate"**
- Make sure you use `container` (singular) for the parent node
- Make sure you use `nodes` (plural array) for the child nodes
- Different structure than interacts/connects!

**"Validation says my node reference is invalid"**
- Check spelling and case of `unique-id` values
- The reference must match **exactly**

## Quick Reference: Relationship Structures

**Interacts (actor → service):**
```json
{
  "unique-id": "user-to-service",
  "relationship-type": {
    "interacts": {
      "actor": "actor-id",
      "nodes": ["service-id"]
    }
  }
}
```

**Connects (service → database):**
```json
{
  "unique-id": "service-to-db",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "service-id"
      },
      "destination": {
        "node": "database-id"
      }
    }
  }
}
```

**Composed-of (system contains service):**
```json
{
  "unique-id": "system-composition",
  "relationship-type": {
    "composed-of": {
      "container": "system-id",
      "nodes": ["service-id", "database-id"]
    }
  }
}
```

## Next Steps
Tomorrow (Day 4) you'll add interfaces to your nodes, defining exactly *how* they communicate (protocols, ports, endpoints)!
