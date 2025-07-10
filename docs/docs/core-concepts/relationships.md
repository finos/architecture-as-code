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
- **controls**: Optional policies or constraints that apply to the relationship, such as encryption requirements.

### Example of a Relationship Definition

Below is an example of a relationship definition connecting a service to a database:

```json
{
  "nodes": [
    {
      "unique-id": "spring-service",
      "node-type": "service",
      "name": "Spring Boot Service",
      "description": "A Spring Boot microservice that provides business functionality and connects to a database for persistence."
    },
    {
      "unique-id": "postgres-db",
      "node-type": "database",
      "name": "PostgreSQLDatabase",
      "description": "A PostgreSQL database that persistently stores data for the Spring Boot service.",
      "interfaces": [
        {
          "unique-id": "db-interface",
          "host": "db.example.com",
          "port": 5432,
          "database": "example-db",
          "username": "${DB_USERNAME}",
          "password": "${DB_PASSWORD}",
          "schema": "example"
        }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "service-to-db",
      "description": "The Spring Boot service connects to the PostgreSQL database for persistence.",
      "relationship-type": {
        "connects": {
          "source": {
            "node": "spring-service"
          },
          "destination": {
            "node": "postgres-db",
            "interfaces": [
              "db-interface"
            ]
          }
        }
      },
      "protocol": "JDBC"
    }
  ]
}
```

### Using Relationships Effectively

Relationships are crucial for understanding how your architecture functions as a whole. They allow you to:

- **Map Dependencies**: Clearly illustrate how different components rely on one another, helping identify potential bottlenecks or points of failure.
- **Define Interactions**: Specify how data flows between systems, aiding in security assessments and performance evaluations.
- **Encapsulate Complexity**: Use hierarchical relationships to manage complex systems, nesting components where necessary for clarity.

It should be noted that interfaces are not mandatory for defining a relationship between nodes but provide additional detail that tools may require to drive automation capabilities. It is therefore not required for example to define an interface on a node calling another node, that interface may be implicit, but you would likely want to define the interface the client node is calling as that defines a functional interface on the node being called.

You can see this in the example above; the relationship is connecting a service to a database via an explicit interface on the database but implicitly on the service.  