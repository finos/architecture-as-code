---
id: nodes
title: Nodes
sidebar_position: 2
---

# Nodes in CALM

Nodes are one of the core elements of the CALM schema, representing the individual components that make up your architecture. If you were to sketch your system on a whiteboard, nodes would be the "boxes" that represent people, systems, services, databases, or networks.

## What is a Node?

A node is an abstract representation of any component within your system. Nodes can vary in detail, ranging from high-level concepts like entire systems down to specific elements like a single database or service. This flexibility allows you to tailor your architecture to the level of detail that suits your needs.

### Key Properties of Nodes

Each node within the CALM schema has several key properties that define its behavior and role within the architecture:

- **unique-id**: A mandatory string that uniquely identifies the node within the architecture. This ID is crucial for defining relationships and ensuring that each component is distinct.
- **node-type**: Specifies the type of the node, such as actor, system, service, database, network, or webclient. This helps categorize the node and determine its function within the system.
- **name**: A human-readable name for the node, making it easy to identify and reference in diagrams and discussions.
- **description**: A brief description of the node, explaining its purpose or role within the architecture.
- **detailed-architecture**: Optional; allows for linking to a more detailed architectural representation of the node, which can be useful for complex systems or nested architectures.
- **interfaces**: An optional array defining the interfaces the node exposes, detailing how it interacts with other components.
- **controls**: Optional controls that specify security or operational policies applied to the node, such as access restrictions or compliance requirements.

### Example of a Node Definition

Here’s a simple example of a node definition:

```json
{
  "unique-id": "service-123",
  "node-type": "service",
  "name": "Payment Service",
  "description": "Handles all payment transactions",
  "interfaces": [
    {
      "unique-id": "api-interface",
      "type": "host-port-interface",
      "host": "payments.example.com",
      "port": 443
    }
  ]
}
```

### Using Nodes Effectively

Nodes are versatile and can be used to represent various levels of your architecture. Use them to:

- **Define Systems and Services**: Break down your architecture into manageable components, each defined as a node.
- **Capture Detailed Information**: Utilize the detailed-architecture field to link to more granular designs, enabling deeper exploration when needed.
- **Expose Interfaces**: Clearly define how each node interacts with others, enhancing understanding and enabling more robust architectural validations.
