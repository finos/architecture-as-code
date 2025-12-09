# Day 12: Custom Documentation with CALM Widgets

## Overview
Learn about calm-widgets - the reusable React components that power CALM visualisations - and use them to create custom documentation.

## Objective and Rationale
- **Objective:** Understand calm-widgets and use them with docify's template mode to create custom documentation
- **Rationale:** The docify website from Day 11 is great for comprehensive documentation, but sometimes you need focused, custom outputs. CALM Widgets are the building blocks that render architecture visualisations, and docify templates let you compose them into custom documents.

## Requirements

### 1. Understand CALM Widgets

CALM Widgets is a library of React components designed to visualise CALM architecture data:

**What are Widgets?**
- React components that render CALM data (nodes, relationships, flows, controls)
- Used by the VSCode Extension for previews
- Used by the docify website you generated yesterday
- Available for creating custom documentation

**Available Widgets:**
| Widget | Purpose |
|--------|---------|
| `<ArchitectureOverview>` | High-level summary of architecture |
| `<NodeDetails>` | Detailed view of a single node |
| `<RelationshipDiagram>` | Visualisation of relationships |
| `<FlowDiagram>` | Sequence diagram for flows |
| `<ControlsTable>` | Table of controls |
| `<MetadataDisplay>` | Formatted metadata view |

### 2. Explore the Widgets Project

```bash
ls calm-widgets/
```

Review the README to understand the project structure:

```bash
cat calm-widgets/README.md
```

### 3. Using Widgets via Docify Templates

Rather than writing React code directly, you can use widgets in docify templates using **widget placeholders**. The docify command can render these into your documentation.

**Template syntax for widgets:**
```handlebars
<!-- Embed a widget in your template -->
{{> architectureOverview}}
{{> nodeDetails nodeId="api-gateway"}}
{{> flowDiagram flowId="order-processing-flow"}}
```

### 4. Create a Widget-Based Template

Let's create a template that uses widgets for visual elements.

**File:** `templates/architecture-dashboard.html`

**Prompt:**
```text
Create a template at templates/architecture-dashboard.html that generates an HTML dashboard for architecture review.

The template should:
1. Have a proper HTML structure with head and body
2. Include the calm-widgets CSS for styling
3. Use Handlebars to output:
   - Architecture title and metadata at the top
   - A section listing all nodes with their types
   - A section listing all relationships
   - A section for flows (if any exist)
4. Format it nicely with basic CSS for readability

This template will generate a standalone HTML file that can be shared.
```

### 5. Generate the Dashboard

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/architecture-dashboard.html \
  --output docs/generated/architecture-dashboard.html
```

Open `docs/generated/architecture-dashboard.html` in your browser to see the result.

### 6. Create a Node Summary Template

Create a focused template that summarises just the nodes:

**File:** `templates/node-summary.md`

**Content:**
```handlebars
# Node Summary: {{metadata.title}}

Generated: {{now}}

## Services ({{#each nodes}}{{#if (eq node-type "service")}}1{{/if}}{{/each}} total)

