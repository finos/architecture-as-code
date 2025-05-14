# CALM Schema v1.0-rc1 Release Notes

This document outlines the changes included in the CALM Schema v1.0-rc1 release candidate.

## Overview

CALM v1.0-rc1 introduces several important enhancements that improve extensibility and flexibility while maintaining backward compatibility with existing schemas. This release candidate consolidates changes from multiple draft proposals and represents a significant step toward a stable v1.0 release.

## Major Changes

### 1. User Extensible Node Types (Issue #1232)

**What Changed:** The `node-type-definition` schema has been modified to use a `oneOf` structure that allows both predefined enum values and custom string values.

**Benefits:**
- Organizations can define custom architecture component types without requiring schema updates
- Maintains backward compatibility with existing enum values
- Enables more domain-specific architecture modeling

**Example:** See `custom-node-type-example.json` which demonstrates using both standard enum values and custom node types in the same architecture.

### 2. Inline Control Configurations (Issue #1233)

**What Changed:** The `control-detail` schema now supports an optional `control-config` property as an alternative to the existing `control-config-url`.

**Benefits:**
- Allows inline specification of control configurations within CALM documents
- Reduces dependency on external files for simple configurations
- Makes CALM documents more self-contained while maintaining the option for external references

**Examples:** 
- `example-inline-config.json` - Shows using inline control configuration
- `example-mixed-config.json` - Demonstrates using both inline and URL-based configurations in the same document

### 3. Architecture Decision Records Support (Issue #1224)

**What Changed:** Added an optional `adrs` property at the document level to reference external Architecture Decision Records.

**Benefits:**
- Improves traceability between design decisions and architectural models
- Enables linking to existing ADR documentation in various formats and locations
- Enhances the documentation value of CALM models

**Example:** `adr-example.json` shows how to reference ADRs in a CALM document.

### 4. User Extensible Interfaces (Issue #1083)

**What Changed:** 
- Added a new `interface-definition` schema in interface.json
- Modified the interfaces property in nodes to support both standard interfaces and custom interfaces via a `oneOf` structure

**Benefits:**
- Enables domain-specific interfaces to be defined external to the core schema
- Allows referencing external interface schemas through `interface-definition-url`
- Provides a flexible mechanism for extending CALM with specialized interface types

**Example:** `custom-interface-example.json` demonstrates using custom interface definitions for Kafka topics and gRPC services.

### 5. Authentication as Control Requirement (Issue #1177)

**What Changed:**
- Removed the `authentication` property from relationships
- Removed the `authentication` enum definition
- Authentication is now modeled as a control requirement

**Benefits:**
- Provides more flexible and comprehensive authentication definition
- Enables detailed configuration of authentication mechanisms
- Improves compliance tracking by treating authentication as a control

**Example:** `authentication-as-control.json` demonstrates how to model authentication as a control requirement instead of a simple property.

## Prototype Examples

### custom-node-type-example.json

This example demonstrates the user extensible node types feature. It includes:
- A standard node using the "service" type from the predefined enum
- Custom nodes using "microservice" and "gateway" types that aren't in the standard enum
- A relationship connecting these nodes

This example shows how organizations can define their own component types while maintaining compatibility with standard types.

### example-inline-config.json

This example demonstrates inline control configuration. It includes:
- A data security control with an inline encryption configuration
- An access control requirement using a URL reference

This shows how you can embed configuration directly within a CALM document without requiring separate files.

### example-mixed-config.json

This example shows both inline and URL-based control configurations in the same document:
- Data security controls with inline configuration
- Access control requirements with both inline and URL-based configurations

This demonstrates the flexibility to choose the most appropriate approach for each control.

### adr-example.json

This example demonstrates ADR support by:
- Defining an API Gateway architecture
- Including references to external ADR documents that explain key decisions
- Showing how to link to ADRs in different locations (GitHub, internal docs)

This helps maintain traceability between architectural decisions and implementations.

### custom-interface-example.json

This example demonstrates user extensible interfaces with:
- A Kafka service with a custom Kafka topic interface
- A gRPC service with a custom gRPC interface definition
- Each interface referencing an external schema definition and providing appropriate configuration

This showcases how specialized technologies can be modeled in CALM without core schema changes.

### authentication-as-control.json

This example demonstrates authentication as a control by:
- Defining a relationship between two systems
- Specifying authentication requirements as a control with a detailed schema
- Showing how authentication properties can be more comprehensively defined

This illustrates the improved approach to modeling authentication in CALM.

## Migration Notes

For users of previous drafts, the migration path is straightforward:

1. **Node Types:** Existing enum values continue to work; custom types are now also supported
2. **Controls:** Existing `control-config-url` references continue to work; inline configurations are now also supported
3. **Authentication:** For backward compatibility, relationships can still include an authentication property, but it's recommended to migrate to using control requirements

## Validation

All schema files in this release have been validated against JSON Schema Draft 2020-12. The prototype examples demonstrate the new features and serve as test cases for implementation.

## Status

This is a Release Candidate (RC) that will undergo a 4-week testing period as defined in the CALM governance process:
1. Weeks 1-2: Initial testing by tool maintainers
2. Weeks 3-4: Community testing and feedback
3. End of Week 4: Decision to promote to final release or create a new RC
