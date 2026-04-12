---
id: 12-calm-widgets
title: "Custom Documentation with CALM Widgets"
sidebar_position: 6
---

# Custom Documentation with CALM Widgets

🟡 **Difficulty:** Intermediate | ⏱️ **Time:** 30-45 minutes

## Overview

Learn about calm-widgets — a Handlebars-based widget framework for generating custom Markdown documentation from your CALM architecture data, using the VSCode CALM Tools extension.

## Learning Objectives

By the end of this tutorial, you will:
- Understand what CALM Widgets are and how they relate to the VSCode extension
- Create a Markdown template with YAML front matter pointing to your architecture
- Use the built-in widget catalog to render tables, diagrams, and sequence charts
- Use Live Docify Mode in the VSCode extension for instant feedback

## Prerequisites

Complete [Share Your Architecture as a Website](./11-docify) first.

## Step-by-Step Guide

### 1. What are CALM Widgets?

CALM Widgets is a TypeScript framework built on Handlebars that provides reusable components for generating Markdown documentation. They offer a simpler approach than writing raw Handlebars templates — you get powerful documentation capabilities without needing to learn the intricacies of Handlebars syntax.

**Fun fact:** The visualisations you see in the VSCode CALM extension are built using these same widgets!

CALM Widgets provide:
- **Pre-built visualisations** — tables, lists, Mermaid diagrams
- **Architecture-aware helpers** — understand CALM nodes, relationships, and flows
- **Customizable output** — full control over your documentation format

### 2. Explore the Widget Catalog

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

The YAML front matter (between the `---` markers) tells the VSCode CALM Tools extension where to find your architecture data:
- `architecture:` — Path to your CALM architecture JSON file (relative to the template file)
- `url-to-local-file-mapping:` (optional) — Path to a URL mapping file if your architecture references external schemas

The front matter is processed by the preview but won't appear in your rendered output.

### 4. Preview Your Documentation in VSCode

1. Open the file `docs/architecture-summary.md` in VSCode
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run **"CALM: Open Preview"**
4. Notice the **"Live Docify Mode"** badge is highlighted in the preview pane
5. The preview will render your widgets with live data from your architecture

As you edit the template, the preview updates in real-time — no need to run any CLI commands!

### 5. Explore Widget Customization Options

With the preview still open, try adding these sections to your document and watch the preview update in real-time:

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

Experiment with different options — the [calm-widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md) documents all available options for each widget.

> **Note:** These same templates work with the CLI `calm docify` command to generate static documentation websites for publishing or sharing.

This is a natural checkpoint — use git to record the current state of your work before moving to the next lesson.

## Key Concepts

### YAML Front Matter

```markdown
---
architecture: ../architectures/ecommerce-platform.json
---
```

The front matter links your template to an architecture file. The VSCode extension reads this to provide widget data. Use a path relative to the template file's location.

### Selecting Widget Options

Most widgets accept named options:

```
{{block-architecture this focus-flows="order-processing-flow" render-node-type-shapes=true}}
```

| Option | Widget | Effect |
|--------|--------|--------|
| `columns="..."` | `table` | Comma-separated list of properties to show |
| `node-id="..."` | `related-nodes` | Filter connections to one node |
| `flow-id="..."` | `flow-sequence`, `block-architecture` | Focus on a specific flow |
| `focus-nodes="..."` | `block-architecture` | Show only named nodes |
| `highlight-nodes="..."` | `block-architecture` | Emphasize specific nodes |
| `render-node-type-shapes=true` | `block-architecture` | Use Mermaid shapes per node type |

### Debugging with `json-viewer`

Add `{{json-viewer nodes}}` anywhere in your template to see the raw data available — useful for discovering property names before referencing them in other widgets.

## Resources

- [CALM Widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md)
- [Mermaid Documentation](https://mermaid.js.org/)

## Next Steps

In the [next tutorial](./13-handlebars-templates), you'll extend these templates with custom Handlebars logic for cases where the built-in widgets don't cover your needs!
