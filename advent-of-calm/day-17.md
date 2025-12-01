# Day 17: Apply Standards to Your E-Commerce Architecture

## Overview
Update your e-commerce architecture to comply with the organisational Standards you created.

## Objective and Rationale
- **Objective:** Modify your existing e-commerce architecture to include all properties required by your node and relationship Standards
- **Rationale:** Standards are only useful when applied. Today you'll experience the practical workflow of bringing an existing architecture into compliance with organisational requirements, understanding both the benefits and the effort involved.

## Requirements

### 1. Review Your Standards

First, remind yourself what your Standards require:

**Prompt:**
```text
Review the Standards in the standards/ directory and summarize:
1. What does service-node-standard.json require?
2. What does database-node-standard.json require?
3. What does connection-standard.json require?
```

### 2. Audit Your Current Architecture

Check your e-commerce architecture against the Standards:

**Prompt:**
```text
Analyze architectures/ecommerce-platform.json and identify:
1. Which service nodes need owner, costCenter, and criticality added?
2. Which database nodes need dataClassification and encryptionAtRest added?
3. Which relationships need dataClassification and encrypted added?
```

### 3. Update Service Nodes

Add Standard-required properties to each service node:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all service nodes (api-gateway, order-service, inventory-service, payment-service):

For each service, add:
- owner: appropriate team name
- costCenter: a valid cost centre code (CC-XXXX format)
- criticality: appropriate level (low/medium/high/critical)
- environment: "production"
- repository: a placeholder GitHub URL
- oncallTeam: appropriate Slack channel

Use realistic values that make sense for each service:
- API Gateway: high criticality, platform-team owner
- Order Service: critical, orders-team owner
- Inventory Service: high, inventory-team owner
- Payment Service: critical, payments-team owner
```

### 4. Update Database Nodes

Add Standard-required properties to database nodes:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all database nodes (order-database, inventory-database):

For each database, add:
- owner: appropriate team name
- costCenter: valid cost centre code
- dataClassification: appropriate level (public/internal/confidential/restricted)
- backupSchedule: appropriate frequency
- retentionPeriod: appropriate duration
- encryptionAtRest: true
- dbaContact: DBA team contact

Order Database should be "confidential" (contains customer orders)
Inventory Database should be "internal" (stock levels)
```

### 5. Update Relationships

Add Standard-required properties to connection relationships:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to add Standard-compliant properties to all "connects" relationships:

For each connection, add:
- dataClassification: appropriate level based on what data flows through
- encrypted: true (all connections should be encrypted)
- authRequired: true for service-to-service calls
- approvedBy: "security-team"
- approvalDate: today's date

Consider the data sensitivity:
- API Gateway to services: internal
- Order Service to Payment Service: confidential (payment data)
- Services to databases: matches database classification
```

### 6. Validate Your Changes

Ensure the architecture still validates:

```bash
calm validate -a architectures/ecommerce-platform.json
```

Should pass! ✅

### 7. Visualize the Updated Architecture

**Steps:**
1. Open `architectures/ecommerce-platform.json` in VSCode
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. Click on nodes to see the new metadata
4. Verify the Standard properties are visible

### 8. Create a Compliance Report

Document how your architecture now complies with Standards:

**File:** `docs/compliance-report.md`

**Prompt:**
```text
Create docs/compliance-report.md that documents:

1. Standards Applied:
   - List each Standard applied to the architecture

2. Service Nodes Compliance:
   - List each service with its owner, costCenter, criticality

3. Database Nodes Compliance:
   - List each database with its dataClassification, encryptionAtRest

4. Relationship Compliance:
   - Summary of connection security properties

5. Benefits Achieved:
   - Clear ownership for every component
   - Cost allocation through cost centres
   - Security classification for all data
   - Audit trail through approval dates
```

### 9. Update Your README

Update README.md to reflect Standards compliance:

```markdown
- [x] Day 15: Understanding CALM Standards
- [x] Day 16: Creating Node and Relationship Standards
- [x] Day 17: Apply Standards to E-Commerce Architecture
```

### 10. Commit Your Work

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
# Architecture validates
calm validate -a architectures/ecommerce-platform.json

# Check for Standard properties in services
grep -q "costCenter" architectures/ecommerce-platform.json
grep -q "criticality" architectures/ecommerce-platform.json

# Check for Standard properties in databases
grep -q "dataClassification" architectures/ecommerce-platform.json
grep -q "encryptionAtRest" architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-17"
```

## Resources

- [CALM Standards Documentation](https://calm.finos.org/docs/core-concepts/standards)
- Your Standards in `standards/` directory
- [JSON Schema Validation](https://json-schema.org/understanding-json-schema/reference/generic.html)

## Tips

- Work through one node type at a time (services, then databases, then relationships)
- Use realistic values that would make sense in a real organisation
- The first architecture is the hardest - future ones will be faster
- Standards make the architecture self-documenting
- Consider creating a template with Standard properties pre-filled

## Reflection

After applying Standards, consider:
- How much additional context does the architecture now provide?
- Would a new team member understand ownership and criticality?
- Could you generate a cost report from the costCenter values?
- Is the security posture clearer with dataClassification on everything?

This is the power of Standards - consistent, queryable, auditable metadata across all your architectures.

## Next Steps

Tomorrow (Day 18) you'll create your first CALM Pattern - reusable templates that combine with Standards for powerful governance!
