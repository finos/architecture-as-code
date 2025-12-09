# Day 17: Introduction to CALM Patterns

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
CALM Patterns pre-define the required structure of an architecture. They specify which nodes must exist, what relationships must connect them, and what properties they must have.

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

**Prompt:**
```text
Create a CALM pattern at patterns/web-app-pattern.json for a 3-tier web application.

The pattern should:
1. Have a unique $id (https://example.com/patterns/web-app-pattern.json)
2. Have title "Web Application Pattern" and a description
3. Require exactly 3 nodes using prefixItems:
   - "web-frontend" (node-type: webclient, name: "Web Frontend")
   - "api-service" (node-type: service, name: "API Service")
   - "app-database" (node-type: database, name: "Application Database")
4. Require exactly 2 relationships:
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

### 7. Test Validation - Passing Case with Warnings

Your generated architecture should validate against the pattern:

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass! ✅ but show some warnings:

```json
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/0/description",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 98,
            "character_end": 117
        },
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/1/description",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 203,
            "character_end": 222
        },
        {
            "code": "architecture-has-no-placeholder-properties-string",
            "severity": "warning",
            "message": "String placeholder detected in architecture.",
            "path": "/nodes/2/description",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 319,
            "character_end": 338
        }
    ],
    "hasErrors": false,
    "hasWarnings": true
}%
```

This is because `description` is a required field of nodes in the calm schema, but because we didn't provide a default description in our pattern, the generate command has put in placeholders which it expects us to fill in after generation.

String placeholders can be identified by two square brackets: `"description": "[[ DESCRIPTION ]]"`. Numeric placeholders will have the value `-1`.

As you will have seen when you visualised the architecture, placeholders don't make the architecture invalid, hence why only warnings are reported, but it allows you to build integration in your own tooling to spot where an architect or engineer you expect to replace those placeholders.

### 8. Test Validation - Failing Case

Create a broken architecture to see validation fail:

1. Create architectures/broken-webapp.json by copying generated-webapp.json
2. Change the unique-id of "api-service" to "backend-api"

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json
```

Should fail! ❌ The pattern catches that "api-service" is missing.

```json
{
    "jsonSchemaValidationOutputs": [
        {
            "code": "json-schema",
            "severity": "error",
            "message": "must be equal to constant",
            "path": "/nodes/1/unique-id",
            "schemaPath": "#/properties/nodes/prefixItems/1/properties/unique-id/const"
        }
    ],
    "spectralSchemaValidationOutputs": [
        {
            "code": "connects-relationship-references-existing-nodes-in-architecture",
            "severity": "error",
            "message": "'api-service' does not refer to the unique-id of an existing node.",
            "path": "/relationships/0/relationship-type/connects/destination/node",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 440,
            "character_end": 453
        },
        {
            "code": "connects-relationship-references-existing-nodes-in-architecture",
            "severity": "error",
            "message": "'api-service' does not refer to the unique-id of an existing node.",
            "path": "/relationships/1/relationship-type/connects/source/node",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 539,
            "character_end": 552
        },
        {
            "code": "architecture-nodes-must-be-referenced",
            "severity": "warning",
            "message": "Node with ID 'api-service-1' is not referenced by any relationships.",
            "path": "/nodes/1/unique-id",
            "schemaPath": "",
            "line_start": 0,
            "line_end": 0,
            "character_start": 119,
            "character_end": 134
        }
    ],
    "hasErrors": true,
    "hasWarnings": true
}%   
```

As you can see, not only does the `validate` command identify that it is missing an expected node, but the relationship which was referencing it is also now in error and there is also a warning because we now have a node which is not referenced in any relationships.

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

```json
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [],
    "hasErrors": false,
    "hasWarnings": false
}%   
```

It now passes without warnings ✅ and adding extra properties doesn't break pattern compliance. This is how patterns act as the base foundation for new applications that share the same architecture, but aren't the same application. 

Think about how this can help you automate typically time consuming processes such as security review, which rely on certain things following strict convention, but other things being the responsibility of the engineers.

### 11. Document the Pattern

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
git commit -m "Day 17: Create first CALM pattern for web applications"
git tag day-17
```

## Deliverables / Validation Criteria

Your Day 17 submission should include a commit tagged `day-17` containing:

✅ **Required Files:**
- `patterns/web-app-pattern.json` - Pattern for 3-tier web app
- `patterns/README.md` - Pattern documentation
- `architectures/generated-webapp.json` - Generated and enhanced architecture
- Updated `README.md` - Day 17 marked as complete

✅ **Validation:**
```bash
# Pattern exists
test -f patterns/web-app-pattern.json

# Generation works
calm generate -p patterns/web-app-pattern.json -o /tmp/test-webapp.json

# Validation works
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json

# Check tag
git tag | grep -q "day-17"
```

## Resources

- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)
- [JSON Schema const](https://json-schema.org/understanding-json-schema/reference/const)

## Tips

- Use `const` for values that MUST be exactly as specified
- `prefixItems` defines the exact items required in order
- `minItems`/`maxItems` together enforce exact array length
- Patterns only constrain what you specify - extra properties are allowed
- Test both generation AND validation to ensure the pattern works

## Trouble Shooting
- Remember AI can make mistakes, if for some reason your pattern won't generate a valid architecture ask CALM Chatmode to figure out why not, this prompt may be helpful.

```text
My pattern doesn't generate a valid architecture when I run the generate command, look at this valid pattern - https://raw.githubusercontent.com/finos/architecture-as-code/refs/heads/main/conferences/osff-ln-2025/workshop/conference-signup.pattern.json - identify the problem. 
```

## Key Concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| `const` | Require exact value | `"unique-id": { "const": "api-gateway" }` |
| `prefixItems` | Define required array items | First node must be X, second must be Y |
| `minItems` | Minimum array length | At least 3 nodes |
| `maxItems` | Maximum array length | At most 3 nodes |
| `$ref` | Reference other schemas | Point to node definition |

## Next Steps

Tomorrow (Day 18) you'll learn how to create organisational Standards - JSON Schema extensions that define custom properties like cost centres, owners, and compliance tags that your Patterns can enforce!
