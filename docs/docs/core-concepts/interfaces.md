---
id: interfaces
title: Interfaces
sidebar_position: 3
---

# Interfaces in CALM

Interfaces in CALM are used to define how nodes interact with each other. They specify the points of connection between nodes, detailing the available endpoints, communication methods, and security parameters. By defining interfaces, you can establish clear, consistent ways in which components of your architecture connect and communicate.

## What is an Interface?

An interface is a component that specifies how a node exposes its functionality to other nodes. Interfaces can define network connections, APIs, ports, and other types of interactions. They are essential for modeling the boundaries and interaction points within an architecture.

### Key Properties of Interfaces

Interfaces have several key properties that capture the necessary details about how connections are established:

- **unique-id**: A required identifier that uniquely defines the interface within the node and across the architecture.
- **type**: The type of interface, which determines the specific properties it may include. Common types are:
    - **host-port-interface**: Specifies a host and port, used for network-based interactions.
    - **hostname-interface**: Defines a specific hostname endpoint for interactions.
    - **path-interface**: Describes a specific path within a service, useful for API endpoints.
    - **oauth2-audience-interface**: Lists OAuth2 audiences, defining access scopes for services.
    - **url-interface**: Specifies a URL endpoint for interactions.
    - **rate-limit-interface**: Describes rate-limiting rules, specifying constraints like user or IP-based rate limits.
    - **container-image-interface**: Indicates the container image used for deployments, linking to the software's implementation.
    - **port-interface**: Defines only the port used, useful when hosts are determined dynamically.

### Example of an Interface Definition

Below is an example of a `host-port-interface` that might be used by a service node to expose an API:

```json
{
  "unique-id": "api-interface",
  "type": "host-port-interface",
  "host": "api.example.com",
  "port": 443
}
```

### Using Interfaces Effectively

Interfaces provide critical details on how nodes in your architecture connect and operate. They help you:

- **Define Clear Connection Points**: By specifying interfaces, you make the intended interaction points explicit, reducing ambiguity in your architectural model.
- **Model Security and Access Controls**: Use interfaces to define security requirements, such as OAuth2 scopes or certificate-based access, ensuring that nodes communicate securely.
- **Support Detailed-Architecture Drill-Downs**: Interfaces enable you to break down complex nodes into smaller, manageable parts, with defined points of interaction that can be validated and monitored.

