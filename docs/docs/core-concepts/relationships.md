---
id: relationships
title: Relationships
sidebar_position: 4
---

# Relationships in CALM

Relationships in CALM define how nodes interact, connect, or depend on each other. They are the "arrows" in architectural diagrams that illustrate data flows, control flows, dependencies, and system interactions.

## What is a Relationship?

A relationship links two or more nodes, providing context about how they interact. Relationships can represent data flows, communication paths, control dependencies, or even logical groupings of nodes.

### Key Properties of Relationships

Relationships in CALM have several properties that capture the nature and specifics of these connections:

- **unique-id**: A mandatory identifier that uniquely defines the relationship within the architecture.
- **relationship-type**: Specifies the type of interaction, such as:
  - **interacts**: Defines an interaction between nodes, often representing a direct communication or service call.
  - **connects**: Illustrates a connection between interfaces, such as a network link or API call.
  - **deployed-in**: Indicates deployment relationships, showing where a node is hosted or run.
  - **composed-of**: Describes hierarchical relationships, showing how one node is composed of other sub-nodes.
- **description**: Provides additional context about the nature of the relationship.
- **protocol**: Defines the protocol used in the connection, such as HTTP, HTTPS, or WebSocket.
- **authentication**: Specifies authentication methods, like OAuth2 or Certificate, used to secure the interaction.
- **controls**: Optional policies or constraints that apply to the relationship, such as encryption requirements.

### Example of a Relationship Definition

Below is an example of a relationship definition connecting a service to a database:

```json
{
  "unique-id": "rel-001",
  "description": "Payment Service accesses Payment Database",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "service-123",
        "interfaces": ["api-interface"]
      },
      "destination": {
        "node": "database-456",
        "interfaces": ["db-interface"]
      }
    }
  },
  "protocol": "HTTPS",
  "authentication": "OAuth2"
}
```

### Using Relationships Effectively

Relationships are crucial for understanding how your architecture functions as a whole. They allow you to:

- **Map Dependencies**: Clearly illustrate how different components rely on one another, helping identify potential bottlenecks or points of failure.
- **Define Interactions**: Specify how data flows between systems, aiding in security assessments and performance evaluations.
- **Encapsulate Complexity**: Use hierarchical relationships to manage complex systems, nesting components where necessary for clarity.
