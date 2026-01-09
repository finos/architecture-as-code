---
id: custom-widgets
title: Create Custom Templates
sidebar_position: 3
---

# How to Create Custom Templates with Widgets

🟡 **Difficulty:** Intermediate

CALM widgets are reusable Handlebars components for generating Markdown documentation from architecture data.

## When to Use This

Use custom widget templates when you need to:
- Create tables from node/relationship data
- Generate Mermaid diagrams automatically
- Build reusable documentation components
- Customize doc output beyond basic docify

## Quick Start

Create a template with widgets:

```markdown
---
architecture: ../architectures/my-system.json
---

# System Overview

{{block-architecture this}}

## Components

{{table nodes columns="unique-id,name,description"}}
```

## Available Widgets

| Widget | Purpose | Example |
|--------|---------|---------|
| `table` | Render data as Markdown table | `{{table nodes columns="name,type"}}` |
| `list` | Render array as list | `{{list services property="name"}}` |
| `json-viewer` | Formatted JSON output | `{{json-viewer config}}` |
| `related-nodes` | Mermaid relationship graph | `{{related-nodes node-id="api"}}` |
| `block-architecture` | Full architecture flowchart | `{{block-architecture this}}` |
| `flow-sequence` | Flow as sequence diagram | `{{flow-sequence this flow-id="my-flow"}}` |

## Step-by-Step

### 1. Create Template File

**File:** `templates/service-doc.md`

```markdown
---
architecture: ../architectures/my-system.json
---

# {{metadata.name}}

{{metadata.description}}
```

### 2. Add a Table Widget

Display nodes as a table:

```markdown
## Services

{{table nodes columns="unique-id,name,node-type,description"}}
```

**Output:**

| unique-id | name | node-type | description |
|-----------|------|-----------|-------------|
| api-gateway | API Gateway | service | Main entry point |
| order-service | Order Service | service | Handles orders |

### 3. Add Architecture Diagram

Generate a Mermaid flowchart:

```markdown
## Architecture Diagram

{{block-architecture this}}
```

### 4. Add Flow Diagram

Show a specific business flow:

```markdown
## Order Processing Flow

{{flow-sequence this flow-id="order-processing"}}
```

### 5. Filter with Focus Options

Focus on specific parts of the architecture:

```markdown
## API Gateway Connections

{{block-architecture this focus-nodes="api-gateway"}}

## Payment Flow Only

{{block-architecture this focus-flows="payment-flow"}}
```

### 6. Use Related Nodes

Show nodes connected to a specific node:

```markdown
## Order Service Dependencies

{{related-nodes node-id="order-service"}}
```

### 7. Preview in VSCode

1. Open template file in VSCode
2. Run Command Palette → **"CALM: Open Preview"**
3. See live rendered output
4. Edit template and see updates in real-time

### 8. Generate Static Output

```bash
calm docify \
  --input templates/service-doc.md \
  --output docs/service-doc.md \
  --architecture architectures/my-system.json
```

## Widget Reference

### table

```handlebars
{{table <data> columns="col1,col2,col3"}}
```

- `<data>`: Array to render (e.g., `nodes`, `relationships`)
- `columns`: Comma-separated list of properties

### block-architecture

```handlebars
{{block-architecture this [options]}}
```

Options:
- `focus-nodes="node1,node2"` - Highlight specific nodes
- `focus-flows="flow-id"` - Show only nodes in a flow
- `highlight-nodes="node1"` - Visual highlight

### flow-sequence

```handlebars
{{flow-sequence this flow-id="flow-unique-id"}}
```

### related-nodes

```handlebars
{{related-nodes node-id="node-unique-id"}}
```

### json-viewer

```handlebars
{{json-viewer <object>}}
```

## Best Practices

:::tip Use Front Matter
Always include the `architecture` path in YAML front matter for VSCode preview
:::

:::tip Start Simple
Begin with basic widgets, then add complexity as needed
:::

:::tip Reuse Templates
Create organization-wide templates for consistency
:::

## Related Guides

- [Generate Documentation](docify) - Basic docify usage
- [Advanced Handlebars](handlebars) - Full Handlebars control
