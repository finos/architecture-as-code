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

### 5. Create a Custom Template

Handlebars templates allow custom documentation formats.

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
- **{{this.name}}** ({{this.node-type.name}}): {{this.description}}
{{/each}}

## Integrations

This architecture has **{{relationships.length}}** connections:

{{#each relationships}}
- {{this.description}}
  - Protocol: {{this.relationship-type.connects.protocol}}
{{/each}}

## Flows

{{#if flows}}
{{#each flows}}
### {{this.name}}
{{this.description}}

Steps:
{{#each this.transitions}}
{{this.sequence-number}}. {{this.summary}}
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
*Generated from CALM architecture on {{metadata.timestamp}}*
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
**Type:** {{this.node-type.name}}  
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
