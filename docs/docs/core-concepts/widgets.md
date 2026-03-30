---
id: widgets
title: Widgets
sidebar_position: 10
---

# Widgets in CALM

Widgets are reusable, template-driven components that transform CALM architecture data into human-readable documentation. Built on Handlebars, the CALM Widgets framework lets you generate Markdown documentation — including tables, lists, and Mermaid diagrams — directly from your architecture models.

## What is a Widget?

A widget is a self-contained rendering component that accepts a CALM architecture context (or a portion of it), applies an optional set of parameters, and produces formatted Markdown output. Widgets are registered as Handlebars helpers, so you invoke them directly inside documentation templates using the familiar `{{widget-name context options}}` syntax.

The framework ships with a set of built-in widgets covering the most common documentation needs. You can also create custom widgets by implementing the `CalmWidget` interface.

### Key Built-in Widgets

- **table**: Renders any data as a Markdown table. Supports horizontal and vertical layouts, column filtering, nested object expansion, and CALM-specific `sections` (`overview`, `extended`, `metadata`) for displaying node properties in a structured way.
- **list**: Renders arrays as ordered or unordered Markdown lists, with the ability to extract a specific property from objects in the array.
- **json-viewer**: Outputs data as a formatted JSON code block, useful for displaying raw configuration or contract details.
- **flow-sequence**: Converts a CALM flow (a sequence of ordered transitions) into a Mermaid sequence diagram, making it easy to visualise how nodes interact over time.
- **related-nodes**: Renders a Mermaid graph diagram showing all relationships involving a specific node, or the detail of a single relationship. Supports `connects`, `interacts`, `composed-of`, and `deployed-in` relationship types.
- **block-architecture**: Renders a full system architecture as a Mermaid flowchart, with support for containers (systems), interfaces, flow-focused slices, node-type shapes, themes, and clickable links.

### Example of Widget Usage

The following template uses two widgets to document a node: the `table` widget displays the node's core properties in a vertical layout, and the `block-architecture` widget renders the surrounding architecture as a diagram.

```handlebars
## {{nodes["payment-service"].name}}

### Overview
{{table nodes["payment-service"] orientation="vertical" sections="overview"}}

### Architecture
{{block-architecture this focus-nodes="payment-service" highlight-nodes="payment-service"}}
```

When rendered against a CALM architecture, this produces a Markdown table of the node's `unique-id`, `name`, `description`, and `node-type`, followed by a Mermaid flowchart scoped to the payment service and its immediate connections.

### Using Widgets Effectively

Widgets are most effective when they are used alongside CALM architecture models to produce living documentation:

- **Scope diagrams**: Use `focus-nodes`, `focus-flows`, or `focus-relationships` options on the `block-architecture` widget to generate scoped diagrams for specific sections of your documentation, rather than rendering the full architecture every time.
- **Surface metadata**: Use `table` with `sections="metadata"` alongside an `empty-message` to gracefully handle nodes that may or may not carry metadata, keeping documentation clean regardless of input completeness.
- **Visualise flows**: Use `flow-sequence` to generate sequence diagrams from CALM flow definitions, making the ordered interactions between nodes explicit and auditable.
- See the [Widgets README file](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md) for details on the parameters available for each built-in widget.