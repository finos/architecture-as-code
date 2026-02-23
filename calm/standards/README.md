# FINOS Official CALM Standards

This directory contains the official repository of standardized CALM decorator schemas and other reusable standards published and maintained by FINOS.

## Purpose

Standards in this directory represent validated, approved decorator schemas and cross-cutting architectural standards that organizations can use directly or extend for their specific needs. These standards enable consistent application of supplementary information across CALM architectures without modifying the core architecture definitions.

## Organization

Standards are organized by category to facilitate discovery and reuse:

- **Deployment**: Deployment tracking decorators for various platforms (Kubernetes, AWS, Azure, etc.)
- **Security**: Security context decorators including threat models, compliance frameworks, and security controls
- **Business**: Business context decorators such as cost allocation, ownership, and organizational metadata
- **Operational**: Operational decorators including runbooks, SLAs, incident contacts, and support information
- **Observability**: Monitoring and observability decorators with dashboard links, alerting rules, and health checks
- **Guide**: Architectural decision records (ADRs) and design guidance decorators

## Standard Types

Each standard definition includes:

- **Schema definition**: JSON Schema extending the base decorator schema
- **Required properties**: Mandatory fields for the decorator type
- **Optional properties**: Additional fields for enhanced context
- **Validation rules**: Constraints and patterns for data integrity
- **Documentation**: Usage examples and implementation guidelines

## Decorator Standards

Decorator standards define typed schemas that extend the base decorator schema (`decorators.json#/defs/decorator`). Each decorator standard:

1. Constrains the `type` field to a specific value
2. Defines the structure of the `data` field
3. Can be further extended by more specific schemas
4. Maintains backward compatibility through versioning

## Versioning

All standards in this directory follow semantic versioning to ensure backward compatibility and clear evolution paths.

## Publishing

Standards in this directory are automatically published to the hosted CALM Hub when they are added, modified, or removed. This ensures that the latest approved standards are always available to the community.

## Contributing

To contribute new standards or modify existing ones:

1. Follow the CALM decorator schema specification
2. Ensure your standard extends the base decorator schema using `allOf`
3. Provide clear documentation with comprehensive examples
4. Include test cases demonstrating valid and invalid instances
5. Submit a pull request with a detailed description of the standard's purpose and use cases

## Usage

Organizations can reference these standards directly in their decorator documents by using the appropriate `$schema` reference.

```json
{
  "$schema": "https://calm.finos.org/standards/deployment/deployment.decorator.schema.json",
  "unique-id": "my-deployment-001",
  "type": "deployment",
  "target": ["my-architecture.json"],
  "applies-to": ["my-service"],
  "data": {
    "deployment-start-time": "2026-02-23T10:00:00Z",
    "deployment-status": "completed"
  }
}
```

## Standard vs Other CALM Concepts

| Concept | Purpose | Location |
|---------|---------|----------|
| **Standard** | Reusable decorator schemas and cross-cutting patterns | `calm/standards/` |
| **Interface** | Communication protocol definitions | `calm/interfaces/` |
| **Control** | Compliance and governance requirements | `calm/controls/` |
| **Schema** | Core CALM meta-schemas | `calm/release/X.Y/meta/` |
