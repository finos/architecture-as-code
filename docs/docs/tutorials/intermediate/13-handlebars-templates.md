---
id: 13-handlebars-templates
title: "Custom Documentation with Handlebars Templates"
sidebar_position: 7
---

# Custom Documentation with Handlebars Templates

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Extend your documentation with custom Handlebars templates when you need more control than the built-in calm-widgets provide.

## Learning Objectives

By the end of this tutorial, you will:
- Know when to use raw Handlebars instead of (or alongside) calm-widgets
- Use core Handlebars syntax: `{{#each}}`, `{{#if}}`, `{{#unless}}`
- Use CALM-specific helpers such as `eq`, `kebabToTitleCase`, `join`, `json`
- Create a node inventory template that filters by node type
- Create a relationship details template with conditional formatting
- Combine widgets and raw Handlebars in the same template

## Prerequisites

Complete [Custom Documentation with CALM Widgets](./12-calm-widgets) first.

## Step-by-Step Guide

### 1. When to Use Raw Handlebars

On Day 12 you learned calm-widgets provide ready-made components. Use raw Handlebars when you need to:
- Create custom filtering logic (e.g., only show nodes of a certain type)
- Format data in ways widgets don't support
- Build complex conditional documentation
- Generate non-markdown outputs (CSV, HTML, etc.)

### 2. Handlebars Basics

[Handlebars](https://handlebarsjs.com/) is a simple templating language:

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{property}}` | Output a value | `{{name}}` |
| `{{#each array}}...{{/each}}` | Loop over arrays | `{{#each nodes}}{{name}}{{/each}}` |
| `{{#if condition}}...{{/if}}` | Conditional | `{{#if description}}...{{/if}}` |
| `{{#unless condition}}...{{/unless}}` | Negative conditional | `{{#unless @last}}, {{/unless}}` |
| `{{@index}}` | Current index in loop | `{{@index}}. {{name}}` |
| `{{@last}}` | Is last item in loop | For comma-separated lists |
| `{{this}}` | Current item | `{{#each tags}}{{this}}{{/each}}` |

### 3. CALM-Specific Helpers

The docify command includes custom helpers:

| Helper | Description | Example |
|--------|-------------|---------|
| `eq` | Equality check | `{{#if (eq node-type "service")}}` |
| `lookup` | Access property by name | `{{lookup this 'unique-id'}}` |
| `json` | Output as JSON | `{{json metadata}}` |
| `kebabToTitleCase` | Format text | `{{kebabToTitleCase node-type}}` |
| `kebabCase` | Convert to kebab-case | `{{kebabCase name}}` |
| `isObject` | Check if object | `{{#if (isObject data)}}` |
| `isArray` | Check if array | `{{#if (isArray items)}}` |
| `join` | Join array elements | `{{join tags ", "}}` |

### 4. Create a Node Inventory Template

Create a template that filters nodes by type — something the widgets don't do directly:

**File:** `templates/node-inventory.md`

```handlebars
---
architecture: ../architectures/ecommerce-platform.json
---
# Node Inventory: {{metadata.description}}

| Name | Type | ID | Description |
|------|------|-------|-------------|
{{#each nodes}}
| {{name}} | {{kebabToTitleCase node-type}} | `{{unique-id}}` | {{description}} |
{{/each}}

## Services Only

{{#each nodes}}
{{#if (eq node-type "service")}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/if}}
{{/each}}

## Databases Only

{{#each nodes}}
{{#if (eq node-type "database")}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/if}}
{{/each}}

## Actors

{{#each nodes}}
{{#if (eq node-type "actor")}}
- **{{name}}**: {{description}}
{{/if}}
{{/each}}
```

### 5. Preview in VSCode

Just like Day 12, you can preview this template in VSCode:

1. Open `templates/node-inventory.md` in VSCode
2. Open the CALM preview pane (`Ctrl+Shift+C` / `Cmd+Shift+C`) to see the rendered output

### 6. Create a Relationship Details Template

**File:** `templates/relationship-details.md`

```handlebars
---
architecture: ../architectures/ecommerce-platform.json
---
# Relationship Details: {{metadata.description}}

{{#each relationships}}
### {{unique-id}}

{{#if relationship-type.connects}}
**Type:** Connection

| Property | Value |
|----------|-------|
| Source | `{{relationship-type.connects.source.node}}` |
| Destination | `{{relationship-type.connects.destination.node}}` |
{{#if relationship-type.connects.source.interfaces}}
| Source Interfaces | {{#each relationship-type.connects.source.interfaces}}`{{this}}`{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}
{{/if}}

{{#if relationship-type.interacts}}
**Type:** Interaction

- **Actor:** `{{relationship-type.interacts.actor}}`
- **Interacts with:** {{#each relationship-type.interacts.nodes}}`{{this}}`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{#if relationship-type.composed-of}}
**Type:** Composition

- **Container:** `{{relationship-type.composed-of.container}}`
- **Contains:** {{#each relationship-type.composed-of.nodes}}`{{this}}`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

---
{{/each}}
```

### 7. Generate Static Files with CLI

For CI/CD or static site generation, use the docify CLI:

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/node-inventory.md \
  --output docs/generated/node-inventory.md

calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/relationship-details.md \
  --output docs/generated/relationship-details.md
```

### 8. Combine Widgets and Handlebars

You can mix calm-widgets with raw Handlebars in the same template:

```handlebars
---
architecture: ../architectures/ecommerce-platform.json
---
# {{metadata.description}} - Combined Documentation

## Architecture Overview (widget)
{{block-architecture this}}

## Services Summary (custom Handlebars)
{{#each nodes}}
{{#if (eq node-type "service")}}
### {{name}}
- **ID:** `{{unique-id}}`
- **Description:** {{description}}
{{/if}}
{{/each}}

## All Nodes (widget)
{{table nodes columns="unique-id,name,node-type"}}
```

Don't forget to commit your progress with git. Capturing a snapshot here keeps your change history clean and meaningful.

## Key Concepts

### When to Use Each Approach

| Approach | Best For |
|----------|----------|
| calm-widgets | Quick visualisations, standard documentation |
| Raw Handlebars | Custom filtering, complex logic, non-standard formats |
| Combined | Best of both worlds |

### Filtering Nodes by Type

The `eq` helper combined with `{{#if}}` is the primary filtering mechanism:

```handlebars
{{#each nodes}}
{{#if (eq node-type "service")}}
  ... only rendered for service nodes ...
{{/if}}
{{/each}}
```

### Debugging Templates

Add `{{json nodes}}` to output the raw data structure and discover available property names before using them in your template logic.

## Resources

- [Handlebars Guide](https://handlebarsjs.com/guide/)
- [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)
- [CALM Widgets Documentation](https://github.com/finos/architecture-as-code/tree/main/calm-widgets)

## Next Steps

In the [next tutorial](./14-ai-advisor), you'll use CALM Chat mode as an expert architecture advisor to identify and fix resilience weaknesses in your e-commerce platform!
