# CALM Getting Started Guide

Welcome to CALM (Common Architecture Language Model) - an open-source specification for defining, validating, and visualizing system architectures.

## What is CALM?

CALM enables software architects to define system architectures in a standardized, machine-readable format, bridging the gap between architectural intent and implementation.

## Key Concepts

### Namespaces
Logical groups of architecture models that organize controls, patterns, or specifications tied to specific teams, functions, or domains.

### Architectures
Define system designs, component relationships, and architectural decisions. Each architecture can have multiple versions.

### Patterns
Reusable architectural solutions and design templates that can be applied across different systems.

### Flows
Define how data or processes move through the system, representing the dynamic aspects of the architecture.

### Standards
Define compliance requirements, governance controls, and regulatory frameworks.

### ADRs (Architecture Decision Records)
Document important architectural decisions, their context, and rationale.

## Getting Started

1. **Explore Namespaces**: Start by listing available namespaces to understand the organization structure
2. **Browse Architectures**: Examine architectures within namespaces to see system designs
3. **Review Patterns**: Look at reusable patterns for common architectural solutions
4. **Check Standards**: Understand compliance requirements and governance controls

## MCP Tools Available

- `getNamespaces`: List all available namespaces
- `getArchitectures`: Get architecture IDs for a specific namespace
- `getArchitectureVersions`: Get version IDs for a specific architecture
- `getArchitecture`: Get the complete architecture definition
- `getFlows`: Get flows for a specific namespace
- `getPatterns`: Get patterns for a specific namespace
- `getPatternVersions`: Get version IDs for a specific pattern
- `getPattern`: Get the complete pattern definition
- `getStandards`: Get standards for a specific namespace
- `getAdrs`: Get ADRs for a specific namespace
- `validateCalmArchitecture`: Validate architecture files using calm-cli

## Example Workflow

```
1. Call getNamespaces to see available namespaces
2. Call getArchitectures with a namespace to see architecture IDs
3. Call getArchitectureVersions with namespace and architecture ID
4. Call getArchitecture with namespace, architecture ID, and version
```

## Learn More

Visit [CALM FINOS](https://calm.finos.org/) for comprehensive documentation and examples.
