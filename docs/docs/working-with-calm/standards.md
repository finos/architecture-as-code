---
id: standards
title: Standards
sidebar_position: 8
---

# Standards

The CALM Schema is designed to be unopinionated and open for extension outside of the core required fields. 
Standards in CALM allow organizations and communities to create reusable JSON Schemas that extend core CALM components with additional properties. 
This enables consistent organizational requirements and industry-specific extensions across CALM architectures.
It is expected that many organizations will use Standards to enrich the base schema to add consistency and constraints.

## What are Standards?

Standards are JSON Schema 2020-12 documents that define additional properties and constraints for CALM components. 
They work by composing with core CALM schemas using `$ref` to add organization-specific or domain-specific requirements.

**Key Characteristics:**
- Follow JSON Schema 2020-12 specification
- Reference core CALM schemas (`core.json`) using `$ref`
- Add organization or domain-specific properties
- Integrate seamlessly with existing CALM validation
- Can be shared across teams, organizations, or the broader community

## Common Use Cases

### Organization-Level Extensions

Organizations often need to add consistent properties across their CALM architectures:

- **Company Node Requirements**: Cost centers, ownership information, compliance tags
- **Interface Specifications**: Authentication requirements, rate limiting, monitoring
- **Relationship Policies**: Approval workflows, security zones, data classification
- **Control Requirements**: Organizational compliance frameworks and policies

### Industry Standards

Industry groups and frameworks can define domain-specific extensions:

- **Financial Services**: Regulatory compliance, risk classifications
- **Healthcare**: HIPAA compliance, patient data handling
- **Government**: Security clearances, classification levels
- **Cloud Providers**: Service tiers, SLA requirements

## How Standards Work

Standards extend CALM components by defining additional JSON Schema properties that compose with the core CALM schema definitions.

### Basic Structure

A Standard is a valid JSON Schema 2020-12 document:

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "type": "object",
  "properties": {
    "costCenter": {
      "type": "string",
      "pattern": "^CC-[0-9]{4}$",
      "description": "Company cost center code"
    },
    "owner": {
      "type": "string",
      "description": "Team or individual responsible for this component"
    },
    "environment": {
      "type": "string",
      "enum": ["development", "staging", "production"],
      "description": "Deployment environment classification"
    }
  },
  "required": ["costCenter", "owner"],
  "additionalProperties": false
}
```

### Referencing Core CALM Components

Standards typically extend specific CALM components by referencing core schema definitions:

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Extended Node with Company Requirements",
  "allOf": [
    { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": {
          "type": "string",
          "pattern": "^CC-[0-9]{4}$"
        },
        "owner": {
          "type": "string"
        }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

## Standards and Controls Integration

Most controls in CALM will use Standards to define consistent structures for their requirements and configurations. 
This creates a consistent approach to compliance and governance across architectures.

### How Standards Work with Controls

Standards integrate with controls through the requirement files:

1. **Control Definition**: The control specifies a `requirement-url` pointing to a requirement.json file
2. **Requirement Schema**: The requirement file may optionally use a Standard as its JSON Schema base
3. **Configuration Validation**: The control's configuration is validated against the requirement schema

**Example NIST Document Standard:**

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "NIST Document Standard",
  "type": "object",
  "properties": {
    "documentNumber": {
      "type": "string",
      "description": "The official NIST document number, e.g., 'NIST SP 800-207'"
    },
    "title": {
      "type": "string",
      "description": "The full title of the NIST document"
    },
    "status": {
      "type": "string",
      "enum": ["Final", "Draft", "Superseded", "Withdrawn"],
      "description": "The current status of the document"
    },
    "seriesName": {
      "type": "string",
      "description": "The NIST publication series name"
    }
  },
  "required": ["documentNumber", "title", "status", "seriesName"],
  "additionalProperties": false
}
```

**Example Requirement File Using Standard:**

```json
{
  "$schema": "https://company.com/standards/nist-document-standard.json",
  "title": "NIST AC-2 Access Control Requirement",
  "documentNumber": "NIST SP 800-53",
  "controlFamily": "AC - Access Control",
  "controlId": "AC-2",
  "additionalRequirements": {
    "implementationLevel": ["basic", "enhanced", "advanced"]
  }
}
```

