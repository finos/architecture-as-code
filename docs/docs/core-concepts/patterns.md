---
id: patterns
title: Patterns
sidebar_position: 6
---

# Patterns in CALM

Patterns in CALM are reusable architectural templates that define standardized structures and constraints for building systems. They serve as blueprints that encode best practices, organizational standards, and proven architectural designs that can be applied across multiple projects.

## What is a Pattern?

A pattern is a JSON Schema-based template that defines the structure, constraints, and relationships that an architecture must follow. Patterns act as contracts that specify which nodes, interfaces, and relationships are required, optional, or forbidden in a particular architectural style.

Think of patterns as architectural "cookie cutters" - they provide a standardized shape and structure that ensures consistency across different implementations while allowing for customization within defined boundaries.

### Key Properties of Patterns

Patterns in CALM have several key properties that define their structure and behavior:

- **$schema**: References the CALM meta-schema that defines pattern structure
- **$id**: A unique identifier for the pattern, typically a URL that indicates its namespace and version
- **title**: A human-readable name for the pattern
- **description**: Explains the purpose and use case of the pattern
- **type**: Always "object" for CALM patterns
- **properties**: Defines the structure of architectures that conform to this pattern:
  - **nodes**: Specifies required nodes, their types, and constraints
  - **relationships**: Defines required relationships between nodes
  - **interfaces**: Constrains how nodes can expose interfaces
  - **metadata**: Defines required or optional metadata

### Benefits of Using Patterns

Patterns provide several advantages in architectural design:

- **Consistency**: Ensure all implementations follow the same structural principles
- **Validation**: Enable automated checking that architectures conform to standards
- **Reusability**: Allow proven designs to be applied across multiple projects
- **Documentation**: Serve as living documentation of architectural best practices
- **Governance**: Enforce compliance with organizational policies and standards
- **Speed**: Accelerate development by providing pre-approved architectural templates

## Example of a Pattern Definition

Here's a simplified example of an API Gateway pattern:

```json
{
  "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
  "$id": "https://calm.finos.org/patterns/api-gateway.json",
  "title": "API Gateway Pattern",
  "description": "A pattern for API gateway architectures with backend services",
  "type": "object",
  "properties": {
    "nodes": {
      "type": "array",
      "minItems": 2,
      "prefixItems": [
        {
          "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
          "properties": {
            "unique-id": { "const": "api-gateway" },
            "node-type": { "const": "service" },
            "name": { "const": "API Gateway" },
            "interfaces": {
              "type": "array",
              "minItems": 1,
              "prefixItems": [{
                "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface"
              }]
            }
          }
        },
        {
          "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
          "properties": {
            "node-type": { "const": "service" },
            "name": { "pattern": ".*Service$" }
          }
        }
      ]
    },
    "relationships": {
      "type": "array",
      "minItems": 1,
      "prefixItems": [{
        "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
        "properties": {
          "relationship-type": {
            "type": "object",
            "properties": {
              "connects": {
                "type": "object",
                "properties": {
                  "source": { "const": "api-gateway" }
                }
              }
            }
          }
        }
      }]
    }
  }
}
```

## Pattern Types and Use Cases

Patterns can be designed for various architectural scenarios:

### Infrastructure Patterns
- **API Gateway**: Routes requests to backend services
- **Microservices**: Defines service mesh architectures
- **Event-Driven**: Specifies event sourcing and messaging patterns

### Security Patterns
- **Zero Trust**: Enforces security boundaries and access controls
- **OAuth Flow**: Defines authentication and authorization patterns
- **Data Encryption**: Ensures proper data protection measures

### Integration Patterns
- **ETL Pipeline**: Data transformation and loading processes
- **Message Queue**: Asynchronous communication patterns
- **Database Replication**: Data synchronization architectures

## Working with Patterns

### Validating Against Patterns

Use the CALM CLI to validate that an architecture conforms to a pattern:

```shell
calm validate -p pattern.json -a architecture.json
```

### Generating from Patterns

Create a new architecture from a pattern template:

```shell
calm generate -p pattern.json -o new-architecture.json
```

### Creating Custom Patterns

Organizations can create their own patterns by:

1. Defining the required nodes and their constraints
2. Specifying mandatory relationships
3. Setting up validation rules using JSON Schema
4. Testing the pattern with example architectures
5. Publishing the pattern for team use

## Best Practices for Pattern Design

When creating patterns, consider these guidelines:

- **Start Simple**: Begin with minimal constraints and add complexity as needed
- **Be Explicit**: Clearly define what is required vs. optional
- **Document Intent**: Use descriptions to explain the reasoning behind constraints
- **Test Thoroughly**: Validate patterns with both valid and invalid architectures
- **Version Carefully**: Use semantic versioning for pattern updates
- **Consider Extensibility**: Allow for future additions while maintaining core structure

Patterns are a powerful feature of CALM that enable architectural governance, consistency, and reuse. By leveraging patterns effectively, teams can ensure their architectures follow best practices while maintaining the flexibility to adapt to specific requirements.