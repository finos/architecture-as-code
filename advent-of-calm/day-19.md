# Day 19: Enforcing Standards with Patterns

## Overview
Learn how Patterns can reference your organisational Standards, ensuring generated and validated architectures comply with company requirements. You'll also learn how to use URL mapping for local development.

## Objective and Rationale
- **Objective:** Create a Company Base Pattern that enforces your Standards on all nodes and relationships
- **Rationale:** Yesterday you created Standards with canonical URLs (like `https://example.com/standards/...`). Today you'll create a Pattern that references those Standards and learn how to validate locally before publishing.

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

### 2. Understand the Local Development Challenge

Your Standards have canonical `$id` URLs like:
```json
{
  "$id": "https://example.com/standards/company-node-standard.json"
}
```

This is best practice - it gives each Standard a globally unique identifier that will work when published. However, during development these URLs don't resolve to anything yet!

**The Solution:** URL-to-local-file mapping. The CALM CLI can map these URLs to your local files during development, so you can validate before publishing.

### 3. Create the URL Mapping File

Create a mapping file that tells the CLI where to find your Standards locally:

**File:** `url-mapping.json`

```json
{
  "https://example.com/standards/company-node-standard.json": "standards/company-node-standard.json",
  "https://example.com/standards/company-relationship-standard.json": "standards/company-relationship-standard.json",
  "https://example.com/patterns/company-base-pattern.json": "patterns/company-base-pattern.json"
}
```

This tells the CLI: "When you see `https://example.com/standards/company-node-standard.json`, load it from `standards/company-node-standard.json` instead."

### 4. Understand How Patterns Reference Standards

Patterns use `$ref` to reference your Standards by their canonical URL:

```json
{
  "properties": {
    "nodes": {
      "type": "array",
      "items": {
        "$ref": "https://example.com/standards/company-node-standard.json"
      }
    }
  }
}
```

This says: "Every node must comply with company-node-standard.json"

Because your Standards use `allOf` to extend the base CALM node, this gives you:
- Base CALM node requirements (unique-id, node-type, name, description)
- PLUS your Standard requirements (costCenter, owner, environment)

### 5. Create the Company Base Pattern

**File:** `patterns/company-base-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/company-base-pattern.json that enforces our company Standards on all architectures.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.1/meta/calm.json)
2. Have a unique $id (https://example.com/patterns/company-base-pattern.json)
3. Have title "Company Base Pattern" and description explaining it enforces organizational standards
4. Reference the node standard using its $id URL: https://example.com/standards/company-node-standard.json
5. Reference the relationship standard using its $id URL: https://example.com/standards/company-relationship-standard.json

Do NOT use prefixItems, minItems, or maxItems - this pattern should not constrain what nodes exist, only that whatever nodes exist must follow our Standards.
```

### 6. Test with Non-Compliant Architecture

Your existing e-commerce architecture probably doesn't have Standard properties yet. Use the `-u` flag to provide the URL mapping:

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json -u url-mapping.json
```

Should fail! ❌ Nodes are missing `costCenter`, `owner`, etc.

**Note:** The `-u url-mapping.json` flag tells the CLI to use your local files when resolving the `https://example.com/...` URLs.

### 7. Test with Compliant Architecture

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

### 8. Validate the Compliant Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/compliant-test.json -u url-mapping.json
```

Should pass! ✅

### 9. Understand the Two Types of Patterns

You now have two different pattern types:

| Pattern | Enforces | Use When |
|---------|----------|----------|
| **web-app-pattern** | Specific structure (3 nodes, 2 relationships) | Building a 3-tier web app |
| **company-base-pattern** | Standard properties only | Any architecture type |

**Key insight:** These can be combined. A specific pattern can reference Standards too!

### 10. Update E-Commerce Architecture to Comply

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

### 11. Add Standard Properties to Relationships

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

### 12. Validate Updated E-Commerce Architecture

```bash
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json -u url-mapping.json
```

Should now pass! ✅

### 13. Clean Up Test File

```bash
rm architectures/compliant-test.json
```

### 14. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to add documentation for company-base-pattern.json:

1. What it enforces (Standards only, not structure)
2. Difference from web-app-pattern (structure vs properties)
3. When to use each pattern type
4. How to validate any architecture against company Standards using the -u flag
```

### 15. Commit Your Work

```bash
git add url-mapping.json patterns/company-base-pattern.json architectures/ecommerce-platform.json patterns/README.md README.md
git commit -m "Day 19: Create Company Base Pattern to enforce Standards"
git tag day-19
```

## Deliverables / Validation Criteria

Your Day 19 submission should include a commit tagged `day-19` containing:

✅ **Required Files:**
- `url-mapping.json` - Maps canonical URLs to local files
- `patterns/company-base-pattern.json` - Pattern enforcing Standards
- Updated `architectures/ecommerce-platform.json` - With Standard properties
- Updated `patterns/README.md` - Documentation for both patterns
- Updated `README.md` - Day 19 marked as complete

✅ **Validation:**
```bash
# URL mapping file exists
test -f url-mapping.json

# Pattern exists
test -f patterns/company-base-pattern.json

# E-commerce architecture now passes (with URL mapping)
calm validate -p patterns/company-base-pattern.json -a architectures/ecommerce-platform.json -u url-mapping.json

# Check for Standard properties
grep -q "costCenter" architectures/ecommerce-platform.json
grep -q "dataClassification" architectures/ecommerce-platform.json

# Check tag
git tag | grep -q "day-19"
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
- **Always use `-u url-mapping.json`** when validating locally with Standards that have canonical URLs
- Once your Standards are published to their canonical URLs, you won't need the URL mapping anymore

## Understanding URL Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Local Development                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Pattern references:                                                       │
│   "$ref": "https://example.com/standards/company-node-standard.json"       │
│                              │                                              │
│                              ▼                                              │
│   url-mapping.json:                                                         │
│   {                                                                         │
│     "https://example.com/standards/company-node-standard.json":            │
│         "standards/company-node-standard.json"  ◄── Local file             │
│   }                                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           After Publishing                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Pattern references:                                                       │
│   "$ref": "https://example.com/standards/company-node-standard.json"       │
│                              │                                              │
│                              ▼                                              │
│   Resolves directly to published URL ✓                                     │
│   (No URL mapping needed)                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

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

Tomorrow (Day 20) you'll create a pattern that enforces BOTH structure AND Standards - the complete governance solution!
