# Day 17: Enforcing Standards with Patterns

## Overview
Learn how Patterns can reference your organisational Standards, ensuring generated and validated architectures comply with company requirements.

## Objective and Rationale
- **Objective:** Create a Company Base Pattern that enforces your Standards on all nodes and relationships
- **Rationale:** Yesterday you learned Patterns enforce structure. Today you'll see how Patterns can also enforce Standards - the properties you defined on Day 15. By referencing Standards in a Pattern, you ensure every architecture that validates against the pattern also has the required organisational properties.

## Requirements

### 1. Understand the Gap

Yesterday's web-app-pattern enforces structure:
- ✅ Must have "api-gateway", "api-service", "app-database" nodes
- ✅ Must have specific relationships

But it doesn't enforce your Standards:
- ❌ Doesn't require `costCenter` on nodes
- ❌ Doesn't require `owner` on nodes
- ❌ Doesn't require `dataClassification` on relationships

**The Goal:** Create a pattern that enforces Standards without constraining specific structure.

### 2. Understand How Patterns Reference Standards

Patterns can use `$ref` to reference your Standards:

```json
{
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "../standards/company-node-standard.json"
      }
    }
  }
}
```

This says: "Every node must comply with company-node-standard.json"

Because your Standards use `allOf` to extend the base CALM node, this gives you:
- Base CALM node requirements (unique-id, node-type, name, description)
- PLUS your Standard requirements (costCenter, owner, environment)

### 3. Create the Company Base Pattern

**File:** `patterns/company-base-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/company-base-pattern.json that enforces our company Standards on all architectures.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.1/meta/calm.json)
2. Have a unique $id (https://example.com/patterns/company-base-pattern.json)
3. Have title "Company Base Pattern" and description explaining it enforces organisational standards
4. Define that all nodes must comply with standards/company-node-standard.json using $ref
5. Define that all relationships must comply with standards/company-relationship-standard.json using $ref

Do NOT use prefixItems, minItems, or maxItems - this pattern should not constrain what nodes exist, only that whatever nodes exist must follow our Standards.
```

### 4. Test with Non-Compliant Architecture

Your existing e-commerce architecture probably doesn't have Standard properties yet:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
```

Should fail! ❌ Nodes are missing `costCenter`, `owner`, etc.

### 5. Test with Compliant Architecture

Create a simple architecture that complies with Standards:

**File:** `architectures/compliant-test.json`

**Prompt:**
```text
Create a minimal test architecture at architectures/compliant-test.json with:

1. One service node "test-service" with all Standard properties:
   - unique-id, node-type, name, description (base CALM)
   - costCenter: "CC-1234"
   - owner: "test-team"
   - environment: "development"

2. One database node "test-database" with all Standard properties:
   - costCenter: "CC-1235"
   - owner: "test-team"
   - environment: "development"

3. One relationship connecting them with Standard properties:
   - dataClassification: "internal"
   - encrypted: true
```

### 6. Validate the Compliant Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json
```

Should pass! ✅

### 7. Understand the Two Types of Patterns

You now have two different pattern types:

| Pattern | Enforces | Use When |
|---------|----------|----------|
| **web-app-pattern** | Specific structure (3 nodes, 2 relationships) | Building a 3-tier web app |
| **company-base-pattern** | Standard properties only | Any architecture type |

**Key insight:** These can be combined. A specific pattern can reference Standards too!

### 8. Update E-Commerce Architecture to Comply

Now let's make your e-commerce architecture comply with Standards:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to ALL nodes:

For each node, add:
- costCenter: appropriate CC-XXXX code
- owner: appropriate team name
- environment: "production"

Use realistic values:
- api-gateway: CC-1001, owner "platform-team"
- order-service: CC-2001, owner "orders-team"
- inventory-service: CC-2002, owner "inventory-team"
- payment-service: CC-3001, owner "payments-team"
- order-database: CC-2001, owner "orders-team"
- inventory-database: CC-2002, owner "inventory-team"
- Actors and system: CC-0000, owner "external" or "platform-team"
```

### 9. Add Standard Properties to Relationships

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to ALL relationships:

For each relationship, add:
- dataClassification: appropriate level
- encrypted: true

Use appropriate classifications:
- Actor to API Gateway: "public"
- API Gateway to services: "internal"
- Service to service: "internal" or "confidential" for payment
- Service to database: "confidential"
```

### 10. Validate Updated E-Commerce Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
```

Should now pass! ✅

### 11. Clean Up Test File

```bash
rm architectures/compliant-test.json
```

### 12. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to add documentation for company-base-pattern.json:

1. What it enforces (Standards only, not structure)
2. Difference from web-app-pattern (structure vs properties)
3. When to use each pattern type
4. How to validate any architecture against company Standards
```

### 13. Commit Your Work

```bash
git add patterns/company-base-pattern.json architectures/ecommerce-platform.json patterns/README.md README.md
git commit -m "Day 17: Create Company Base Pattern to enforce Standards"
git tag day-17
```

## Deliverables / Validation Criteria

Your Day 17 submission should include a commit tagged `day-17` containing:

✅ **Required Files:**
- `patterns/company-base-pattern.json` - Pattern enforcing Standards
- Updated `architectures/ecommerce-platform.json` - With Standard properties
- Updated `patterns/README.md` - Documentation for both patterns
- Updated `README.md` - Day 17 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/company-base-pattern.json

# E-commerce architecture now passes
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json

# Check for Standard properties
grep -q "costCenter" architectures/ecommerce-platform.json
grep -q "dataClassification" architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-17"
```

## Resources

- [JSON Schema $ref](https://json-schema.org/understanding-json-schema/structuring#dollarref)
- Your Standards in `standards/`
- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)

## Tips

- The base pattern is intentionally permissive about structure
- Don't use minItems/maxItems in a base pattern
- Test with both compliant and non-compliant architectures
- Standards + Pattern = Complete governance

## The Pattern Hierarchy

```
Standards (define required properties)
├── company-node-standard.json
└── company-relationship-standard.json
        │
        ▼
Patterns (enforce requirements)
├── company-base-pattern.json (enforces Standards only)
└── web-app-pattern.json (enforces specific structure)
        │
        ▼
Architectures (actual systems)
├── ecommerce-platform.json
└── generated-webapp.json
```

## Next Steps

Tomorrow (Day 18) you'll create a pattern that enforces BOTH structure AND Standards - the complete governance solution!
