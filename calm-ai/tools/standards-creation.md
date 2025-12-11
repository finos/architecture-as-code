# CALM Standards Creation Guide

## Critical Requirements

⚠️ **ALWAYS call the standards creation tool before creating any Standards**
⚠️ **Standards must follow JSON Schema 2020-12 specification**
⚠️ **Standards compose with core CALM schemas using `$ref` and `allOf`**

## What are Standards?

Standards are JSON Schema 2020-12 documents that extend core CALM components with organization-specific or domain-specific properties.
They enable consistent requirements across CALM architectures while integrating seamlessly with existing JSON Schema validation.

**Key Capabilities:**

- **Organization Extensions**: Add company-specific properties to nodes, interfaces, relationships
- **Compliance Integration**: Most controls use Standards to define requirements and specifications
- **Community Sharing**: FINOS and industry groups can create reusable Standards
- **Native Validation**: Works with standard JSON Schema validation in `calm validate`

## JSON Schema 2020-12 Structure

All Standards must follow this base structure:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "[Descriptive Title]",
  "type": "object",
  "properties": {
    // Your additional properties here
  },
  "required": [/* required properties */],
  "additionalProperties": false
}
```

## Target CALM Components

Standards commonly extend these core CALM components:

### Nodes
- Company requirements (cost centers, ownership, environments)
- Infrastructure standards (cloud specs, resource limits)
- Compliance classifications (security levels, regulatory tags)

### Interfaces  
- Authentication standards (OAuth, API keys)
- Protocol specifications (versions, encoding)
- Performance requirements (rate limits, timeouts)

### Relationships
- Approval workflows (required approvals)
- Security policies (network segmentation, data flow)
- Monitoring requirements (logging, alerting)

### Control Requirements
- Compliance frameworks (NIST, ISO 27001, SOC 2)
- Organizational policies (internal security, operations)
- Audit standards (evidence, documentation)

## Schema Composition Patterns

### Pure Standard (No Core Reference)

For defining reusable schema fragments:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NIST Document Standard",
  "type": "object",
  "properties": {
    "documentNumber": {
      "type": "string",
      "description": "Official NIST document number, e.g., 'NIST SP 800-207'"
    },
    "title": {
      "type": "string",
      "description": "Full title of the NIST document"
    },
    "status": {
      "type": "string",
      "enum": ["Final", "Draft", "Superseded", "Withdrawn"],
      "description": "Current status of the document"
    },
    "seriesName": {
      "type": "string",
      "description": "NIST publication series name"
    }
  },
  "required": ["documentNumber", "title", "status", "seriesName"],
  "additionalProperties": false
}
```

### Composed with Core CALM Schema

For extending CALM components directly:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "allOf": [
    { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": {
          "type": "string",
          "pattern": "^CC-[0-9]{4}$",
          "description": "Company cost center code"
        },
        "owner": {
          "type": "string",
          "description": "Team or individual responsible"
        },
        "environment": {
          "type": "string",
          "enum": ["development", "staging", "production"]
        }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

## Core CALM Schema References

Common `$ref` patterns for extending CALM components:

- **Nodes**: `https://calm.finos.org/schemas/core.json#/defs/node`
- **Interfaces**: `https://calm.finos.org/schemas/core.json#/defs/interface`
- **Relationships**: `https://calm.finos.org/schemas/core.json#/defs/relationship`
- **Controls**: `https://calm.finos.org/schemas/core.json#/defs/control`

**Note**: Exact URLs may vary based on CALM schema hosting.
Always verify current schema locations.

## Integration with Controls

Most controls use Standards indirectly through their requirement files.
This creates consistency across compliance frameworks:

**Control Definition:**
```json
{
  "nist-access-control": {
    "description": "NIST access control requirements",
    "requirements": [
      {
        "requirement-url": "https://requirements.company.com/nist-ac2.json",
        "config": { /* configuration data */ }
      }
    ]
  }
}
```

**Requirement File Using Standard:**
```json
{
  "$schema": "https://company.com/standards/nist-document.json",
  "documentNumber": "NIST SP 800-53",
  "controlId": "AC-2",
  "title": "Access Control Requirements"
}
```

The requirement file uses the Standard as its schema, ensuring all NIST requirements follow the same structure.

## Validation Integration

Standards work seamlessly with `calm validate`:

1. **Schema Resolution**: Validator resolves `$ref` to Standards automatically
2. **Composition**: Uses `allOf` to combine core CALM and Standard schemas
3. **Validation**: Applies standard JSON Schema validation
4. **Error Reporting**: Clear messages indicate Standard requirement violations

### Local Development with URL Mapping

When developing Standards locally before publishing to a public URL, use the `--url-to-local-file-mapping` option to map canonical URLs to local files:

```bash
# Create a mapping file (url-mapping.json)
{
  "https://company.com/standards/company-node.json": "standards/company-node.json"
}

# Validate using the mapping
calm validate -p pattern.json -a architecture.json -u url-mapping.json
```

This allows patterns and architectures to reference Standards via their canonical URLs while the actual files exist locally. See **calm-cli-instructions.md** for complete URL mapping documentation.

## Common Standard Examples

### Company Node Requirements

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "type": "object",
  "properties": {
    "costCenter": {
      "type": "string",
      "pattern": "^CC-[0-9]{4}$"
    },
    "owner": {
      "type": "string"
    },
    "criticality": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    }
  },
  "required": ["costCenter", "owner"]
}
```

### Interface Authentication Standard

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OAuth Interface Standard",
  "type": "object",
  "properties": {
    "authProvider": {
      "type": "string",
      "enum": ["company-sso", "external-oauth"]
    },
    "scopes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "tokenLifetime": {
      "type": "integer",
      "minimum": 300,
      "maximum": 3600
    }
  },
  "required": ["authProvider", "scopes"]
}
```

