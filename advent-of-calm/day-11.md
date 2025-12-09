# Day 11: Generate Documentation with Docify

## Overview
Transform your CALM architecture into browsable HTML documentation using the docify command.

## Objective and Rationale
- **Objective:** Use `calm docify` to generate comprehensive documentation website from your architecture
- **Rationale:** Machine-readable architecture (JSON) needs human-readable outputs. Docify generates documentation automatically, ensuring docs stay in sync with architecture. Essential for stakeholder communication and onboarding.

## Requirements

### 1. Understand Docify

The `calm docify` command generates documentation in multiple modes:
- **Website mode (default):** Full HTML website with navigation
- **Template mode:** Single file using custom template
- **Template-dir mode:** Multiple files using template bundle

### 2. Generate Default Documentation Website

```bash
calm docify --architecture architectures/ecommerce-platform.json --output docs/generated/ecommerce-docs
```

This creates a complete HTML website with:
- Index page with architecture overview
- Node details pages
- Relationship visualization
- Flow diagrams
- Control and metadata display

### 3. Install and Run the Documentation Website

The generated website is a self-contained application. Install dependencies and start it:

```bash
cd docs/generated/ecommerce-docs
npm install
npm start
```

This will start a local development server. Open the URL shown in your terminal (usually `http://localhost:3000`) to browse your architecture documentation.

**Explore the website:**
- Navigate through different sections (nodes, relationships, flows, controls)
- Click on nodes to see their details
- View flow sequence diagrams
- **Take screenshots** of the main pages

When done, press `Ctrl+C` to stop the server and return to your project root:

```bash
cd ../../..
```

### 4. Understand Handlebars Templates