{{#each nodes}}
{{#if (eq node-type "service")}}
### {{name}}
- **ID:** `{{unique-id}}`
- **Description:** {{description}}
{{#if interfaces}}
- **Interfaces:** {{#each interfaces}}{{unique-id}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/if}}
{{/each}}

## Databases ({{#each nodes}}{{#if (eq node-type "database")}}1{{/if}}{{/each}} total)

{{#each nodes}}
{{#if (eq node-type "database")}}
### {{name}}
- **ID:** `{{unique-id}}`
- **Description:** {{description}}
{{#if interfaces}}
- **Interfaces:** {{#each interfaces}}{{unique-id}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/if}}
{{/each}}

## Other Components

{{#each nodes}}
{{#unless (or (eq node-type "service") (eq node-type "database"))}}
### {{name}}
- **ID:** `{{unique-id}}`
- **Type:** {{node-type}}
- **Description:** {{description}}

{{/unless}}
{{/each}}
```

### 7. Generate Node Summary

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/node-summary.md \
  --output docs/generated/node-summary.md
```

### 8. Create a Relationship Matrix Template

**File:** `templates/relationship-matrix.md`

**Content:**
```handlebars
# Relationship Matrix: {{metadata.title}}

## Connection Summary

| Relationship | Type | Source | Destination |
|--------------|------|--------|-------------|
{{#each relationships}}
{{#if relationship-type.connects}}
| {{unique-id}} | connects | {{relationship-type.connects.source.node}} | {{relationship-type.connects.destination.node}} |
{{/if}}
{{/each}}

## Interactions

| Relationship | Actor | Nodes |
|--------------|-------|-------|
{{#each relationships}}
{{#if relationship-type.interacts}}
| {{unique-id}} | {{relationship-type.interacts.actor}} | {{#each relationship-type.interacts.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}
{{/each}}

## Compositions

| Relationship | Container | Components |
|--------------|-----------|------------|
{{#each relationships}}
{{#if relationship-type.composed-of}}
| {{unique-id}} | {{relationship-type.composed-of.container}} | {{#each relationship-type.composed-of.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}
{{/each}}

## Deployments

| Relationship | Container | Deployed Nodes |
|--------------|-----------|----------------|
{{#each relationships}}
{{#if relationship-type.deployed-in}}
| {{unique-id}} | {{relationship-type.deployed-in.container}} | {{#each relationship-type.deployed-in.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/if}}
{{/each}}
```

### 9. Generate All Custom Documents

```bash
# Generate all custom templates
calm docify -a architectures/ecommerce-platform.json -t templates/node-summary.md -o docs/generated/node-summary.md
calm docify -a architectures/ecommerce-platform.json -t templates/relationship-matrix.md -o docs/generated/relationship-matrix.md
```

### 10. Compare Documentation Approaches

| Approach | Best For | Effort |
|----------|----------|--------|
| Docify Website | Comprehensive browsable docs | Low |
| Widget Templates | Custom HTML dashboards | Medium |
| Markdown Templates | Text-based reports | Low |

**Recommendation:** Start with the website for stakeholders, then create focused templates for specific use cases (e.g., security review, onboarding, compliance).

### 11. Update Your README

Document Day 12 progress: note the custom templates created and when to use each documentation approach.

### 12. Commit Your Work

```bash
git add templates/ docs/generated/ README.md
git commit -m "Day 12: Create custom documentation with calm-widgets templates"
git tag day-12
```

## Deliverables

✅ **Required:**
- `templates/architecture-dashboard.html` - HTML dashboard template
- `templates/node-summary.md` - Node-focused summary template
- `templates/relationship-matrix.md` - Relationship matrix template
- Generated outputs in `docs/generated/`
- Updated `README.md` - Day 12 marked complete

✅ **Validation:**
```bash
# Verify templates exist
test -f templates/node-summary.md
test -f templates/relationship-matrix.md

# Verify generated docs
test -f docs/generated/node-summary.md
test -f docs/generated/relationship-matrix.md

# Check tag
git tag | grep -q "day-12"
```

## Resources

- [CALM Widgets](https://github.com/finos/architecture-as-code/tree/main/calm-widgets)
- [Docify Template Mode](https://github.com/finos/architecture-as-code/tree/main/cli#docify)
- [Handlebars Guide](https://handlebarsjs.com/guide/)

## Tips

- Start simple - a markdown summary is often enough
- Use HTML templates when you need visual layouts
- Templates can generate any text format (MD, HTML, CSV, etc.)
- Combine multiple templates for a documentation suite
- Add template generation to your CI/CD for always up-to-date docs

## Next Steps
Tomorrow (Day 13) you'll learn advanced Handlebars techniques to create more sophisticated custom templates with conditional logic, helpers, and formatting!
