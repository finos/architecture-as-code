# Day 13: Custom Documentation with Handlebars Templates

## Overview
Extend your documentation with custom Handlebars templates when you need more control than the built-in calm-widgets provide.

## Objective and Rationale
- **Objective:** Learn Handlebars templating to create fully customized documentation outputs
- **Rationale:** On Day 12 you used calm-widgets for quick, powerful documentation. But sometimes you need more control - custom logic, filtering, or output formats the widgets don't cover. Handlebars gives you that flexibility while still being simple enough for non-developers.

## Requirements

### 1. When to Use Raw Handlebars

On Day 12 you learned calm-widgets provide ready-made components. Use raw Handlebars when you need to:
- Create custom filtering logic (e.g., only show nodes of a certain type)
- Format data in ways widgets don't support
- Build complex conditional documentation
- Generate non-markdown outputs (CSV, HTML, etc.)

### 2. Handlebars Basics

[Handlebars](https://handlebarsjs.com/) is a simple templating language. Here's what you need to know:

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
| `instanceOf` | Type check | `{{instanceOf value "string"}}` |

### 4. Create a Node Inventory Template

Create a template that filters nodes by type - something the widgets don't do directly:

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
2. Open the CALM Preview (Ctrl+Shift+C / Cmd+Shift+C) to see the rendered output

### 6. Create a Relationship Details Template

Create a template that shows relationship details with custom formatting:

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
{{#if relationship-type.connects.destination.interfaces}}
| Dest Interfaces | {{#each relationship-type.connects.destination.interfaces}}`{{this}}`{{#unless @last}}, {{/unless}}{{/each}} |
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

### 8. Combining Widgets and Handlebars

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
{{#if interfaces}}
- **Interfaces:** {{#each interfaces}}`{{unique-id}}`{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/if}}
{{/each}}

## All Nodes (widget)
{{table nodes columns="unique-id,name,node-type"}}
```

### 9. When to Use Each Approach

| Approach | Best For |
|----------|----------|
| calm-widgets (Day 12) | Quick visualisations, standard documentation |
| Raw Handlebars (Day 13) | Custom filtering, complex logic, non-standard formats |
| Combined | Best of both worlds |

### 10. Update Your README

Document Day 13 progress: note that you've learned Handlebars templating for custom documentation.

### 11. Commit Your Work

```bash
git add templates/ docs/generated/ README.md
git commit -m "Day 13: Create custom documentation with Handlebars templates"
git tag day-13
```

## Deliverables

✅ **Required:**
- `templates/node-inventory.md` - Node filtering template
- `templates/relationship-details.md` - Relationship details template
- Updated `README.md` - Day 13 marked complete

✅ **Validation:**
```bash
# Verify templates exist
test -f templates/node-inventory.md
test -f templates/relationship-details.md

# Check tag
git tag | grep -q "day-13"
```

## Resources

- [Handlebars Guide](https://handlebarsjs.com/guide/)
- [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)
- [CALM Widgets Documentation](https://github.com/finos/architecture-as-code/tree/main/calm-widgets)

## Tips

- Use `{{json variable}}` to debug and see what data is available
- Start simple and add complexity incrementally
- Templates can generate any text format (MD, HTML, CSV, etc.)
- Preview in VSCode before generating static files

## Next Steps
Tomorrow (Day 14) you'll use CALM as an expert architecture advisor to improve your architecture's resilience!