Docify uses [Handlebars](https://handlebarsjs.com/) as its templating engine. Handlebars provides a simple way to generate text output from your architecture data using mustache-style `{{expressions}}`.

#### Basic Handlebars Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{property}}` | Output a value | `{{metadata.version}}` → `1.0.0` |
| `{{#each array}}...{{/each}}` | Loop over arrays | `{{#each nodes}}{{this.name}}{{/each}}` |
| `{{#if condition}}...{{/if}}` | Conditional rendering | `{{#if metadata}}...{{/if}}` |
| `{{#if condition}}...{{else}}...{{/if}}` | If-else | `{{#if flows}}...{{else}}No flows{{/if}}` |
| `{{@key}}` | Current key when iterating objects | Used with `{{#each}}` on objects |
| `{{this}}` | Current item in loop | `{{#each tags}}{{this}}{{/each}}` |
| `{{this.property}}` | Property of current item | `{{#each nodes}}{{this.name}}{{/each}}` |

#### CALM Docify Helpers

CALM's docify command registers several custom Handlebars helpers to make templating easier:

| Helper | Description | Example |
|--------|-------------|---------|
| `eq` | Equality comparison | `{{#if (eq node-type "service")}}...{{/if}}` |
| `or` | Logical OR | `{{#if (or hasFlows hasControls)}}...{{/if}}` |
| `json` | Output as JSON | `{{json metadata}}` |
| `lookup` | Dynamic property access | `{{lookup this propertyName}}` |
| `kebabCase` | Convert to kebab-case | `{{kebabCase name}}` |
| `kebabToTitleCase` | Convert kebab to Title Case | `{{kebabToTitleCase node-type}}` |
| `isObject` | Check if value is object | `{{#if (isObject value)}}...{{/if}}` |
| `isArray` | Check if value is array | `{{#if (isArray items)}}...{{/if}}` |
| `notEmpty` | Check if value exists and not empty | `{{#if (notEmpty interfaces)}}...{{/if}}` |
| `eachInMap` | Iterate over map/object entries | `{{#eachInMap controls}}...{{/eachInMap}}` |
| `mermaidId` | Sanitize ID for Mermaid diagrams | `{{mermaidId unique-id}}` |
| `join` | Join array elements | `{{join tags ", "}}` |

#### Common Patterns

**Filter nodes by type:**
```handlebars
{{#each nodes}}
{{#if (eq node-type "service")}}
- {{this.name}} is a service
{{/if}}
{{/each}}
```

**Handle missing data gracefully:**
```handlebars
{{#if metadata.owner}}
**Owner:** {{metadata.owner}}
{{else}}
**Owner:** Not specified
{{/if}}
```

**Iterate over object properties:**
```handlebars
{{#each metadata}}
- **{{@key}}:** {{this}}
{{/each}}
```

### 5. Create a Custom Template

Now let's create custom templates using these Handlebars features.

**File:** `templates/architecture-summary.md`

**Content:**
```handlebars
# {{metadata.title}} Architecture Summary

**Version:** {{metadata.version}}  
**Owner:** {{metadata.owner}}

## Overview
{{metadata.description}}

## Components

This architecture contains **{{nodes.length}}** nodes:

{{#each nodes}}
- **{{this.name}}** ({{this.node-type}}): {{this.description}}
{{/each}}

## Integrations

This architecture has **{{relationships.length}}** relationships:

{{#each relationships}}
- **{{this.unique-id}}** ({{#each this.relationship-type}}{{@key}}{{/each}})
{{#if this.relationship-type.connects}}
  - {{this.relationship-type.connects.source.node}} → {{this.relationship-type.connects.destination.node}}
{{/if}}
{{#if this.relationship-type.interacts}}
  - Actor: {{this.relationship-type.interacts.actor}} interacts with: {{#each this.relationship-type.interacts.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if this.relationship-type.deployed-in}}
  - Container: {{this.relationship-type.deployed-in.container}} contains: {{#each this.relationship-type.deployed-in.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{#if this.relationship-type.composed-of}}
  - Container: {{this.relationship-type.composed-of.container}} composed of: {{#each this.relationship-type.composed-of.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/each}}

## Flows

{{#if flows}}
{{#each flows}}
### {{this.name}}
{{this.description}}

Steps:
{{#each this.transitions}}
{{this.sequence-number}}. {{this.description}}
{{/each}}

{{/each}}
{{else}}
No flows defined yet.
{{/if}}

## Controls

{{#if controls}}
{{#each controls}}
### {{@key}}
{{this.description}}

{{/each}}
{{else}}
No controls defined yet.
{{/if}}

---
*Generated from CALM architecture on {{metadata.created}}*
```

### 6. Generate Documentation Using Custom Template

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/architecture-summary.md \
  --output docs/generated/architecture-summary.md
```

Open `docs/generated/architecture-summary.md` - it's a markdown summary!

### 7. Create a Node Catalog Template

**File:** `templates/node-catalog.md`

**Content:**
```handlebars
# Node Catalog

## Architecture: {{metadata.title}}

Total Nodes: {{nodes.length}}

---

{{#each nodes}}
## {{this.name}}

**ID:** `{{this.unique-id}}`  
**Type:** {{this.node-type}}  
**Description:** {{this.description}}

{{#if this.interfaces}}
### Interfaces
{{#each this.interfaces}}
- **{{this.unique-id}}**
  {{#if this.host}}
  - Host: {{this.host}}
  {{/if}}
  {{#if this.port}}
  - Port: {{this.port}}
  {{/if}}
  {{#if this.url}}
  - URL: {{this.url}}
  {{/if}}
{{/each}}
{{else}}
No interfaces defined.
{{/if}}

{{#if this.controls}}
### Controls
{{#each this.controls}}
- **{{@key}}:** {{this.description}}
{{/each}}
{{/if}}

{{#if this.metadata}}
### Metadata
{{#each this.metadata}}
- **{{@key}}:** {{this}}
{{/each}}
{{/if}}

---

{{/each}}
```

### 8. Generate Node Catalog

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/node-catalog.md \
  --output docs/generated/node-catalog.md
```

### 9. Update Your README

Document Day 11 progress in your README: mark the checklist, describe the new documentation outputs, and link to `docs/generated/README.md` or the screenshots so stakeholders know where to browse the generated sites.

### 10. Commit Your Work

```bash
git add templates/ docs/generated/ README.md
git commit -m "Day 11: Generate documentation with docify and custom templates"
git tag day-11
```

## Deliverables

✅ **Required:**
- `docs/generated/ecommerce-docs/` - Full website documentation
- `docs/generated/architecture-summary.md` - Custom summary
- `docs/generated/node-catalog.md` - Custom node catalog
- `templates/architecture-summary.md` - Custom template
- `templates/node-catalog.md` - Custom template
- Screenshots of generated documentation
- Updated `README.md` - Day 11 marked complete

✅ **Validation:**
```bash
# Verify generated documentation exists
test -d docs/generated/ecommerce-docs
test -f docs/generated/architecture-summary.md
test -f docs/generated/node-catalog.md

# Verify templates exist
test -f templates/architecture-summary.md
test -f templates/node-catalog.md

# Check tag
git tag | grep -q "day-11"
```

## Resources

- [Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)
- [Handlebars Templates](https://handlebarsjs.com/guide/)
- [CALM Template Examples](https://github.com/finos/architecture-as-code/tree/main/cli/test_fixtures/template)

## Tips

- Regenerate documentation after every architecture change
- Use custom templates for different audiences (executives vs. developers)
- Add documentation generation to CI/CD pipeline
- Templates can access all CALM properties (nodes, relationships, flows, controls)
- Use `--url-to-local-file-mapping` to make local file references clickable

## Next Steps
Tomorrow (Day 12) you'll use CALM as an expert architecture advisor to improve your e-commerce platform's resilience!