### Security Control Framework

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Security Control Standard",
  "type": "object",
  "properties": {
    "framework": {
      "type": "string",
      "enum": ["NIST", "ISO27001", "SOC2"]
    },
    "controlId": {
      "type": "string"
    },
    "implementationLevel": {
      "type": "string",
      "enum": ["basic", "standard", "advanced"]
    },
    "evidenceRequired": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["framework", "controlId"]
}
```

## Usage in CALM Architectures

### Using Standards in Component Definitions

```json
{
  "nodes": [
    {
      "$ref": "#/defs/company-node"
    }
  ],
  "defs": {
    "company-node": {
      "allOf": [
        { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
        { "$ref": "https://company.com/standards/company-node.json" }
      ]
    }
  }
}
```

### Multiple Standards Composition

```json
{
  "defs": {
    "enterprise-node": {
      "allOf": [
        { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
        { "$ref": "https://company.com/standards/company-node.json" },
        { "$ref": "https://industry.org/standards/security-node.json" }
      ]
    }
  }
}
```

## FINOS Community Standards

The FINOS community creates Standards for common financial services use cases:

- **Regulatory Compliance**: Patterns for financial regulations
- **Risk Management**: Risk assessment and classification standards  
- **Security Frameworks**: Industry security control patterns
- **Integration Patterns**: API and messaging standards

## Validation Rules

1. **Schema Format**: Must be valid JSON Schema 2020-12
2. **Title Required**: Every Standard must have a descriptive title
3. **Property Descriptions**: All properties should include descriptions
4. **No Core Conflicts**: Standard properties must not conflict with core CALM schema
5. **Composition Compatibility**: When using `allOf`, ensure schemas compose correctly
6. **Reference Validity**: All `$ref` URLs must resolve to valid schemas

## Best Practices

### Standard Design
- **Focus Purpose**: Address specific organizational or domain needs
- **Clear Naming**: Make purpose obvious from title (e.g., "Company Node Standard")
- **Document Thoroughly**: Include descriptions for all properties and constraints
- **Version Semantically**: Use semantic versioning for Standard updates
- **Test Validation**: Verify Standards work with `calm validate`

### Schema Composition
- **Use `allOf`**: Cleanly compose Standards with core CALM schemas
- **Avoid Conflicts**: Ensure no property name conflicts with core schema
- **Order Matters**: Place core schema reference first in `allOf` array
- **Validate Composition**: Test that combined schemas validate correctly

### Organizational Adoption
- **Start Simple**: Begin with basic requirements (cost center, owner)
- **Iterate Gradually**: Add complexity as teams become comfortable
- **Document Usage**: Provide clear examples and adoption guides
- **Monitor Compliance**: Use validation to ensure Standards are followed

## Cross-References

- **Control Creation**: See control creation tool for integrating Standards with controls
- **Node Creation**: Reference for extending nodes with Standards
- **Interface Creation**: Guidance for interface-specific Standards
- **Architecture Creation**: How to structure architectures using Standards
- **calm-cli-instructions.md**: Complete CLI usage including validation modes and options

## Key Reminders

- Always use JSON Schema 2020-12 specification
- Most controls will use Standards for their requirements
- Standards compose with core CALM schemas via `$ref` and `allOf`
- Focus on nodes, interfaces, relationships, and control-requirements
- FINOS community will provide reusable Standards for financial services
- Native JSON Schema validation handles Standard enforcement automatically