This approach allows multiple NIST control requirements to use the same Standard as their base schema, ensuring consistency.

## Target CALM Components

Standards are most commonly applied to these core CALM components:

### Nodes
- **Organization Requirements**: Cost centers, ownership, environments
- **Infrastructure Standards**: Cloud provider specifications, resource limits
- **Compliance Tags**: Security classifications, regulatory requirements

### Interfaces
- **Authentication Standards**: OAuth configurations, API key requirements
- **Protocol Specifications**: Version requirements, encoding standards
- **Performance Requirements**: Rate limits, timeout configurations

### Relationships
- **Approval Workflows**: Required approvals for certain relationship types
- **Security Policies**: Network segmentation, data flow restrictions
- **Monitoring Requirements**: Logging, alerting, tracing specifications

### Control Requirements
- **Compliance Frameworks**: NIST, ISO 27001, SOC 2 requirements
- **Organizational Policies**: Internal security, operational procedures
- **Audit Standards**: Evidence collection, documentation requirements

## FINOS Community Standards

The FINOS community will develop and maintain Standards for common financial services use cases:
These community Standards will be available for organizations to adopt and extend with their specific requirements.
At this time we are working with the appropriate FINOS groups to start these efforts in the appropriate working group.

## Validation and Enforcement

Standards integrate seamlessly with CALM's existing validation pipeline:

### JSON Schema Validation

The `calm validate` command uses standard JSON Schema validation to enforce Standards:

```bash
# Validates architecture against core CALM schema and any referenced Standards
calm validate architecture.json
```

When components reference Standards via `$ref`, the validator automatically:
1. Resolves the Standard schema from its location
2. Composes it with the core CALM schema
3. Validates the component against the combined schema
4. Reports any validation errors with clear error messages

### Error Handling

Validation errors clearly indicate which Standard requirements are not met:

```
Validation Error in node 'payment-service':
- Missing required property 'costCenter' (required by Company Node Standard)
- Property 'environment' must be one of: development, staging, production
```

## Creating and Using Standards

### 1. Define Your Standard

Create a JSON Schema 2020-12 document that defines your additional requirements:

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "My Organization Node Standard",
  "type": "object",
  "properties": {
    "department": { "type": "string" },
    "criticality": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"]
    }
  },
  "required": ["department"]
}
```

### 2. Host Your Standard

Make your Standard accessible via URL:
- **Internal**: Company schema repository
- **Community**: FINOS Standards registry
- **Public**: GitHub, schema repositories

This is also supported in the latest early access version of Calm Hub. 

### 3. Reference in CALM Components

Use `allOf` to compose your Standard with core CALM schemas:

```json
{
  "nodes": [
    {
      "$ref": "#/defs/extended-node"
    }
  ],
  "defs": {
    "extended-node": {
      "allOf": [
        { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
        { "$ref": "https://company.com/standards/company-node.json" }
      ]
    }
  }
}
```

## Best Practices

### Standard Design
- **Keep Standards focused**: Address specific organizational or domain needs
- **Use clear naming**: Make purpose and scope obvious from the title
- **Document thoroughly**: Include descriptions for all properties
- **Version carefully**: Use semantic versioning for Standard updates

### Schema Composition
- **Use `allOf`**: Compose Standards with core CALM schemas cleanly
- **Avoid conflicts**: Ensure Standard properties don't conflict with core schema
- **Test validation**: Verify Standards work correctly with `calm validate`
- **Share responsibly**: Make useful Standards available to the community

### Organizational Adoption
- **Start simple**: Begin with basic organizational requirements
- **Iterate gradually**: Add complexity as teams become comfortable
- **Document usage**: Provide clear guidance for teams adopting Standards
- **Monitor compliance**: Regular validation ensures Standards are followed

## Next Steps

- **Explore**: Review existing FINOS community Standards
- **Create**: Develop Standards for your organization's needs  
- **Validate**: Test your Standards with `calm validate`
- **Contribute**: Share useful Standards with the FINOS community
- **Learn More**: See [Controls](controls) for how Standards integrate with compliance frameworks

Standards enable CALM to scale from individual architectures to organization-wide modeling practices while maintaining consistency and enforcing important requirements.