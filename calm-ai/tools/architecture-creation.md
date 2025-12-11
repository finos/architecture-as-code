# CALM Architecture Creation Guide

## Overview

This guide provides instructions for creating complete CALM architecture documents that comply with the FINOS CALM v1.0 schema.

## Required Schema Structure

Every CALM architecture MUST include:

```json
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
    "unique-id": "string",
    "name": "string",
    "description": "string"
}
```

## Optional Top-Level Properties

```json
{
    "metadata": [],
    "nodes": [],
    "relationships": [],
    "flows": [],
    "controls": {}
}
```

## Architecture Creation Checklist

- [ ] Include required $schema reference to CALM v1.0
- [ ] Provide unique-id (kebab-case recommended)
- [ ] Add descriptive name and description
- [ ] Name file with `.architecture.json` suffix
- [ ] Add nodes array (even if empty initially)
- [ ] Add relationships array to connect nodes
- [ ] Include metadata array for operational info
**🚨 MANDATORY VALIDATION (Do not skip):**
- [ ] **Verify calm-cli is installed:** `which calm`
- [ ] **Run CALM validation:** `calm validate -a <filename>.architecture.json`
- [ ] **Review output for errors:** `jsonSchemaValidationOutputs`, `spectralSchemaValidationOutputs`
- [ ] **Fix ALL errors before proceeding** - Do not assume JSON validity equals CALM validity
- [ ] **Confirm output shows:** `"hasErrors": false, "hasWarnings": false`
- [ ] **Document any warnings addressed**

> **Note:** See **calm-cli-instructions.md** for complete CLI usage, validation modes, and options.

## Best Practices

1. **Naming**: Use descriptive, business-friendly names
2. **IDs**: Use kebab-case for unique-id values
3. **File Naming**: Architecture files should be suffixed with `.architecture.json` (e.g., `trading-system.architecture.json`)
4. **Modularity**: Consider using detailed-architecture for complex subsystems
5. **Validation**: Always validate before committing changes
6. **Documentation**: Include comprehensive descriptions

## Example Minimal Architecture

```json
{
    "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
    "unique-id": "example-trading-system",
    "name": "Example Trading System",
    "description": "A simple trading system architecture",
    "metadata": [
        {
            "version": "1.0.0",
            "created-by": "Architecture Team",
            "environment": "production"
        }
    ],
    "nodes": [],
    "relationships": []
}
```
