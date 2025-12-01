# Day 17: Apply Standards to Your E-Commerce Architecture

## Overview
Update your e-commerce architecture to comply with your organisational Standards and validate it against the Company Base Pattern.

## Objective and Rationale
- **Objective:** Modify your existing e-commerce architecture to include all properties required by your Standards
- **Rationale:** Standards are only useful when applied. Today you'll experience the practical workflow of bringing an existing architecture into compliance, understanding both the benefits and the effort involved.

## Requirements

### 1. Review Your Standards Requirements

First, remind yourself what your Standards require:

**Node Standard (company-node-standard.json):**
- `costCenter` - pattern CC-XXXX (required)
- `owner` - team or individual (required)
- `environment` - development/staging/production

**Relationship Standard (company-relationship-standard.json):**
- `dataClassification` - public/internal/confidential/restricted (required)
- `encrypted` - boolean (required)

### 2. Validate Current State

First, confirm your e-commerce architecture doesn't yet comply:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
```

You should see validation errors for missing properties.

### 3. Update Service Nodes

Add Standard-required properties to each service node:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all service nodes (api-gateway, order-service, inventory-service, payment-service).

For each service, add:
- costCenter: a valid cost centre code (CC-XXXX format)
- owner: appropriate team name
- environment: "production"

Use realistic values that make sense for each service:
- API Gateway: CC-1001, owner "platform-team"
- Order Service: CC-2001, owner "orders-team"
- Inventory Service: CC-2002, owner "inventory-team"
- Payment Service: CC-3001, owner "payments-team"
```

### 4. Update Database Nodes

Add Standard-required properties to database nodes:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all database nodes (order-database, inventory-database).

For each database, add:
- costCenter: valid cost centre code
- owner: appropriate team name
- environment: "production"

Use:
- Order Database: CC-2001, owner "orders-team"
- Inventory Database: CC-2002, owner "inventory-team"
```

### 5. Update Actor Nodes

Actors also need Standard properties:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to actor nodes (customer, admin).

For actors, add:
- costCenter: "CC-0000" (external/not applicable)
- owner: "external" for customer, "admin-team" for admin
- environment: "production"
```

### 6. Update System Node

The system container node needs properties too:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to the system node (ecommerce-platform).

Add:
- costCenter: "CC-1000" (platform-level)
- owner: "platform-team"
- environment: "production"
```

### 7. Update Relationships

Add Standard-required properties to all relationships:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all relationships.

For each relationship, add:
- dataClassification: appropriate level based on data flowing through
- encrypted: true (all connections should be encrypted)

Consider the data sensitivity:
- Actor to API Gateway: "public" (customer-facing)
- API Gateway to services: "internal"
- Order Service to Payment Service: "confidential" (payment data)
- Services to databases: "confidential" (stored data)
```

### 8. Validate Against Company Base Pattern

Now validate your updated architecture:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json
```

Should pass! ✅

If there are errors, review which nodes or relationships are missing properties.

### 9. Also Validate Against Base CALM Schema

Ensure the architecture still validates against the base CALM schema:

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should also pass! ✅

### 10. Visualize the Updated Architecture

**Steps:**
1. Open `architectures/ecommerce-platform.json` in VSCode
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. Click on nodes to see the new metadata
4. Verify the Standard properties are visible

### 11. Create a Compliance Summary

**File:** `docs/compliance-report.md`

**Prompt:**
```text
Create docs/compliance-report.md that summarises:

1. Standards Applied:
   - Company Node Standard
   - Company Relationship Standard

2. Node Compliance Summary:
   - List each node with its costCenter and owner

3. Relationship Compliance Summary:
   - List each relationship with its dataClassification

4. Validation Results:
   - Passes company-base-pattern.json ✅
   - Passes base CALM schema ✅

5. Benefits Achieved:
   - Clear ownership for every component
   - Cost allocation through cost centres
   - Security classification for all data flows
```

### 12. Commit Your Work

```bash
git add architectures/ecommerce-platform.json docs/compliance-report.md README.md
git commit -m "Day 17: Apply organisational Standards to e-commerce architecture"
git tag day-17
```

## Deliverables / Validation Criteria

Your Day 17 submission should include a commit tagged `day-17` containing:

✅ **Required Files:**
- Updated `architectures/ecommerce-platform.json` with Standard-compliant properties
- `docs/compliance-report.md` - Compliance documentation
- Updated `README.md` - Day 17 marked as complete

✅ **Validation:**
```bash
# Architecture validates against Company Base Pattern
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json

# Architecture validates against base CALM schema
calm validate -a architectures/ecommerce-platform.json

# Check for Standard properties
grep -q "costCenter" architectures/ecommerce-platform.json
grep -q "dataClassification" architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-17"
```

## Resources

- Your Standards in `standards/`
- Your Company Base Pattern in `patterns/company-base-pattern.json`
- [CALM Validation](https://github.com/finos/architecture-as-code/tree/main/cli#validate)

## Tips

- Work through one node type at a time (services, then databases, then actors)
- Use realistic values that would make sense in a real organisation
- If validation fails, check the error message to see which property is missing
- The first architecture is the hardest - future ones will be faster with patterns

## Reflection

After applying Standards, consider:
- How much additional context does the architecture now provide?
- Would a new team member understand ownership and criticality?
- Could you generate a cost report from the costCenter values?
- Is the security posture clearer with dataClassification on everything?

This is the power of Standards - consistent, queryable, auditable metadata across all your architectures.

## The Workflow So Far

```
Day 15: Created Standards (what properties are required)
    ↓
Day 16: Created Company Base Pattern (enforces Standards)
    ↓
Day 17: Applied Standards to architecture (compliance)
```

## Next Steps

Tomorrow (Day 18) you'll create specific patterns that build on the Company Base Pattern for generation and structural enforcement!
