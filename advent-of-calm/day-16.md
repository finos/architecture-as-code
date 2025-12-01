# Day 16: Creating a Company Base Pattern

## Overview
Create a Company Base Pattern that enforces your Standards across all architectures.

## Objective and Rationale
- **Objective:** Build a pattern that requires all nodes and relationships to comply with your organisational Standards
- **Rationale:** Standards define WHAT properties are required, but they don't enforce themselves. A Base Pattern acts as the enforcement mechanism - any architecture validated against it must use your Standard-compliant nodes and relationships.

## Requirements

### 1. Understand the Enforcement Problem

Yesterday you created:
- `standards/company-node-standard.json` - extends CALM nodes with costCenter, owner, environment
- `standards/company-relationship-standard.json` - extends CALM relationships with dataClassification, encrypted

**But how do you enforce their use?**

If an architect creates an architecture using plain CALM nodes, your Standards are ignored. You need a pattern that says "all nodes in this architecture must comply with our company node Standard."

### 2. Understand How Patterns Enforce Standards

A pattern can reference your Standards in its node and relationship definitions:

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "./standards/company-node-standard.json"
      }
    }
  }
}
```

This pattern says: "Every node in an architecture validated against this pattern must satisfy the company-node-standard."

### 3. Create the Company Base Pattern

**File:** `patterns/company-base-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/company-base-pattern.json that enforces our company Standards.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.1/meta/calm.json)
2. Have a unique $id (e.g., https://example.com/patterns/company-base-pattern.json)
3. Have a title "Company Base Pattern" and description explaining it enforces organisational standards
4. Define that all nodes must comply with our company-node-standard.json
5. Define that all relationships must comply with our company-relationship-standard.json

Use $ref to reference the Standards files. The pattern should not constrain specific node IDs or counts - it should only enforce that whatever nodes/relationships exist must follow our Standards.
```

### 4. Review the Generated Pattern

The pattern should look something like:

```json
{
  "$schema": "https://calm.finos.org/release/1.1/meta/calm.json",
  "$id": "https://example.com/patterns/company-base-pattern.json",
  "title": "Company Base Pattern",
  "description": "Enforces company Standards on all nodes and relationships",
  "type": "object",
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "../standards/company-node-standard.json"
      }
    },
    "relationships": {
      "type": "array",
      "items": {
        "$ref": "../standards/company-relationship-standard.json"
      }
    }
  }
}
```

### 5. Test with a Non-Compliant Architecture

Your existing e-commerce architecture probably doesn't have the required Standard properties. Let's verify:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
```

This should **fail** because the nodes don't have `costCenter`, `owner`, etc.

### 6. Create a Compliant Test Architecture

**File:** `architectures/compliant-test.json`

**Prompt:**
```text
Create a simple test architecture at architectures/compliant-test.json with:

1. Two nodes:
   - A service node "test-service" with all company Standard properties (costCenter: "CC-1234", owner: "test-team", environment: "development")
   - A database node "test-database" with all company Standard properties

2. One relationship:
   - Connects test-service to test-database with company relationship Standard properties (dataClassification: "internal", encrypted: true)

This is a minimal architecture to test our company base pattern.
```

### 7. Validate the Compliant Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json
```

This should **pass** ✅

### 8. Understand the Enforcement Flow

```
Standards (define properties)
    ↓
Company Base Pattern (enforces Standards)
    ↓
Architecture (validated against pattern)
```

**The key insight:** The pattern is the enforcement mechanism. Standards alone are just definitions - patterns make them mandatory.

### 9. Document the Pattern

**File:** `patterns/README.md`

**Prompt:**
```text
Create patterns/README.md that documents:

1. What the Company Base Pattern does
2. How it enforces Standards via $ref
3. How to validate architectures against it
4. The validation flow: Standards → Pattern → Architecture
5. What happens when validation fails
```

### 10. Plan for Specific Patterns

The Company Base Pattern is generic - it enforces Standards but doesn't define specific architecture structures.

For specific architectures (like e-commerce), you'll create patterns that:
1. Extend or reference the Company Base Pattern
2. Add specific structural requirements (required nodes, relationships)

This gives you layered governance:
- **Layer 1**: Company Base Pattern - "all nodes need costCenter and owner"
- **Layer 2**: Specific Pattern (e.g., e-commerce) - "must have api-gateway, order-service, etc."

### 11. Commit Your Work

```bash
git add patterns/ architectures/compliant-test.json
git commit -m "Day 16: Create Company Base Pattern to enforce Standards"
git tag day-16
```

## Deliverables / Validation Criteria

Your Day 16 submission should include a commit tagged `day-16` containing:

✅ **Required Files:**
- `patterns/company-base-pattern.json` - Pattern enforcing Standards
- `patterns/README.md` - Documentation
- `architectures/compliant-test.json` - Test architecture that passes validation
- Updated `README.md` - Day 16 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/company-base-pattern.json

# Compliant architecture passes
calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json

# Check tag
git tag | grep -q "day-16"
```

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- [JSON Schema $ref](https://json-schema.org/understanding-json-schema/structuring#dollarref)
- Your Standards in `standards/`

## Tips

- The base pattern should be permissive about structure but strict about properties
- Don't set minItems/maxItems in the base pattern - that's for specific patterns
- Test with both compliant and non-compliant architectures
- Keep the pattern simple - it should only enforce Standards, nothing else

## The Complete Picture

| Layer | Purpose | Example |
|-------|---------|---------|
| **Standards** | Define required properties | costCenter, owner, encrypted |
| **Base Pattern** | Enforce Standards on all architectures | company-base-pattern.json |
| **Specific Pattern** | Define specific architecture structure | ecommerce-pattern.json (Day 18) |
| **Architecture** | Actual system definition | ecommerce-platform.json |

## Next Steps

Tomorrow (Day 17) you'll update your e-commerce architecture to comply with the Standards and validate it against the Company Base Pattern!
