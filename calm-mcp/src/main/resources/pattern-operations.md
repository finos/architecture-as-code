# Pattern Operations Examples

This document provides examples of how to use the pattern-related tools in the CALM MCP server.

## Getting Pattern Information

### 1. List All Patterns in a Namespace

```
getPatterns(namespace: "finos")
```

**Response Example:**
```json
[
  {
    "namespace": "finos",
    "id": "1",
    "description": "Pattern 1 in namespace finos - Architectural pattern providing reusable solutions to common design problems"
  },
  {
    "namespace": "finos", 
    "id": "2",
    "description": "Pattern 2 in namespace finos - Architectural pattern providing reusable solutions to common design problems"
  }
]
```

### 2. Get Versions for a Specific Pattern

```
getPatternVersions(namespace: "finos", patternId: "1")
```

**Response Example:**
```json
[
  {
    "namespace": "finos",
    "patternId": 1,
    "version": "1.0.0",
    "description": "Version 1.0.0 of pattern 1 in namespace finos"
  },
  {
    "namespace": "finos",
    "patternId": 1, 
    "version": "1.1.0",
    "description": "Version 1.1.0 of pattern 1 in namespace finos"
  }
]
```

### 3. Get Complete Pattern Definition

```
getPattern(namespace: "finos", patternId: "1", version: "1.0.0")
```

**Response Example:**
```json
{
  "namespace": "finos",
  "patternId": 1,
  "version": "1.0.0",
  "description": "Full pattern 1 version 1.0.0 in namespace finos",
  "pattern": {
    "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
    "$id": "https://example.com/pattern/api-gateway",
    "title": "API Gateway Pattern",
    "description": "A pattern for API gateway architectures",
    "version": "1.0.0",
    "nodes": [
      {
        "unique-id": "api-gateway",
        "name": "API Gateway",
        "description": "Gateway for API requests",
        "node-type": "service",
        "interfaces": [
          {
            "unique-id": "http-interface",
            "name": "HTTP Interface",
            "description": "HTTP interface for API requests",
            "port": -1,
            "host": "PLACEHOLDER"
          }
        ]
      }
    ]
  }
}
```

## Common Use Cases

### Use Case 1: Exploring Available Patterns
When you want to see what architectural patterns are available:

1. Start with `getNamespaces()` to see available namespaces
2. Use `getPatterns(namespace: "your-namespace")` to see patterns
3. Use `getPatternVersions(namespace: "your-namespace", patternId: "pattern-id")` to see versions
4. Use `getPattern(namespace: "your-namespace", patternId: "pattern-id", version: "version")` to get the full pattern

### Use Case 2: Validating Against a Pattern
When you want to validate an architecture against a pattern:

1. Get the pattern definition using `getPattern()`
2. Use `validateCalmArchitecture()` with both your architecture and the pattern content
3. Review the validation results for compliance

### Use Case 3: Creating Architecture from Pattern
When you want to use a pattern as a starting point:

1. Get the pattern definition using `getPattern()`
2. Copy the pattern structure
3. Replace placeholder values with actual values
4. Use `validateCalmArchitecture()` to ensure compliance

## Pattern Structure

CALM patterns typically include:

- **Schema Reference**: `$schema` pointing to CALM meta-schema
- **Pattern ID**: `$id` uniquely identifying the pattern
- **Metadata**: `title`, `description`, `version`
- **Template Nodes**: Node definitions with placeholder values
- **Template Interfaces**: Interface definitions with placeholder values
- **Template Relationships**: Relationship patterns between nodes
- **Validation Rules**: Embedded spectral rules for pattern compliance

## Placeholder Conventions

Patterns use placeholder values that should be replaced in actual architectures:

- **String Placeholders**: `"PLACEHOLDER"`, `"[DESCRIPTION]"`, `"{{template-value}}"`
- **Numeric Placeholders**: `-1` for ports, IDs that need assignment
- **Boolean Placeholders**: `false` for optional features
- **Array Placeholders**: Empty arrays `[]` that should be populated

## Best Practices

1. **Always check pattern versions** - Patterns evolve over time
2. **Review pattern validation rules** - Understand what compliance means
3. **Replace all placeholders** - Don't leave template values in production
4. **Validate after customization** - Ensure your architecture still complies
5. **Document pattern usage** - Record which patterns you're following
