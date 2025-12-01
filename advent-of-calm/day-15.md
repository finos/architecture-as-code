# Day 15: Using Standards for Your Organisation

## Overview
Learn how CALM Standards extend the flexible core schema with your organisation's specific requirements, enabling consistent governance across all architectures.

## Objective and Rationale
- **Objective:** Understand how Standards work as JSON Schema extensions that add organisation-specific constraints to CALM components
- **Rationale:** The CALM Schema is intentionally unopinionated and open for extension. Standards allow organisations to add consistency and constraints without modifying the core schema. This enables company-wide governance while maintaining CALM's flexibility.

## Requirements

### 1. Understand What Standards Are

**The Problem Standards Solve:**
- CALM's core schema is flexible - it doesn't mandate cost centres, owners, or compliance tags
- Your organisation likely has requirements: "Every service must have an owner" or "All nodes need a cost centre code"
- You don't want to modify CALM's core schema - you want to extend it

**The Solution:**
Standards are JSON Schema 2020-12 documents that compose with core CALM schemas using `$ref` and `allOf`. They add your organisation's requirements on top of CALM's foundation.

### 2. Review the Standards Documentation

Before creating Standards, familiarise yourself with the concept:

**Prompt:**
```text
Explain the key concepts from the CALM Standards documentation:
1. What are Standards and how do they differ from Patterns?
2. How do Standards use JSON Schema 2020-12?
3. What CALM components can Standards extend?
4. How do Standards integrate with validation?
```

### 3. Understand the Standards Structure

Every Standard follows this base structure:

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Your Standard Title",
  "type": "object",
  "properties": {
    // Your additional properties here
  },
  "required": ["requiredProperty1", "requiredProperty2"],
  "additionalProperties": false
}
```

**Key Characteristics:**
- Follow JSON Schema 2020-12 specification
- Reference core CALM schemas using `$ref`
- Add organisation or domain-specific properties
- Integrate seamlessly with `calm validate`
- Can be shared across teams, organisations, or the community

### 4. Explore Common Use Cases

**Organisation-Level Extensions:**
- **Company Node Requirements**: Cost centres, ownership, compliance tags
- **Interface Specifications**: Authentication requirements, rate limiting
- **Relationship Policies**: Approval workflows, security zones
- **Control Requirements**: Organisational compliance frameworks

**Industry Standards:**
- **Financial Services**: Regulatory compliance, risk classifications
- **Healthcare**: HIPAA compliance, patient data handling
- **Government**: Security clearances, classification levels

### 5. Create a Standards Directory

Set up a place for your organisation's Standards:

```bash
mkdir -p standards
```

### 6. Examine a Simple Standard

Here's an example of a Company Node Standard that requires cost centre and owner:

**File:** `standards/company-node-standard.json`

**Content:**
```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "description": "Organisational requirements for all CALM nodes",
  "type": "object",
  "properties": {
    "costCenter": {
      "type": "string",
      "pattern": "^CC-[0-9]{4}$",
      "description": "Company cost centre code (format: CC-XXXX)"
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

**Prompt:**
```text
Create the file standards/company-node-standard.json with the content shown above.
```

### 7. Understand Schema Composition

Standards compose with core CALM schemas using `allOf`:

```json
{
  "allOf": [
    { "$ref": "https://calm.finos.org/schemas/core.json#/defs/node" },
    { "$ref": "https://company.com/standards/company-node-standard.json" }
  ]
}
```

This says: "This node must satisfy BOTH the core CALM node requirements AND our company's additional requirements."

### 8. Review Standards vs Patterns

**Standards** define WHAT properties must exist:
- "Every node must have a costCenter and owner"
- "All interfaces must specify authentication type"
- Pure schema validation - no specific values

**Patterns** define WHAT specific values must be:
- "The node unique-id must be 'api-gateway'"
- "There must be exactly 3 nodes with these specific names"
- Used for generation and compliance checking

**Together they provide:**
- Standards: Organisation-wide consistency
- Patterns: Specific architectural templates

### 9. Document Your Standards Strategy

**File:** `standards/README.md`

**Prompt:**
```text
Create standards/README.md that documents:

1. What Standards are and how they extend CALM
2. Our company's standard requirements (cost centre, owner, environment)
3. How to use Standards in architectures
4. How Standards differ from Patterns
5. Links to the CALM Standards documentation
```

### 10. Commit Your Work

```bash
git add standards/
git commit -m "Day 15: Introduce CALM Standards for organisational requirements"
git tag day-15
```

## Deliverables / Validation Criteria

Your Day 15 submission should include a commit tagged `day-15` containing:

✅ **Required Files:**
- `standards/company-node-standard.json` - Example company node Standard
- `standards/README.md` - Documentation explaining Standards
- Updated `README.md` - Day 15 marked as complete

✅ **Validation:**
```bash
# Verify standards directory exists
ls standards/

# Verify Standard is valid JSON Schema
cat standards/company-node-standard.json | jq .

# Check tag
git tag | grep -q "day-15"
```

## Resources

- [CALM Standards Documentation](https://calm.finos.org/docs/core-concepts/standards)
- [JSON Schema 2020-12 Specification](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [CALM Standards Creation Guide](https://github.com/finos/architecture-as-code/tree/main/calm-ai/tools/standards-creation.md)

## Tips

- Start simple - add complexity as your organisation's needs become clearer
- Standards should focus on properties that genuinely need consistency
- Document why each required property matters
- Consider starting with just `owner` before adding more requirements
- Standards work best when they're adopted organisation-wide

## Next Steps

Tomorrow (Day 16) you'll create node and relationship Standards that can be used in place of regular CALM components!
