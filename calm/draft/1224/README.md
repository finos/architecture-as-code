# Architecture Decision Records (ADR) Support in CALM

## Overview

This proposal introduces support for Architecture Decision Records (ADRs) in the CALM meta-schema. 
By allowing architectures and patterns to reference ADRs, we improve traceability between design decisions and architectural models. 
ADRs can be hosted in CALM Hub or external documentation repositories.

## Motivation

CALM is designed to complement, not replace, existing tooling and documentation practices. 
One such widely adopted practice is the use of Architecture Decision Records to capture key architectural decisions.

While CALM already integrates well with tools like the C4 model, it lacks a formal way to link ADRs to architectural elements. 
This proposal addresses that gap by introducing a lightweight mechanism for referencing ADRs directly within CALM models.

This change enables:

1. Documentation of ADRs associated with both architecture definitions and reusable patterns
1. Linking to existing ADRs stored in other repositories (e.g., GitHub, Confluence, Notion)
1. Compatibility with CALM Hub and other centralized architecture stores

## Schema Changes

### core.json

Introduced a new optional adrs property at the document level:

```json
"adrs": {
  "type": "array",
  "items": {
    "type": "string"
  }
}
```

## Example Architecture

The following example shows how an architecture file could declare references to ADRs:

```json
{
  "$schema": "https://calm.finos.org/draft/1224/meta/calm.json",
  "name": "Trading Platform",
  "adrs": [
    "https://github.com/org/project/docs/adr/0001-use-kafka.md",
    "https://internal-docs.company.com/adr/0023-security-boundary.pdf"
  ],
  "nodes": [ ... ],
  "relationships": [ ... ]
}
```

## Migration Guide

### For Existing CALM Models

Fully backwards compatible, no work to do. 


## Tooling Considerations

May require the generator to be updated to support the new adrs property.

## Future Considerations

- A registry of commonly used interface schemas could be established
- Tooling to generate interface schemas from other formats (e.g., OpenAPI, Protocol Buffers)
- Future CALM versions may deprecate the legacy `interface-type` in favor of `interface-definition`