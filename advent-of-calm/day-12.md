# Day 12: Custom Documentation with CALM Widgets

## Overview
Learn about calm-widgets - a Handlebars-based widget framework for generating custom Markdown documentation from your CALM architecture data, using the VSCode CALM Preview.

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
| `related-nodes` | Render relationships as Mermaid graphs | `{{related-nodes node-id="api-gateway"}}` |
| `block-architecture` | Render full architecture as Mermaid flowchart | `{{block-architecture this}}` |
| `flow-sequence` | Render a flow as a Mermaid sequence diagram | `{{flow-sequence this flow-id="my-flow"}}` |

### 3. Create a Custom Template Using Widgets

The easiest way to use calm-widgets is with the **VSCode CALM Preview**. Create a Markdown file with YAML front matter that specifies your architecture, and the preview will render the widgets live.

Create a file called `docs/architecture-summary.md` with the following content:

```markdown
---
architecture: ../architectures/ecommerce-platform.json
---

# Architecture Summary

## System Overview

{{block-architecture this}}
```

**Understanding the Front Matter:**

The YAML front matter (between the `---` markers) tells the VSCode CALM Preview where to find your architecture data:

- `architecture:` - Path to your CALM architecture JSON file (relative to the template file)
- `url-to-local-file-mapping:` (optional) - Path to a URL mapping file if your architecture references external schemas

The front matter is processed by the preview but won't appear in your rendered output.

### 4. Preview Your Documentation in VSCode

1. Open the file `docs/architecture-summary.md` in VSCode
2. Open the Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run **"CALM: Open Preview"**
4. Notice the **"Live Docify Mode"** badge is highlighted in the preview pane
5. The preview will render your widgets with live data from your architecture

As you edit the template, the preview updates in real-time - no need to run any CLI commands!

### 5. Explore Widget Customization Options

The power of calm-widgets lies in their customization options. With the preview still open, try adding these sections to your document and watch the preview update in real-time:

**Add a nodes table with specific columns:**

```markdown
## Nodes

{{table nodes columns="unique-id,name,node-type,description"}}
```

**Focus on a specific flow in the architecture diagram:**

```markdown
## Order Processing Flow View

{{block-architecture this focus-flows="order-processing-flow"}}
```

This filters the diagram to show only the nodes and relationships involved in that flow.

**Highlight specific nodes and render node type shapes:**

```markdown
## Payment Processing Components

{{block-architecture this focus-nodes="payment-service,order-service" highlight-nodes="payment-service" render-node-type-shapes=true}}
```

**Render a flow as a sequence diagram:**

```markdown
## Order Processing Sequence

{{flow-sequence this flow-id="order-processing-flow"}}
```

**Show relationships for a specific node:**

```markdown
## API Gateway Connections

{{related-nodes node-id="api-gateway"}}
```

Experiment with different options - the [calm-widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md) documents all available options for each widget.

**Note:** These same templates work with the CLI `calm docify` command to generate static documentation websites for publishing or sharing.

### 6. Update Your README

Document Day 12 progress: note which widgets you used and how they simplified documentation.

### 7. Commit Your Work

```bash
git add docs/ README.md
git commit -m "Day 12: Create custom docs with calm-widgets"
git tag day-12
```

## Deliverables

✅ **Required:**
- `docs/architecture-summary.md` using calm-widgets with front matter
- Updated `README.md` - Day 12 marked complete

✅ **Validation:**
```bash
# Check template exists
ls docs/architecture-summary.md
# Check tag
git tag | grep -q "day-12"
```

## Resources

- [CALM Widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md)
- [Mermaid Documentation](https://mermaid.js.org/)

## Tips

- Start simple with `{{table nodes}}` and add options gradually
- The `block-architecture` widget is powerful - experiment with `focus-flows` and `highlight-nodes`
- Use the VSCode CALM Preview for instant feedback as you build templates
- Use `{{json-viewer data}}` to debug what data is available in your context

## Next Steps
Tomorrow (Day 13) you'll learn to extend these templates with custom Handlebars logic - combining widgets with your own helpers for maximum flexibility!
