# Day 13: Custom Documentation with Handlebars Templates

## Overview
Create custom documentation outputs using Handlebars templates with the docify command - giving you full control over format and content.

## Objective and Rationale
- **Objective:** Use docify's template mode to create focused, custom documentation from your CALM architecture
- **Rationale:** While the generated website (Day 11) is great for comprehensive documentation, sometimes you need specific outputs: a markdown summary for a README, a node inventory for compliance, or a relationship table for review. Handlebars templates let you create exactly what you need.

## Requirements

### 1. Understand Docify Template Mode

The `calm docify` command has multiple modes:
- **Website mode (default):** Full HTML website - what you used on Day 11
- **Template mode:** Single file from a custom template - what we'll use today
- **Template-dir mode:** Multiple files from a template bundle - for advanced use cases

### 2. Create Your First Template

Create a simple markdown template that summarises your architecture:

**File:** `templates/architecture-summary.md`

**Content:**
```handlebars
# {{metadata.title}}

{{#if metadata.description}}
> {{metadata.description}}
{{/if}}

**Version:** {{metadata.version}}

## Components ({{nodes.length}} total)

{{#each nodes}}
- **{{name}}** ({{node-type}}): {{description}}
{{/each}}

## Connections ({{relationships.length}} total)

{{#each relationships}}
- **{{unique-id}}**
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

---
*Generated from CALM architecture on {{now}}*
```

### 3. Generate Documentation from Template

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/architecture-summary.md \
  --output docs/generated/architecture-summary.md
```

Open `docs/generated/architecture-summary.md` to see the result.

### 4. Handlebars Basics

Docify uses [Handlebars](https://handlebarsjs.com/) templating. Here's what you need to know:

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{property}}` | Output a value | `{{metadata.version}}` |
| `{{#each array}}...{{/each}}` | Loop over arrays | `{{#each nodes}}{{name}}{{/each}}` |
| `{{#if condition}}...{{/if}}` | Conditional | `{{#if description}}...{{/if}}` |
| `{{#unless condition}}...{{/unless}}` | Negative conditional | `{{#unless @last}}, {{/unless}}` |
| `{{@index}}` | Current index in loop | `{{@index}}. {{name}}` |
| `{{@last}}` | Is last item in loop | For comma-separated lists |
| `{{this}}` | Current item | `{{#each tags}}{{this}}{{/each}}` |

### 5. CALM-Specific Helpers

Docify includes custom helpers for common tasks:

| Helper | Description | Example |
|--------|-------------|---------|
| `eq` | Equality check | `{{#if (eq node-type "service")}}` |
| `or` | Logical OR | `{{#if (or hasFlows hasControls)}}` |
| `now` | Current timestamp | `Generated: {{now}}` |
| `json` | Output as JSON | `{{json metadata}}` |
| `kebabToTitleCase` | Format text | `{{kebabToTitleCase node-type}}` |
| `notEmpty` | Check if has content | `{{#if (notEmpty flows)}}` |

### 6. Create a Node Inventory Template

Create a template focused on nodes:

**File:** `templates/node-inventory.md`

**Content:**
```handlebars
# Node Inventory: {{metadata.title}}

Generated: {{now}}

| Name | Type | ID | Description |
|------|------|-------|-------------|
{{#each nodes}}
| {{name}} | {{kebabToTitleCase node-type}} | `{{unique-id}}` | {{description}} |
{{/each}}

## By Type

### Services
{{#each nodes}}
{{#if (eq node-type "service")}}
- {{name}} (`{{unique-id}}`)
{{/if}}
{{/each}}

### Databases
{{#each nodes}}
{{#if (eq node-type "database")}}
- {{name}} (`{{unique-id}}`)
{{/if}}
{{/each}}

### Other
{{#each nodes}}
{{#unless (or (eq node-type "service") (eq node-type "database"))}}
- {{name}} ({{node-type}})
{{/unless}}
{{/each}}
```

### 7. Generate Node Inventory

```bash
calm docify \
  --architecture architectures/ecommerce-platform.json \
  --template templates/node-inventory.md \
  --output docs/generated/node-inventory.md
```

### 8. Create a Relationship Matrix

**File:** `templates/relationship-matrix.md`

**Content:**
```handlebars
# Relationship Matrix: {{metadata.title}}

| ID | Type | Details |
|----|------|---------|
{{#each relationships}}
| `{{unique-id}}` | {{#if relationship-type.connects}}connects{{/if}}{{#if relationship-type.interacts}}interacts{{/if}}{{#if relationship-type.composed-of}}composed-of{{/if}}{{#if relationship-type.deployed-in}}deployed-in{{/if}} | {{#if relationship-type.connects}}{{relationship-type.connects.source.node}} → {{relationship-type.connects.destination.node}}{{/if}}{{#if relationship-type.interacts}}{{relationship-type.interacts.actor}} ↔ {{#each relationship-type.interacts.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if relationship-type.composed-of}}{{relationship-type.composed-of.container}} ⊃ {{#each relationship-type.composed-of.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}{{#if relationship-type.deployed-in}}{{relationship-type.deployed-in.container}} ⊃ {{#each relationship-type.deployed-in.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}} |
{{/each}}
```

### 9. Generate All Custom Documents

```bash
calm docify -a architectures/ecommerce-platform.json -t templates/architecture-summary.md -o docs/generated/architecture-summary.md
calm docify -a architectures/ecommerce-platform.json -t templates/node-inventory.md -o docs/generated/node-inventory.md
calm docify -a architectures/ecommerce-platform.json -t templates/relationship-matrix.md -o docs/generated/relationship-matrix.md
```

### 10. When to Use Each Approach

| Approach | Best For | Effort |
|----------|----------|--------|
| Docify Website | Stakeholder browsing, presentations | Low |
| Markdown Templates | READMEs, wikis, reviews | Low |
| HTML Templates | Custom dashboards | Medium |

### 11. Update Your README

Document Day 13 progress: list the templates created and their purposes.

### 12. Commit Your Work

```bash
git add templates/ docs/generated/ README.md
git commit -m "Day 13: Create custom documentation with Handlebars templates"
git tag day-13
```

## Deliverables

✅ **Required:**
- `templates/architecture-summary.md` - Overall summary template
- `templates/node-inventory.md` - Node-focused template
- `templates/relationship-matrix.md` - Relationship table template
- Generated outputs in `docs/generated/`
- Updated `README.md` - Day 13 marked complete

✅ **Validation:**
```bash
# Verify templates exist
test -f templates/architecture-summary.md
test -f templates/node-inventory.md

# Verify generated docs
test -f docs/generated/architecture-summary.md
test -f docs/generated/node-inventory.md

# Check tag
git tag | grep -q "day-13"
```

## Resources

- [Handlebars Guide](https://handlebarsjs.com/guide/)
- [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)
- [CALM Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)

## Tips

- Use `{{json variable}}` to debug and see what data is available
- Start simple and add complexity incrementally
- Templates can generate any text format (MD, HTML, CSV, etc.)
- Add template generation to CI/CD for always up-to-date docs

## Next Steps
Tomorrow (Day 14) you'll use CALM as an expert architecture advisor to improve your architecture's resilience!
