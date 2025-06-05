# FINOS Official CALM Interfaces

This directory contains the official repository of standardized CALM interface definitions published and maintained by FINOS.

## Purpose

Interface definitions in this directory represent validated, approved interface types that organizations can use directly or extend for their specific integration needs. These interfaces establish consistent communication patterns and technology standards across CALM architectures.

## Organization

Interfaces are organized by technology domains and communication patterns to facilitate discovery and reuse:

- **REST**: RESTful API interfaces for HTTP-based services
- **GraphQL**: GraphQL schema definitions and query interfaces
- **Message Queues**: Asynchronous messaging interfaces (RabbitMQ, Apache Kafka, etc.)
- **Databases**: Database connection and query interfaces
- **Event Streaming**: Real-time event processing and streaming interfaces
- **File Transfer**: File-based integration patterns (SFTP, FTP, batch processing)
- **Authentication**: SSO, OAuth, SAML, and other authentication interfaces
- **Monitoring**: Observability, metrics, and monitoring interfaces

## Interface Types

Each interface definition includes:

- **Protocol specifications**: Technical details of the communication protocol
- **Data formats**: Expected request/response schemas and data structures
- **Security requirements**: Authentication, authorization, and encryption standards
- **Error handling**: Standard error codes and exception handling patterns
- **Documentation**: Usage examples and integration guidelines

## Versioning

All interfaces in this directory follow semantic versioning to ensure backward compatibility and clear evolution paths.

## Publishing

Interfaces in this directory are automatically published to the hosted CALM Hub when they are added, modified, or removed. This ensures that the latest approved interfaces are always available to the community.

## Contributing

To contribute new interfaces or modify existing ones:

1. Follow the CALM interface schema specification
2. Ensure your interface is well-documented with clear protocol definitions
3. Include comprehensive examples and test cases
4. Provide migration guides for breaking changes
5. Submit a pull request with a detailed description of the interface's purpose and use cases

## Usage

Organizations can reference these interfaces directly in their CALM specifications or use them as templates for creating technology-specific variations.

```yaml
# Example reference to a FINOS official interface
interfaces:
  - $ref: "https://calm-hub.finos.org/interfaces/rest/customer-api.yaml"
```
