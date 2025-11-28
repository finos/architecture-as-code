# Day 5: Add Interfaces to Your Nodes

## Overview
Define how your nodes communicate by adding interfaces that specify connection details. Learn about both inline interfaces and reusable interface definitions.

## Objective and Rationale
- **Objective:** Add interfaces to your service and database nodes using both inline and external definition approaches, then reference specific interfaces in connections
- **Rationale:** Interfaces make your architecture actionable. They answer "how do I connect to this?" CALM supports two approaches: simple inline interfaces for quick documentation, and formal interface definitions that reference external schemas for organization-wide standards and reusability.

## Requirements

### 1. Understand CALM Interface Approaches

CALM supports two ways to define interfaces:

#### Approach 1: Inline Interface (Simple)
Best for: Quick documentation, prototyping, small teams

```json
{
  "unique-id": "api-interface",
  "protocol": "HTTPS",
  "host": "api.example.com",
  "port": 443,
  "path": "/v1"
}
```

You can add any properties you need - `unique-id` is required, everything else is flexible.

#### Approach 2: External Interface Definition (Formal)
Best for: Organization-wide standards, reusable interface schemas, interface catalogs

```json
{
  "unique-id": "api-interface",
  "definition-url": "https://calm-hub.example.com/interfaces/rest-api-v1.json",
  "config": {
    "host": "api.example.com",
    "port": 443,
    "basePath": "/v1",
    "authentication": "OAuth2"
  }
}
```

The `definition-url` points to a JSON schema that defines what properties the interface should have.

### 2. Add Inline Interfaces

Open `architectures/my-first-architecture.json` in VSCode.

**Prompt:**
```text
Update architectures/my-first-architecture.json to add an inline interface to my service node.

The interface should:
- Have a unique-id
- Use protocol "HTTPS"
- Have a host property (can be a placeholder like "api.example.com")
- Use port 443
- Include a path property showing the API base path (e.g., "/api/v1")

This should be an inline interface, not an external definition.

Ensure the file still validates against CALM 1.0.
```

### 3. Add a Database Interface

**Prompt:**
```text
Update architectures/my-first-architecture.json to add an inline interface to my database node.

The interface should:
- Have a unique-id
- Use protocol "JDBC" 
- Have a host property (can be a placeholder like "db.example.com")
- Use port 5432 (PostgreSQL) or 3306 (MySQL) - your choice
- Include a database property with the database name

Ensure the file still validates.
```

### 4. Visualize Your Interfaces

Now see your interfaces in the diagram:

**Steps:**
1. **Save your file** (Ctrl+S / Cmd+Shift+S)
2. Open the CALM preview (Ctrl+Shift+C / Cmd+Shift+C) if not already open
3. Observe how your nodes now show interface information in the diagram
4. The visualization shows which nodes have interfaces defined

**Take a screenshot** showing your architecture with interfaces visible.

### 5. Update Your Connects Relationship

The `connects` relationship references interfaces using the `node-interface` structure.

**Prompt:**
```text
Update the "connects" relationship between my service and database to use the node-interface structure.

The relationship should specify:
- source: node reference to my service, interfaces array with the service's interface unique-id
- destination: node reference to my database, interfaces array with the database's interface unique-id

This makes the connection more precise by showing exactly which interface on each node is being used.
```

### 6. Visualize the Connection

**Steps:**
1. **Save your file**
2. Look at the preview panel
3. The connection between service and database should now show which specific interfaces are connected

This precision is valuable for understanding integration points!

### 7. Create an External Interface Definition (Optional)

Create a reusable interface schema:

**File:** `patterns/rest-api-interface.json`

**Prompt:**
```text
Create a new file at patterns/rest-api-interface.json

This should be a JSON Schema that defines a standard REST API interface with these required properties:
- host (string)
- port (number)
- basePath (string)
- authentication (enum: "OAuth2", "API-Key", "None")

And these optional properties:
- description (string)
- version (string)

Use JSON Schema draft 2020-12.
```

### 8. Use the External Interface Definition

Now update your service interface to reference this schema:

**Prompt:**
```text
Update the service node interface in architectures/my-first-architecture.json to use an external interface definition.

Replace the inline interface properties with:
- Keep the unique-id
- Add a definition-url property pointing to "https://my-enterprise/patterns/rest-api-interface.json"
- Move the existing properties (host, port, path, authentication) into a "config" object

This demonstrates how to use external interface definitions for standardization.
```

### 9. Validate Your Architecture

At present, the CALM tooling does not follow external URL definitions (except for docify, which we'll cover later). For now, just know that by externalising this configuration you're opening up the reuse possibilities of your architectures.

### 10. Update Your README

Update your README.md progress:
```markdown
- [x] Day 4: Install CALM VSCode Extension
- [x] Day 5: Add Interfaces to Nodes
```

### 11. Commit Your Work

```bash
git add architectures/my-first-architecture.json patterns/rest-api-interface.json docs/screenshots/day-5-interfaces.png README.md
git commit -m "Day 5: Add inline and external interface definitions with visualization"
git tag day-5
```

## Deliverables / Validation Criteria

Your Day 5 submission should include a commit tagged `day-5` containing:

✅ **Required Files:**
- `architectures/my-first-architecture.json` - With interfaces on service and database nodes (service using external definition)
- `patterns/rest-api-interface.json` - Interface schema referenced by service
- `docs/screenshots/day-5-interfaces.png` - Visualization showing interfaces
- Updated `README.md` - Day 5 marked as complete

## Resources
- [CALM Interface Schema](https://github.com/finos/architecture-as-code/blob/main/calm/release/1.0/meta/interface.json)
- [JSON Schema Documentation](https://json-schema.org/)

## Tips
- **Use the preview** to see how interfaces appear visually
- **Start with inline interfaces** - they're simpler
- **Use external definitions** for organization-wide standards
- **Specify interfaces in connects relationships** for precision
- **Save frequently** to see live updates in the visualization

## Next Steps
Tomorrow (Day 6) you'll add metadata to your architecture - and see how it enriches your documentation!
