---
id: 03-relationships
title: "Connect Nodes with Relationships"
sidebar_position: 3
---

# Tutorial 3: Connect Nodes with Relationships

🟢 **Difficulty:** Beginner | ⏱️ **Time:** 30-45 minutes

## Overview

Expand your architecture by adding multiple nodes and different relationship types to show how they connect, interact, and compose.

## Learning Objectives

By the end of this tutorial, you will:
- Understand the different relationship types in CALM
- Create interacts, connects, and composed-of relationships
- Understand the oneOf constraint pattern
- Build a multi-node architecture

## Prerequisites

Complete [Tutorial 2: Create Your First Node](02-first-node) first.

## Step-by-Step Guide

### 1. Understand Relationship Types

CALM supports four core relationship types (you can only use **one** per relationship):

| Type | Purpose | Example |
|------|---------|---------|
| **interacts** | Actor/human interactions with services | User → Web Application |
| **connects** | Infrastructure/technical connections | Service → Database |
| **deployed-in** | Deployment topology | Service → Kubernetes Cluster |
| **composed-of** | Hierarchical composition | System → Services |

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

Ensure the file still validates against CALM 1.1.
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

:::tip Key Learning
`interacts` is for humans/actors → services, `connects` is for service → infrastructure.
:::

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

## Key Concepts

### Relationship Structures

Each relationship type has a different structure:

**Interacts (actor → service):**
```json
{
  "unique-id": "user-to-service",
  "relationship-type": {
    "interacts": {
      "actor": "end-user",
      "nodes": ["auth-service"]
    }
  }
}
```

**Connects (service → infrastructure):**
```json
{
  "unique-id": "service-to-db",
  "relationship-type": {
    "connects": {
      "source": { "node": "auth-service" },
      "destination": { "node": "user-database" }
    }
  }
}
```

**Composed-of (container → children):**
```json
{
  "unique-id": "system-composition",
  "relationship-type": {
    "composed-of": {
      "container": "auth-system",
      "nodes": ["auth-service", "user-database"]
    }
  }
}
```

### The oneOf Constraint

Each relationship can have only **one** type. This is enforced by JSON Schema's `oneOf` constraint. You cannot have both `interacts` and `connects` in the same relationship.

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

## Resources

- [CALM Relationship Types](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.1/meta/core.json)
- [Understanding oneOf in JSON Schema](https://json-schema.org/understanding-json-schema/reference/combining#oneOf)

## Tips

- **interacts**: Use for actor/human → service interactions
- **connects**: Use for service → infrastructure (databases, queues, APIs)
- **composed-of**: Use for showing hierarchical containment
- Relationship `unique-id` values should be descriptive (e.g., "user-to-auth-service")
- The `description` property on relationships is optional but recommended

## Next Steps

In [Tutorial 4](04-vscode-extension), you'll install the CALM VSCode extension to visualize your architecture!
