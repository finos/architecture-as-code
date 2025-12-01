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
1. What are Standards and why are they useful?
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

### 6. Create Your First Standard

Create a Company Node Standard that extends the core CALM node with organisational requirements.

**File:** `standards/company-node-standard.json`

**Prompt:**
```text
Create a CALM Standard at standards/company-node-standard.json that extends the core CALM node definition.

The Standard should use allOf to compose the base CALM node with additional company requirements:

Additional properties to require:
1. costCenter - a string that must match the pattern CC- followed by exactly 4 digits (e.g., CC-1234)
2. owner - a string for the team or individual responsible
3. environment - must be one of: development, staging, or production

Make costCenter and owner required. Include helpful descriptions for each property.
```

Review the generated file - it should use `allOf` to reference the base CALM node schema and add your organisation's properties on top.

### 7. Understand What the Standard Does

The generated Standard composes two schemas together:
1. **Base CALM node** - provides `unique-id`, `node-type`, `name`, `description`
2. **Your extensions** - adds `costCenter`, `owner`, `environment`

When you use this Standard, nodes must satisfy BOTH sets of requirements. This is the power of Standards - you extend CALM without modifying it.

### 8. Understand the Value of Standards

**What Standards Give You:**
- **Consistency**: Every architecture follows the same rules
- **Discoverability**: Easy to find who owns what
- **Compliance**: Automated validation of requirements
- **Onboarding**: New team members understand expectations

**Example Scenarios:**
- "Who owns this service?" → Check the `owner` property
- "What's the cost allocation?" → Check the `costCenter` property
- "Is this production-ready?" → Check the `criticality` and `environment` properties

### 9. Document Your Standards Strategy

**File:** `standards/README.md`

**Prompt:**
```text
Create standards/README.md that documents:

1. What Standards are and how they extend CALM using allOf composition
2. Our company's standard node requirements (cost centre, owner, environment)
3. How the company-node-standard.json works
4. Links to the CALM Standards documentation
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
