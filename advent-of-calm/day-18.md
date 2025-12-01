# Day 18: Combining Structure and Standards in Patterns

## Overview
Create a pattern that enforces both specific architecture structure AND organisational Standards.

## Objective and Rationale
- **Objective:** Create an E-Commerce Pattern that requires specific nodes AND Standard properties on each
- **Rationale:** Real governance needs both: "You must have these components" (structure) AND "Each component must have these properties" (Standards). By combining them in one pattern, you get complete governance - generated architectures are immediately compliant.

## Requirements

### 1. Understand the Complete Picture

You now have:
- **Standards** (Day 15): Define required properties (costCenter, owner, etc.)
- **Structure Pattern** (Day 16): Enforces specific nodes exist
- **Base Pattern** (Day 17): Enforces Standards on any architecture

**Today's goal:** Combine structure + Standards in one pattern.

### 2. Review Your E-Commerce Architecture

Your e-commerce architecture from Day 7 (updated in Day 17) has:
- Specific nodes (api-gateway, order-service, etc.)
- Standard properties (costCenter, owner, dataClassification)

Let's create a pattern that requires both.

### 3. Create the E-Commerce Pattern

**File:** `patterns/ecommerce-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/ecommerce-pattern.json for e-commerce platforms.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.1/meta/calm.json)
2. Have a unique $id (https://example.com/patterns/ecommerce-pattern.json)
3. Have title "E-Commerce Platform Pattern"

4. Require specific nodes using prefixItems, each with Standard properties:
   - api-gateway (service) with costCenter, owner, environment
   - order-service (service) with costCenter, owner, environment
   - inventory-service (service) with costCenter, owner, environment
   - payment-service (service) with costCenter, owner, environment
   - order-database (database) with costCenter, owner, environment
   - inventory-database (database) with costCenter, owner, environment

5. Require specific relationships with Standard properties:
   - gateway-to-order: connects api-gateway to order-service, with dataClassification, encrypted
   - gateway-to-inventory: connects api-gateway to inventory-service
   - order-to-payment: connects order-service to payment-service
   - order-to-db: connects order-service to order-database
   - inventory-to-db: connects inventory-service to inventory-database

Use const for structural values (unique-id, node-type, name).
Include Standard properties but don't use const for them (allow customization).
```

### 4. Test Generation

Generate an architecture from the pattern:

```bash
calm generate -p patterns/ecommerce-pattern.json -o architectures/ecommerce-generated.json
```

Review the generated file:
- ✅ Has all required nodes with correct IDs and types
- ✅ Has all required relationships
- ✅ Has Standard property placeholders on every node
- ✅ Has Standard property placeholders on every relationship

### 5. Customize the Generated Architecture

**Prompt:**
```text
Update architectures/ecommerce-generated.json to replace placeholder Standard values:

Nodes:
- api-gateway: CC-1001, platform-team, production
- order-service: CC-2001, orders-team, production
- inventory-service: CC-2002, inventory-team, production
- payment-service: CC-3001, payments-team, production
- order-database: CC-2001, orders-team, production
- inventory-database: CC-2002, inventory-team, production

Relationships:
- All: encrypted true
- order-to-payment: dataClassification "confidential"
- Others: dataClassification "internal"
```

### 6. Validate the Generated Architecture

```bash
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-generated.json
```

Should pass! ✅

### 7. Validate Original Architecture

Your original e-commerce architecture should also pass:

```bash
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json
```

Should pass! ✅ (assuming it has all required nodes and Standard properties)

### 8. Test Governance - Missing Node

```bash
# Create copy without payment-service
cat architectures/ecommerce-generated.json | jq 'del(.nodes[] | select(."unique-id" == "payment-service"))' > /tmp/missing-node.json

calm validate -p patterns/ecommerce-pattern.json -a /tmp/missing-node.json
```

Should fail! ❌ Missing required node.

### 9. Test Governance - Missing Standard Property

```bash
# Create copy without costCenter on first node
cat architectures/ecommerce-generated.json | jq '.nodes[0] |= del(.costCenter)' > /tmp/missing-prop.json

calm validate -p patterns/ecommerce-pattern.json -a /tmp/missing-prop.json
```

Should fail! ❌ Missing required Standard property.

### 10. Compare Pattern Types

You now have three pattern types:

| Pattern | Structure | Standards | Use Case |
|---------|-----------|-----------|----------|
| web-app-pattern | ✅ 3 nodes | ❌ | Quick web app scaffold |
| company-base-pattern | ❌ Any | ✅ | Validate any architecture |
| ecommerce-pattern | ✅ 6+ nodes | ✅ | Full e-commerce governance |

### 11. Clean Up Test Files

```bash
rm architectures/ecommerce-generated.json
```

(Or keep it as an example)

### 12. Update Documentation

**Prompt:**
```text
Update patterns/README.md to add the ecommerce-pattern.json and explain:

1. The three pattern types and when to use each
2. How ecommerce-pattern combines structure + Standards
3. The complete validation it provides
4. Example generation and validation commands
```

### 13. Commit Your Work

```bash
git add patterns/ecommerce-pattern.json patterns/README.md README.md
git commit -m "Day 18: Create E-Commerce Pattern with structure and Standards"
git tag day-18
```

## Deliverables / Validation Criteria

Your Day 18 submission should include a commit tagged `day-18` containing:

✅ **Required Files:**
- `patterns/ecommerce-pattern.json` - Pattern with structure + Standards
- Updated `patterns/README.md` - Documentation for all three patterns
- Updated `README.md` - Day 18 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/ecommerce-pattern.json

# Original e-commerce validates
calm validate -p patterns/ecommerce-pattern.json -a architectures/ecommerce-platform.json

# Generation works
calm generate -p patterns/ecommerce-pattern.json -o /tmp/test-ecommerce.json

# Check tag
git tag | grep -q "day-18"
```

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- Your Standards in `standards/`
- Your existing patterns in `patterns/`

## Tips

- Include Standard properties in each node/relationship definition
- Use const for structure, leave Standards flexible
- Test both structure violations and property violations
- The combined pattern is the most powerful governance tool

## The Complete Governance Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    E-Commerce Pattern                        │
│  (Structure + Standards)                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Required Structure:                                        │
│  ├── api-gateway (service)                                 │
│  ├── order-service (service)                               │
│  ├── inventory-service (service)                           │
│  ├── payment-service (service)                             │
│  ├── order-database (database)                             │
│  └── inventory-database (database)                         │
│                                                             │
│  Required Properties (from Standards):                      │
│  ├── Nodes: costCenter, owner, environment                 │
│  └── Relationships: dataClassification, encrypted          │
│                                                             │
│  Result: Complete governance in one pattern                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

Tomorrow (Day 19) you'll learn how to extract patterns from existing architectures - turning proven designs into reusable templates!
