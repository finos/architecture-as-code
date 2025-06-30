# CALM API Reference

This document provides a quick reference for the CALM MCP tools available in Claude.

## Namespace Operations

### `getNamespaces`
Returns a list of all available namespaces in CALM.

**Parameters:** None

**Example:**
```
Call getNamespaces to see all available namespaces
```

### `getNamespaceDetails` 
Retrieves detailed information about a specific namespace.

**Parameters:**
- `namespace` (string): The identifier of the namespace

## Architecture Operations

### `getArchitectures`
Returns architecture IDs for a specific namespace.

**Parameters:**
- `namespace` (string): Name of CALM namespace

### `getArchitectureVersions`
Returns version IDs for a specific architecture.

**Parameters:**
- `namespace` (string): Name of CALM namespace
- `architectureId` (string): Architecture ID to get versions for

### `getArchitecture`
Returns the complete architecture definition.

**Parameters:**
- `namespace` (string): Name of CALM namespace
- `architectureId` (string): Architecture ID
- `version` (string): Version of the architecture

## Flow Operations

### `getFlows`
Returns flow IDs for a specific namespace.

**Parameters:**
- `namespace` (string): Name of CALM namespace

## Pattern Operations

### `getPatterns`
Returns pattern IDs for a specific namespace.

**Parameters:**
- `namespace` (string): Name of CALM namespace

### `getPatternVersions`
Returns version IDs for a specific pattern.

**Parameters:**
- `namespace` (string): Name of CALM namespace
- `patternId` (string): Pattern ID to get versions for

### `getPattern`
Returns the complete pattern definition.

**Parameters:**
- `namespace` (string): Name of CALM namespace
- `patternId` (string): Pattern ID
- `version` (string): Version of the pattern

## Standard Operations

### `getStandards`
Returns standard IDs for a specific namespace.

**Parameters:**
- `namespace` (string): Name of CALM namespace

## ADR Operations

### `getAdrs`
Returns ADR IDs for a specific namespace.

**Parameters:**
- `namespace` (string): Name of CALM namespace

## Validation Operations

### `validateCalmArchitecture`
Validates a CALM architecture file against a pattern using the calm-cli.

**Parameters:**
- `architectureContent` (string, required): JSON content of the CALM architecture to validate
- `patternContent` (string, optional): JSON content of the CALM pattern to validate against
- `strict` (boolean, optional): Run in strict mode - fail on warnings (default: false)
- `format` (string, optional): Output format - "json" or "junit" (default: "json")

**Returns:** ValidationResult object with success status, output, error messages, and exit code

**Example:**
```
validateCalmArchitecture(
  architectureContent: '{"$schema": "https://...", "title": "My Architecture"}',
  strict: true,
  format: "json"
)
```

## Common Workflows

### Exploring a Namespace
1. `getNamespaces` → Get list of available namespaces
2. `getArchitectures` → Get architectures in a namespace
3. `getPatterns` → Get patterns in a namespace
4. `getStandards` → Get standards in a namespace

### Getting Architecture Details
1. `getArchitectures` → Get architecture IDs
2. `getArchitectureVersions` → Get versions for an architecture
3. `getArchitecture` → Get complete architecture definition

### Understanding Compliance
1. `getStandards` → Get available standards
2. `getAdrs` → Get architecture decision records
3. `getFlows` → Get process flows

### Validating Architecture Files
1. `validateCalmArchitecture` → Validate architecture against CALM schema
2. Use `strict: true` for comprehensive validation including warnings
3. Use `format: "junit"` for CI/CD integration

### Getting Pattern Details
1. `getPatterns` → Get pattern IDs
2. `getPatternVersions` → Get versions for a pattern
3. `getPattern` → Get complete pattern definition
