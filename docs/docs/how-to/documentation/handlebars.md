---
id: handlebars
title: Advanced Handlebars Templates
sidebar_position: 4
---

# How to Use Advanced Handlebars Templates

🔴 **Difficulty:** Advanced | ⏱️ **Time:** 30-45 minutes

For full control over documentation output, use raw Handlebars syntax to iterate, filter, and transform architecture data.

## When to Use This

Use raw Handlebars when you need to:
- Create complex conditional logic
- Build custom layouts beyond widgets
- Transform data before display
- Create sophisticated documentation structures

## Quick Reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{value}}` | Output value | `{{node.name}}` |
| `{{#each}}` | Loop | `{{#each nodes}}...{{/each}}` |
| `{{#if}}` | Conditional | `{{#if hasData}}...{{/if}}` |
| `{{>partial}}` | Include partial | `{{>node-row}}` |

## Step-by-Step

### 1. Basic Property Access

```handlebars
# {{metadata.name}}

> {{metadata.description}}

Owner: {{metadata.owner}}
```

### 2. Iterate Over Arrays

```handlebars
## Nodes

{{#each nodes}}
### {{name}}

- **ID:** `{{unique-id}}`
- **Type:** {{node-type}}
- **Description:** {{description}}

{{/each}}
```

### 3. Conditional Rendering

```handlebars
{{#each nodes}}
### {{name}}

{{#if description}}
{{description}}
{{else}}
*No description provided*
{{/if}}

{{#if interfaces}}
**Interfaces:**
{{#each interfaces}}
- {{unique-id}}: Port {{port}}
{{/each}}
{{/if}}

{{/each}}
```

### 4. Access Parent Context

Use `../` to access parent scope:

```handlebars
{{#each nodes}}
### {{name}}

Part of: {{../metadata.name}}

{{/each}}
```

### 5. Use Loop Variables

Access iteration metadata:

```handlebars
{{#each nodes}}
{{@index}}. {{name}}{{#unless @last}},{{/unless}}
{{/each}}
```

| Variable | Meaning |
|----------|---------|
| `{{@index}}` | Zero-based index |
| `{{@first}}` | True if first item |
| `{{@last}}` | True if last item |
| `{{@key}}` | Key for objects |

### 6. Build Custom Tables

```handlebars
| # | Name | Type | Description |
|---|------|------|-------------|
{{#each nodes}}
| {{@index}} | {{name}} | {{node-type}} | {{description}} |
{{/each}}
```

### 7. Nested Iteration

```handlebars
{{#each nodes}}
## {{name}}

{{#if controls}}
### Controls

{{#each controls}}
- **{{name}}**: {{description}}
{{/each}}
{{/if}}

{{/each}}
```

### 8. Use Unless (Inverse If)

```handlebars
{{#unless nodes}}
*No nodes defined in this architecture*
{{/unless}}

{{#each nodes}}
{{#unless description}}
⚠️ {{name}} is missing a description
{{/unless}}
{{/each}}
```

### 9. With Helper (Change Context)

```handlebars
{{#with metadata}}
# {{name}}

Owner: {{owner}}
Version: {{version}}
{{/with}}
```

### 10. Combine with Widgets

Mix Handlebars with CALM widgets:

```handlebars
# {{metadata.name}}

## Overview

{{block-architecture this}}

## Details

{{#each nodes}}
### {{name}}

{{description}}

{{#if interfaces}}
#### Exposed Interfaces

| Interface | Port |
|-----------|------|
{{#each interfaces}}
| {{unique-id}} | {{port}} |
{{/each}}
{{/if}}

{{/each}}
```

## Debugging Tips

### View Current Context

Use `json-viewer` to see available data:

```handlebars
{{json-viewer this}}
```

### Check Specific Properties

```handlebars
{{json-viewer metadata}}
{{json-viewer nodes.0}}
```

## Advanced Patterns

### Filter by Type

```handlebars
## Services

{{#each nodes}}
{{#if (eq node-type "service")}}
- {{name}}
{{/if}}
{{/each}}

## Databases

{{#each nodes}}
{{#if (eq node-type "database")}}
- {{name}}
{{/if}}
{{/each}}
```

### Group by Category

```handlebars
{{#each (groupBy nodes "node-type")}}
## {{@key}}

{{#each this}}
- {{name}}
{{/each}}

{{/each}}
```

## Best Practices

:::tip Use json-viewer for Debugging
When unsure about data structure, use `{{json-viewer this}}` to see what's available
:::

:::tip Whitespace Control
Use `{{~expression~}}` to trim whitespace around expressions
:::

:::tip Keep Logic Simple
For complex transformations, consider pre-processing data rather than complex templates
:::

## Related Guides

- [Create Custom Templates](custom-widgets) - Widget-based templates
- [Generate Documentation](docify) - Basic docify usage
