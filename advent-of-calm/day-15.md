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
Standards are JSON Schema 2020-12 documents that compose with core CALM schemas using `allOf`. They add your organisation's requirements on top of CALM's foundation.

### 2. Review the Standards Documentation

Before creating Standards, familiarise yourself with the concept:

**Prompt:**
```text
Explain the key concepts from the CALM Standards documentation:
1. What are Standards and why are they useful?
2. How do Standards use JSON Schema 2020-12?
3. What CALM components can Standards extend?
```

### 3. Understand the Standards Structure

Standards extend core CALM definitions using `allOf` composition:

```json
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Company Node Standard",
  "allOf": [
    { "$ref": "https://calm.finos.org/release/1.1/meta/core.json#/defs/node" },
    {
      "type": "object",
      "properties": {
        "costCenter": { "type": "string" },
        "owner": { "type": "string" }
      },
      "required": ["costCenter", "owner"]
    }
  ]
}
```

This says: "A node using this Standard must satisfy BOTH the core CALM node requirements AND our additional properties."

### 4. Explore Common Use Cases

**Organisation-Level Extensions:**
- **Company Node Requirements**: Cost centres, ownership, compliance tags
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

### 6. Create Your First Node Standard

Create a Company Node Standard that extends the core CALM node with organisational requirements.

**Prompt:**
```text
Create a CALM Standard at standards/company-node-standard.json that extends the core CALM node definition.

Additional properties to require:
1. costCenter - a string that must match the pattern CC- followed by exactly 4 digits (e.g., CC-1234)
2. owner - a string for the team or individual responsible
3. environment - must be one of: development, staging, or production

Make costCenter and owner required. Include helpful descriptions for each property.
```

Review the generated file - it should use `allOf` to reference the base CALM node schema and add your organisation's properties on top.

### 7. Create a Relationship Standard

Create a Standard for relationships that ensures security classification:

**Prompt:**
```text
Create a CALM Standard at standards/company-relationship-standard.json that extends the core CALM relationship definition.

Additional properties to require:
1. dataClassification - must be one of: public, internal, confidential, restricted
2. encrypted - a boolean indicating if the connection is encrypted

Make both properties required. Include helpful descriptions.
```

### 8. Understand What the Standards Do

The generated Standards compose two schemas together:

**For Nodes:**
1. **Base CALM node** - provides `unique-id`, `node-type`, `name`, `description`
2. **Your extensions** - adds `costCenter`, `owner`, `environment`

**For Relationships:**
1. **Base CALM relationship** - provides `unique-id`, `relationship-type`, `description`
2. **Your extensions** - adds `dataClassification`, `encrypted`

When you use these Standards, components must satisfy BOTH sets of requirements. This is the power of Standards - you extend CALM without modifying it.

### 9. Understand the Value of Standards

**What Standards Give You:**
- **Consistency**: Every architecture follows the same rules
- **Discoverability**: Easy to find who owns what
- **Compliance**: Automated validation of requirements
- **Onboarding**: New team members understand expectations

**Example Scenarios:**
- "Who owns this service?" → Check the `owner` property
- "What's the cost allocation?" → Check the `costCenter` property
- "Is this connection secure?" → Check the `encrypted` and `dataClassification` properties

### 10. Document Your Standards

**File:** `standards/README.md`

**Prompt:**
```text
Create standards/README.md that documents:

1. What Standards are and how they extend CALM using allOf composition
2. Our company's node standard requirements (cost centre, owner, environment)
3. Our company's relationship standard requirements (data classification, encrypted)
4. How these Standards will be enforced (preview: via patterns in Day 16)
```

### 11. Commit Your Work

```bash
git add standards/
git commit -m "Day 15: Create CALM Standards for organisational node and relationship requirements"
git tag day-15
```

## Deliverables / Validation Criteria

Your Day 15 submission should include a commit tagged `day-15` containing:

✅ **Required Files:**
- `standards/company-node-standard.json` - Node Standard with costCenter, owner, environment
- `standards/company-relationship-standard.json` - Relationship Standard with dataClassification, encrypted
- `standards/README.md` - Documentation explaining the Standards
- Updated `README.md` - Day 15 marked as complete

✅ **Validation:**
```bash
# Verify standards directory exists
ls standards/

# Verify Standards are valid JSON
cat standards/company-node-standard.json | jq .
cat standards/company-relationship-standard.json | jq .

# Check tag
git tag | grep -q "day-15"
```

## Resources

- [CALM Standards Documentation](https://calm.finos.org/docs/core-concepts/standards)
- [JSON Schema 2020-12 Specification](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [JSON Schema allOf](https://json-schema.org/understanding-json-schema/reference/combining#allOf)

## Tips

- Start simple - add complexity as your organisation's needs become clearer
- Standards should focus on properties that genuinely need consistency
- Document why each required property matters
- The `allOf` composition is key - it extends rather than replaces CALM
- Standards alone don't enforce anything - tomorrow we'll create a pattern to enforce them

## Next Steps

Tomorrow (Day 16) you'll create a Company Base Pattern that enforces these Standards across all architectures!
