# Day 18: Create Your First Specific Pattern

## Overview
Create a Web Application Pattern that enforces both your organisational Standards AND specific architectural structure.

## Objective and Rationale
- **Objective:** Create a pattern that generates and validates a specific architecture type while inheriting your Company Standards
- **Rationale:** The Company Base Pattern ensures all nodes have required properties, but doesn't define what nodes must exist. Specific patterns add structural requirements - "you must have these exact nodes" - on top of the Standards enforcement.

## Requirements

### 1. Understand Layered Patterns

You now have:
- **Standards** - Define required properties (costCenter, owner, etc.)
- **Company Base Pattern** - Enforces Standards on all architectures

Today you'll add:
- **Specific Pattern** - Defines required structure AND inherits Standard requirements

**The pattern hierarchy:**
```
Specific Pattern (e.g., web-app-pattern)
    └── References Standards
        └── Standards reference core CALM
```

### 2. Understand Pattern Capabilities

Patterns have a dual superpower:

**Power 1 - Generation:**
```bash
calm generate -p my-pattern.json -o new-architecture.json
```
Creates an architecture scaffold with required nodes, relationships, and properties.

**Power 2 - Validation:**
```bash
calm validate -p my-pattern.json -a existing-architecture.json
```
Checks that an architecture has the required structure and properties.

### 3. Create a Web Application Pattern

Create a pattern for a standard 3-tier web application that includes your Standards.

**File:** `patterns/web-app-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/web-app-pattern.json for a 3-tier web application.

The pattern should:
1. Use the CALM pattern schema
2. Define exactly 3 required nodes using prefixItems:
   - "web-frontend" (node-type: webclient)
   - "api-service" (node-type: service)
   - "app-database" (node-type: database)
3. Each node must include our Standard properties with placeholder values:
   - costCenter: "CC-0000"
   - owner: "team-name"
   - environment: "development"
4. Define exactly 2 required relationships:
   - frontend-to-api: connects web-frontend to api-service
   - api-to-database: connects api-service to app-database
5. Each relationship must include our Standard properties:
   - dataClassification: "internal"
   - encrypted: true

Use const for structural values (unique-id, node-type, name) but not for Standard properties so users can customize them.
```

### 4. Test Generation

Generate an architecture from your pattern:

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json
```

Open `architectures/generated-webapp.json` and verify:
- ✅ Has exactly 3 nodes with correct IDs and types
- ✅ Has exactly 2 relationships
- ✅ All nodes have Standard properties (costCenter, owner, environment)
- ✅ All relationships have Standard properties (dataClassification, encrypted)

### 5. Customize the Generated Architecture

The generated architecture has placeholder values. Update them:

**Prompt:**
```text
Update architectures/generated-webapp.json to replace placeholder values with realistic ones:

For web-frontend:
- costCenter: "CC-1001"
- owner: "frontend-team"
- environment: "production"

For api-service:
- costCenter: "CC-1002"
- owner: "api-team"
- environment: "production"

For app-database:
- costCenter: "CC-1003"
- owner: "data-team"
- environment: "production"

Update relationship dataClassification values appropriately (api-to-database should be "confidential").
```

### 6. Validate Against the Pattern

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass! ✅

### 7. Test Governance - Break the Structure

Create a broken version to prove the pattern catches violations:

**Prompt:**
```text
Create architectures/broken-webapp.json by copying generated-webapp.json and:
1. Remove the app-database node entirely
2. Remove the api-to-database relationship

This should fail pattern validation because the required structure is missing.
```

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json
```

Should fail! ❌ The pattern catches the missing node.

Clean up:
```bash
rm architectures/broken-webapp.json
```

### 8. Test Governance - Break the Standards

Try removing a Standard property:

**Prompt:**
```text
Create architectures/broken-standards.json by copying generated-webapp.json and removing the costCenter property from web-frontend.
```

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-standards.json
```

Should fail! ❌ The pattern catches the missing Standard property.

Clean up:
```bash
rm architectures/broken-standards.json
```

### 9. Visualize the Generated Architecture

**Steps:**
1. Open `architectures/generated-webapp.json` in VSCode
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. See the 3-tier architecture visualized
4. Click nodes to verify Standard properties are present
5. **Take a screenshot**

### 10. Update Pattern Documentation

**Prompt:**
```text
Update patterns/README.md to add documentation for web-app-pattern.json:

1. What the pattern enforces (structure + Standards)
2. The required nodes and relationships
3. How to generate from this pattern
4. How to validate against this pattern
5. How it differs from company-base-pattern.json (specific vs generic)
```

### 11. Commit Your Work

```bash
git add patterns/web-app-pattern.json architectures/generated-webapp.json patterns/README.md README.md
git commit -m "Day 18: Create web app pattern with Standards enforcement"
git tag day-18
```

## Deliverables / Validation Criteria

Your Day 18 submission should include a commit tagged `day-18` containing:

✅ **Required Files:**
- `patterns/web-app-pattern.json` - Pattern with structure and Standards
- `architectures/generated-webapp.json` - Generated and customized architecture
- Updated `patterns/README.md` - Documentation
- Updated `README.md` - Day 18 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/web-app-pattern.json

# Generated architecture exists and has Standard properties
grep -q "costCenter" architectures/generated-webapp.json
grep -q "dataClassification" architectures/generated-webapp.json

# Validation passes
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Check tag
git tag | grep -q "day-18"
```

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- [JSON Schema const](https://json-schema.org/understanding-json-schema/reference/const)

## Tips

- Use `const` for values that MUST be exactly as specified (IDs, types)
- Leave Standard properties without `const` so they can be customized
- Test both generation AND validation
- Placeholder values should be obviously placeholder (e.g., "CC-0000", "team-name")

## Pattern Types Summary

| Pattern | Purpose | Enforces |
|---------|---------|----------|
| **Company Base Pattern** | Generic Standards enforcement | Properties only |
| **Web App Pattern** | Specific 3-tier structure | Structure + Properties |
| **E-Commerce Pattern** | Specific e-commerce structure | Structure + Properties |

## Next Steps

Tomorrow (Day 19) you'll create an E-Commerce Pattern by combining Standards with the structure from your existing architecture!
