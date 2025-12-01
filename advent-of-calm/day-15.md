# Day 15: Create Your First Pattern - CALM's Superpower

## Overview
Create a CALM pattern that instantly generates architecture scaffolds AND enforces governance rules - CALM's dual superpower.

## Objective and Rationale
- **Objective:** Create a simple pattern for a web application architecture that can generate scaffolds and validate compliance
- **Rationale:** Patterns are CALM's superpower - one pattern does two things: (1) Generate compliant architecture in seconds (productivity), (2) Validate architectures follow standards (governance). Learn how `const`, `prefixItems`, and JSON Schema constraints enable both.

## Requirements

### 1. Understand CALM's Dual Superpower

**One Pattern = Two Powers:**

**Power 1 - Productivity (Generation):**
```bash
calm generate -p my-pattern.json -o new-service.json
```
Result: Instant architecture scaffold with all best practices baked in

**Power 2 - Governance (Validation):**
```bash
calm validate -p my-pattern.json -a existing-service.json
```
Result: Automated compliance checking against your standards

**How the same pattern does both:**
- **`const: "api-gateway"`** → Generation: creates node with ID "api-gateway" | Validation: requires ID must be "api-gateway"
- **`minItems: 3`** → Generation: creates 3 items | Validation: requires exactly 3 items
- **`prefixItems: [...]`** → Generation: creates these exact items | Validation: checks these items exist

### 2. Create a Simple Web Application Pattern

You'll create a pattern for a standard 3-tier web app:
- Frontend (webclient)
- API Service (service) 
- Database (database)

**File:** `patterns/web-app-pattern.json`

**Prompt:**
```text
Create a new file at patterns/web-app-pattern.json

This pattern defines a standard 3-tier web application architecture.

The pattern should have:

1. Schema setup:
   - $schema: "https://calm.finos.org/release/1.0/meta/calm.json"
   - $id: "https://example.com/patterns/web-app.json"
   - title: "Standard Web Application Pattern"
   - description: "Three-tier web application with frontend, API, and database"
   - type: "object"

2. Exactly 3 nodes using prefixItems (with minItems: 3, maxItems: 3):
   - Node 1: unique-id "web-frontend", node-type "webclient", name "Web Frontend", description "User-facing web application"
   - Node 2: unique-id "api-service", node-type "service", name "API Service", description "Backend API service"  
   - Node 3: unique-id "app-database", node-type "database", name "Application Database", description "Primary data storage"

3. Exactly 2 relationships using prefixItems (with minItems: 2, maxItems: 2):
   - Relationship 1: unique-id "frontend-to-api", connects web-frontend to api-service, protocol "HTTPS", description "Frontend calls API"
   - Relationship 2: unique-id "api-to-database", connects api-service to app-database, protocol "JDBC", description "API stores data"

Use const for all unique-id, name, description, node-type properties.
Use const for the entire relationship-type object.
Each node and relationship must reference the base CALM schema using $ref.
Set required: ["nodes", "relationships"] at the top level.
Set required: ["description"] on each relationship.

Refer to the pattern-creation.md guide in .github/chatmodes/CALM.chatmode.md for detailed pattern structure examples.
```

### 3. Test Generation

Generate an architecture from your pattern:

```bash
calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json
```

Open `architectures/generated-webapp.json` and observe:
- ✅ Has exactly 3 nodes with the IDs, names, descriptions from your pattern
- ✅ Has exactly 2 relationships connecting them
- ✅ Ready for enhancement with interfaces and metadata

### 4. Visualize the Generated Architecture

**Steps:**
1. Open `architectures/generated-webapp.json` in VSCode
2. Open preview (Ctrl+Shift+C / Cmd+Shift+C)
3. See the 3-tier architecture visualized
4. **Take a screenshot** of the generated architecture

This shows how patterns create instant, visual architectures!

### 5. Enhance the Generated Architecture

The generated architecture has the basic structure, but you can enhance it:

**Prompt:**
```text
Update architectures/generated-webapp.json to add:
- Interfaces to the service and database nodes with realistic host, port values
- Metadata at the architecture level with owner, version, created date
- Any additional properties that make it production-ready

Keep the unique-ids, names, and core descriptions as they are (from the pattern).
```

### 6. Test Validation

```bash
calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json
```

Should pass! ✅

**Test Governance by Breaking Rules**

**Prompt:**
```text
Create architectures/broken-webapp.json by copying generated-webapp.json and changing the unique-id of "web-frontend" to "my-custom-frontend"
```

Validate:
```bash
calm validate -p patterns/web-app-pattern.json -a architectures/broken-webapp.json
```

Should fail! ❌ The pattern catches the violation.

Delete the broken file:
```bash
rm architectures/broken-webapp.json
```

### 7. Document the Superpower

**File:** `patterns/README.md`

**Prompt:**
```text
Create patterns/README.md explaining:

1. The Dual Superpower: Patterns both generate AND validate
2. How to use web-app-pattern.json for generation and validation
3. What it enforces and why
4. Time savings example
```

### 8. Commit Your Work

```bash
git add patterns/web-app-pattern.json architectures/generated-webapp.json patterns/README.md docs/screenshots/day-15-pattern.png README.md
git commit -m "Day 14: Create web app pattern - generation and validation superpower"
git tag day-15
```

## Deliverables / Validation Criteria

Your Day 15 submission should include a commit tagged `day-15` containing:

✅ **Required Files:**
- `patterns/web-app-pattern.json` - Pattern defining 3-tier web app
- `architectures/generated-webapp.json` - Architecture generated from pattern
- `patterns/README.md` - Documentation
- `docs/screenshots/day-15-pattern.png` - Visualization
- Updated `README.md` - Day 14 marked as complete

## Resources

- [CALM Pattern Documentation](https://github.com/finos/architecture-as-code/tree/main/calm/pattern)
- [JSON Schema prefixItems](https://json-schema.org/understanding-json-schema/reference/array#tupleValidation)

## Next Steps
Tomorrow (Day 16) you'll reverse-engineer your e-commerce architecture into a pattern!
