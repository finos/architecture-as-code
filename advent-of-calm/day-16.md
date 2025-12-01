# Day 16: Introduction to CALM Patterns

## Overview
Learn how CALM Patterns enable you to define reusable architecture templates that can both generate new architectures and validate existing ones.

## Objective and Rationale
- **Objective:** Understand what Patterns are and create your first Pattern for a simple web application
- **Rationale:** Patterns are CALM's superpower for reuse and governance. A single Pattern can generate architecture scaffolds instantly AND validate that existing architectures conform to a required structure. This dual capability makes Patterns essential for scaling architecture practices across teams.

## Requirements

### 1. Understand What Patterns Are

**The Problem Patterns Solve:**
- Teams keep building similar architectures from scratch
- No easy way to enforce "all web apps must have these components"
- Inconsistent structures across projects

**The Solution:**
Patterns are JSON Schema documents that define the required structure of an architecture. They specify what nodes must exist, what relationships must connect them, and what properties they must have.

### 2. Understand the Dual Superpower

**One Pattern = Two Powers:**

**Power 1 - Generation:**
```bash
calm generate -p my-pattern.json -o new-architecture.json
```
Creates an architecture scaffold with all required nodes and relationships.

**Power 2 - Validation:**
```bash
calm validate -p my-pattern.json -a existing-architecture.json
```
Checks that an architecture has the required structure.

### 3. Understand How Patterns Work

Patterns use JSON Schema keywords to define requirements:

- **`const`** - Requires an exact value (e.g., `"unique-id": { "const": "api-gateway" }`)
- **`prefixItems`** - Defines exact items in an array
- **`minItems`/`maxItems`** - Enforces array length
- **`$ref`** - References other schemas

**Example: Requiring a specific node**
```json
{
  "nodes": {
    "type": "array",
    "prefixItems": [
      {
        "properties": {
          "unique-id": { "const": "api-gateway" },
          "node-type": { "const": "service" },
          "name": { "const": "API Gateway" }
        }
      }
    ],
    "minItems": 1
  }
}
```

This pattern requires an architecture to have a node with `unique-id: "api-gateway"`.

### 4. Create Your First Pattern

Create a simple pattern for a 3-tier web application.

**File:** `patterns/web-app-pattern.json`

**Prompt:**
```text
Create a CALM pattern at patterns/web-app-pattern.json for a 3-tier web application.

The pattern should:
1. Use the CALM schema (https://calm.finos.org/release/1.1/meta/calm.json)
2. Have a unique $id (https://example.com/patterns/web-app-pattern.json)
3. Have title "Web Application Pattern" and a description
4. Require exactly 3 nodes using prefixItems:
   - "web-frontend" (node-type: webclient, name: "Web Frontend")
   - "api-service" (node-type: service, name: "API Service")
   - "app-database" (node-type: database, name: "Application Database")
5. Require exactly 2 relationships using prefixItems:
   - "frontend-to-api": connects web-frontend to api-service
   - "api-to-database": connects api-service to app-database

Use const for unique-id, node-type, and name properties.
Set minItems and maxItems to enforce exact counts.
```

### 5. Test Generation

Generate an architecture from your pattern:

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json
```

Open `architectures/generated-webapp.json` and verify:
- ✅ Has exactly 3 nodes with the correct IDs, types, and names
- ✅ Has exactly 2 relationships connecting them
- ✅ Structure matches what the pattern defined

### 6. Visualize the Generated Architecture

**Steps:**
1. Open `architectures/generated-webapp.json` in VSCode
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. See the 3-tier architecture visualized
4. **Take a screenshot**

### 7. Test Validation - Passing Case

Your generated architecture should validate against the pattern:

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass! ✅

### 8. Test Validation - Failing Case

Create a broken architecture to see validation fail:

**Prompt:**
```text
Create architectures/broken-webapp.json by copying generated-webapp.json but:
1. Change the unique-id of "api-service" to "backend-api"

This should fail validation because the pattern requires "api-service".
```

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json
```

Should fail! ❌ The pattern catches that "api-service" is missing.

Clean up:
```bash
rm architectures/broken-webapp.json
```

### 9. Enhance the Generated Architecture

The generated architecture has the required structure. Now add details:

**Prompt:**
```text
Update architectures/generated-webapp.json to add:
1. Descriptions for each node explaining their purpose
2. A description for each relationship
3. Interfaces on api-service (host, port for HTTPS)
4. Interfaces on app-database (host, port for PostgreSQL)

Keep the unique-ids, node-types, and names exactly as they are.
```

### 10. Validate the Enhanced Architecture

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Still passes! ✅ Adding extra properties doesn't break pattern compliance.

### 11. Document the Pattern

**File:** `patterns/README.md`

**Prompt:**
```text
Create patterns/README.md that documents:

1. What Patterns are and their dual superpower (generation + validation)
2. How to use web-app-pattern.json:
   - Generation: calm generate -p patterns/web-app-pattern.json -o my-app.json
   - Validation: calm validate -p patterns/web-app-pattern.json -a my-app.json
3. What the pattern enforces (3 specific nodes, 2 specific relationships)
4. What's flexible (descriptions, interfaces, metadata)
```

### 12. Commit Your Work

```bash
git add patterns/ architectures/generated-webapp.json README.md
git commit -m "Day 16: Create first CALM pattern for web applications"
git tag day-16
```

## Deliverables / Validation Criteria

Your Day 16 submission should include a commit tagged `day-16` containing:

✅ **Required Files:**
- `patterns/web-app-pattern.json` - Pattern for 3-tier web app
- `patterns/README.md` - Pattern documentation
- `architectures/generated-webapp.json` - Generated and enhanced architecture
- Updated `README.md` - Day 16 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/web-app-pattern.json

# Generation works
calm generate -p patterns/web-app-pattern.json -o /tmp/test-webapp.json

# Validation works
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Check tag
git tag | grep -q "day-16"
```

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- [JSON Schema const](https://json-schema.org/understanding-json-schema/reference/const)

## Tips

- Use `const` for values that MUST be exactly as specified
- `prefixItems` defines the exact items required in order
- `minItems`/`maxItems` together enforce exact array length
- Patterns only constrain what you specify - extra properties are allowed
- Test both generation AND validation to ensure the pattern works

## Key Concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| `const` | Require exact value | `"unique-id": { "const": "api-gateway" }` |
| `prefixItems` | Define required array items | First node must be X, second must be Y |
| `minItems` | Minimum array length | At least 3 nodes |
| `maxItems` | Maximum array length | At most 3 nodes |
| `$ref` | Reference other schemas | Point to node definition |

## Next Steps

Tomorrow (Day 17) you'll learn how Patterns can enforce your organisational Standards, combining structure requirements with property requirements!
