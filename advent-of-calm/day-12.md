# Day 12: Custom Documentation with CALM Widgets

## Overview
Learn about calm-widgets - a Handlebars-based widget framework for generating custom Markdown documentation from your CALM architecture data.

## Objective and Rationale
- **Objective:** Understand how to use calm-widgets to create custom documentation templates
- **Rationale:** While the docify website provides a great out-of-the-box experience, you may need custom documentation formats. CALM Widgets provide reusable Handlebars helpers that make this easy without writing everything from scratch.

## Requirements

### 1. What are CALM Widgets?

CALM Widgets is a TypeScript framework built on Handlebars that provides reusable components for generating Markdown documentation. They offer a simpler approach than writing raw Handlebars templates - you get powerful documentation capabilities without needing to learn the intricacies of Handlebars syntax.

**Fun fact:** The visualisations you see in the VSCode CALM extension are built using these same widgets!

CALM Widgets provide:

- **Pre-built visualisations** - tables, lists, Mermaid diagrams
- **Architecture-aware helpers** - understand CALM nodes, relationships, and flows
- **Customisable output** - full control over your documentation format

### 2. Explore the Widgets

Review the available widgets in the [calm-widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md):

| Widget | Purpose | Example Use |
|--------|---------|-------------|
| `table` | Render data as Markdown tables | `{{table nodes columns="name,type"}}` |
| `list` | Render arrays as Markdown lists | `{{list services property="name"}}` |
| `json-viewer` | Render data as formatted JSON | `{{json-viewer config}}` |
| `flow-sequence` | Render flows as Mermaid sequence diagrams | `{{flow-sequence flow-id="order-flow"}}` |
| `related-nodes` | Render relationships as Mermaid graphs | `{{related-nodes node-id="api-gateway"}}` |
| `block-architecture` | Render full architecture as Mermaid flowchart | `{{block-architecture this}}` |

### 3. Create a Custom Template Using Widgets

Create a new template that uses calm-widgets to generate a summary document. Create a file called `templates/architecture-summary.md` with the following content:

```handlebars
# Architecture Summary

## System Overview

{{block-architecture this}}

## Nodes

{{table nodes columns="unique-id,name,node-type,description"}}

## Relationships

{{table relationships columns="unique-id,relationship-type,description"}}
```

> **Note:** The `flow-sequence` widget requires flows to be defined in your architecture. If your architecture includes flows (covered in later days), you can add:
> ```handlebars
> {{#if flows}}
> ## Flows
> {{#each flows}}
> ### {{name}}
> {{flow-sequence flow-id=unique-id}}
> {{/each}}
> {{/if}}
> ```

### 4. Generate Documentation with Your Template

Use the CALM CLI to generate documentation:

```bash
calm docify -a architectures/ecommerce-platform.json \
  -t templates/architecture-summary.md \
  -o docs/architecture-summary.md
```

### 5. Understand the Widget Syntax

Each widget follows the Handlebars helper pattern:

```handlebars
{{!-- Basic table of nodes --}}
{{table nodes}}

{{!-- Table with specific columns --}}
{{table nodes columns="unique-id,name,node-type"}}

{{!-- Block architecture with options --}}
{{block-architecture this render-node-type-shapes=true}}

{{!-- Flow sequence for a specific flow --}}
{{flow-sequence flow-id="checkout-flow"}}

{{!-- Related nodes for a specific node --}}
{{related-nodes node-id="payment-service"}}
```

### 6. Explore Widget Options

The `block-architecture` widget has powerful options:

```handlebars
{{!-- Focus on specific nodes --}}
{{block-architecture this focus-nodes="api-gateway,user-service"}}

{{!-- Highlight specific nodes --}}
{{block-architecture this highlight-nodes="payment-service"}}

{{!-- Focus on a specific flow --}}
{{block-architecture this focus-flows="order-flow"}}

{{!-- Hide container boundaries --}}
{{block-architecture this include-containers="none"}}

{{!-- Show node type shapes --}}
{{block-architecture this render-node-type-shapes=true}}
```

### 7. Create a Node Detail Template

Create a file called `templates/node-detail.md` with the following content:

```handlebars
# Node Details

{{#each nodes}}
## {{name}}

**Type:** {{node-type}}
**ID:** {{unique-id}}
{{#if description}}
**Description:** {{description}}
{{/if}}

### Connections

{{related-nodes node-id=unique-id}}

{{#if interfaces}}
### Interfaces

{{table interfaces columns="unique-id,host,port"}}
{{/if}}

---

{{/each}}
```

### 8. Generate Node Details

```bash
calm docify -a architectures/ecommerce-platform.json \
  -t templates/node-detail.md \
  -o docs/node-details.md
```

### 9. Update Your README

Document Day 12 progress: note which widgets you used and how they simplified documentation.

### 10. Commit Your Work

```bash
git add templates/ docs/ README.md
git commit -m "Day 12: Create custom docs with calm-widgets"
git tag day-12
```

## Deliverables

✅ **Required:**
- `templates/architecture-summary.md` using calm-widgets
- `templates/node-detail.md` for per-node documentation
- Generated documentation in `docs/`
- Updated `README.md` - Day 12 marked complete

✅ **Validation:**
```bash
# Check templates exist
ls templates/*.md
# Check generated docs
ls docs/architecture-summary.md docs/node-details.md
# Check tag
git tag | grep -q "day-12"
```

## Resources

- [CALM Widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md)
- [Handlebars Documentation](https://handlebarsjs.com/)
- [Mermaid Documentation](https://mermaid.js.org/)

## Tips

- Start simple with `{{table nodes}}` and add options gradually
- The `block-architecture` widget is powerful - experiment with `focus-flows` and `highlight-nodes`
- All widgets output valid Markdown that renders in GitHub, VSCode, and documentation sites
- Use `{{json-viewer data}}` to debug what data is available in your context

## Next Steps
Tomorrow (Day 13) you'll learn to extend these templates with custom Handlebars logic - combining widgets with your own helpers for maximum flexibility!
