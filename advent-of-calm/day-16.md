# Day 16: Creating Node and Relationship Standards

## Overview
Create custom node and relationship Standards that extend core CALM components with your organisation's requirements.

## Objective and Rationale
- **Objective:** Build reusable Standards for nodes and relationships that enforce organisational requirements
- **Rationale:** Yesterday you learned what Standards are. Today you'll create practical Standards that can be used across all your architectures, ensuring every service has proper ownership, every relationship has security classification, and your organisation's governance requirements are consistently applied.

## Requirements

### 1. Review Your Organisation's Requirements

Before creating Standards, identify what your organisation needs:

**Common Node Requirements:**
- Owner/team responsible
- Cost centre for billing
- Environment classification
- Criticality level
- Compliance tags

**Common Relationship Requirements:**
- Security classification
- Data sensitivity level
- Approval status
- Monitoring requirements

### 2. Create an Enhanced Node Standard

**File:** `standards/service-node-standard.json`

This Standard extends the base CALM node with service-specific requirements:

**Prompt:**
```text
Create standards/service-node-standard.json with the following structure:

{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Service Node Standard",
  "description": "Organisational requirements for service nodes",
  "type": "object",
  "properties": {
    "owner": {
      "type": "string",
      "description": "Team responsible for this service"
    },
    "costCenter": {
      "type": "string",
      "pattern": "^CC-[0-9]{4}$",
      "description": "Cost centre code (format: CC-XXXX)"
    },
    "criticality": {
      "type": "string",
      "enum": ["low", "medium", "high", "critical"],
      "description": "Business criticality level"
    },
    "environment": {
      "type": "string",
      "enum": ["development", "staging", "production"],
      "description": "Deployment environment"
    },
    "repository": {
      "type": "string",
      "format": "uri",
      "description": "Source code repository URL"
    },
    "oncallTeam": {
      "type": "string",
      "description": "On-call team or Slack channel"
    }
  },
  "required": ["owner", "costCenter", "criticality"],
  "additionalProperties": true
}
```

### 3. Create a Relationship Standard

**File:** `standards/connection-standard.json`

This Standard ensures all service connections have proper security and compliance information:

**Prompt:**
```text
Create standards/connection-standard.json with the following structure:

{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Connection Standard",
  "description": "Organisational requirements for service connections",
  "type": "object",
  "properties": {
    "dataClassification": {
      "type": "string",
      "enum": ["public", "internal", "confidential", "restricted"],
      "description": "Classification of data flowing through this connection"
    },
    "encrypted": {
      "type": "boolean",
      "description": "Whether the connection is encrypted"
    },
    "authRequired": {
      "type": "boolean",
      "description": "Whether authentication is required"
    },
    "approvedBy": {
      "type": "string",
      "description": "Security team member who approved this connection"
    },
    "approvalDate": {
      "type": "string",
      "format": "date",
      "description": "Date the connection was approved"
    }
  },
  "required": ["dataClassification", "encrypted"],
  "additionalProperties": true
}
```

### 4. Create a Database Node Standard

**File:** `standards/database-node-standard.json`

Databases have additional requirements around data protection:

**Prompt:**
```text
Create standards/database-node-standard.json with:

{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Database Node Standard",
  "description": "Organisational requirements for database nodes",
  "type": "object",
  "properties": {
    "owner": {
      "type": "string",
      "description": "Team responsible for this database"
    },
    "costCenter": {
      "type": "string",
      "pattern": "^CC-[0-9]{4}$",
      "description": "Cost centre code"
    },
    "dataClassification": {
      "type": "string",
      "enum": ["public", "internal", "confidential", "restricted"],
      "description": "Highest classification of data stored"
    },
    "backupSchedule": {
      "type": "string",
      "description": "Backup frequency (e.g., 'daily', 'hourly')"
    },
    "retentionPeriod": {
      "type": "string",
      "description": "Data retention period (e.g., '7 years')"
    },
    "encryptionAtRest": {
      "type": "boolean",
      "description": "Whether data is encrypted at rest"
    },
    "dbaContact": {
      "type": "string",
      "description": "DBA team contact"
    }
  },
  "required": ["owner", "costCenter", "dataClassification", "encryptionAtRest"],
  "additionalProperties": true
}
```

### 5. Understand How Standards Compose with CALM

Standards work with core CALM schemas using `allOf`:

```json
{
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/node" },
    { "$ref": "./standards/service-node-standard.json" }
  ]
}
```

This composition means a node must satisfy BOTH:
1. The core CALM node requirements (unique-id, node-type, name, description)
2. Your organisation's additional requirements (owner, costCenter, criticality)

### 6. Create a Standards Usage Example

**File:** `standards/examples/standard-service-node.json`

Show how a node would look when following your Standard:

**Prompt:**
```text
Create standards/examples/standard-service-node.json showing a node that follows the service-node-standard:

{
  "unique-id": "order-service",
  "node-type": "service",
  "name": "Order Service",
  "description": "Handles order processing and management",
  "owner": "orders-team",
  "costCenter": "CC-4521",
  "criticality": "high",
  "environment": "production",
  "repository": "https://github.com/company/order-service",
  "oncallTeam": "#orders-oncall"
}
```

### 7. Create a Standards Usage Example for Relationships

**File:** `standards/examples/standard-connection.json`

**Prompt:**
```text
Create standards/examples/standard-connection.json showing a relationship that follows the connection-standard:

{
  "unique-id": "order-to-payment",
  "relationship-type": {
    "connects": {
      "source": { "node": "order-service" },
      "destination": { "node": "payment-service" }
    }
  },
  "description": "Order service calls payment service for payment processing",
  "dataClassification": "confidential",
  "encrypted": true,
  "authRequired": true,
  "approvedBy": "security-team",
  "approvalDate": "2025-01-15"
}
```

### 8. Update Standards Documentation

**Prompt:**
```text
Update standards/README.md to document:

1. The three Standards we've created (service-node, database-node, connection)
2. What each Standard requires and why
3. Example usage for each Standard
4. How Standards compose with core CALM using allOf
5. Benefits of using these Standards across all architectures
```

### 9. Commit Your Work

```bash
git add standards/
git commit -m "Day 16: Create node and relationship Standards for organisational governance"
git tag day-16
```

## Deliverables / Validation Criteria

Your Day 16 submission should include a commit tagged `day-16` containing:

✅ **Required Files:**
- `standards/service-node-standard.json` - Service node requirements
- `standards/database-node-standard.json` - Database node requirements
- `standards/connection-standard.json` - Relationship requirements
- `standards/examples/standard-service-node.json` - Example compliant node
- `standards/examples/standard-connection.json` - Example compliant relationship
- Updated `standards/README.md` - Documentation
- Updated `README.md` - Day 16 marked as complete

✅ **Validation:**
```bash
# Verify all Standards are valid JSON
for f in standards/*.json; do cat "$f" | jq . > /dev/null && echo "✅ $f"; done

# Check tag
git tag | grep -q "day-16"
```

## Resources

- [JSON Schema 2020-12 Reference](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema Formats](https://json-schema.org/understanding-json-schema/reference/string.html#format)
- [CALM Core Schema](https://github.com/finos/architecture-as-code/tree/main/calm)

## Tips

- Start with required fields that your organisation genuinely enforces
- Use `enum` for fields with fixed valid values
- Use `pattern` for fields with specific formats (like cost centre codes)
- Set `additionalProperties: true` to allow extra fields beyond your requirements
- Document each property with clear descriptions
- Consider creating Standards for different node types (service vs database)

## Next Steps

Tomorrow (Day 17) you'll apply these Standards to the e-commerce architecture you built earlier!
