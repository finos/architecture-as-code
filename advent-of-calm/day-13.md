# Day 13: Advanced Handlebars for Custom Documentation

## Overview
Master Handlebars templating to create sophisticated, bespoke documentation outputs from your CALM architectures.

## Objective and Rationale
- **Objective:** Learn advanced Handlebars syntax and CALM's custom helpers to create powerful documentation templates
- **Rationale:** While calm-widgets and simple templates cover most use cases, sometimes you need full control over documentation output. Handlebars gives you the power to create highly customised documents for specific audiences or compliance requirements.

## Requirements

### 1. Review Handlebars Basics

Docify uses [Handlebars](https://handlebarsjs.com/) as its templating engine. If you're new to Handlebars, here's a quick refresher:

#### Basic Syntax

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{property}}` | Output a value | `{{metadata.version}}` → `1.0.0` |
| `{{#each array}}...{{/each}}` | Loop over arrays | `{{#each nodes}}{{this.name}}{{/each}}` |
| `{{#if condition}}...{{/if}}` | Conditional rendering | `{{#if metadata}}...{{/if}}` |
| `{{#if condition}}...{{else}}...{{/if}}` | If-else | `{{#if flows}}...{{else}}No flows{{/if}}` |
| `{{@key}}` | Current key when iterating objects | Used with `{{#each}}` on objects |
| `{{this}}` | Current item in loop | `{{#each tags}}{{this}}{{/each}}` |
| `{{this.property}}` | Property of current item | `{{#each nodes}}{{this.name}}{{/each}}` |
| `{{@index}}` | Current index in loop (0-based) | `{{@index}}. {{this.name}}` |
| `{{@first}}` / `{{@last}}` | Boolean for first/last item | `{{#unless @last}}, {{/unless}}` |

### 2. CALM Docify Custom Helpers

CALM's docify command registers several custom Handlebars helpers to make templating easier:

| Helper | Description | Example |
|--------|-------------|---------|
| `eq` | Equality comparison | `{{#if (eq node-type "service")}}...{{/if}}` |
| `or` | Logical OR | `{{#if (or hasFlows hasControls)}}...{{/if}}` |
| `and` | Logical AND | `{{#if (and hasNodes hasRelationships)}}...{{/if}}` |
| `not` | Logical NOT | `{{#if (not isEmpty)}}...{{/if}}` |
| `json` | Output as JSON | `{{json metadata}}` |
| `lookup` | Dynamic property access | `{{lookup this propertyName}}` |
| `kebabCase` | Convert to kebab-case | `{{kebabCase name}}` |
| `kebabToTitleCase` | Convert kebab to Title Case | `{{kebabToTitleCase node-type}}` |
| `isObject` | Check if value is object | `{{#if (isObject value)}}...{{/if}}` |
| `isArray` | Check if value is array | `{{#if (isArray items)}}...{{/if}}` |
| `notEmpty` | Check if value exists and not empty | `{{#if (notEmpty interfaces)}}...{{/if}}` |
| `eachInMap` | Iterate over map/object entries | `{{#eachInMap controls}}...{{/eachInMap}}` |
| `mermaidId` | Sanitise ID for Mermaid diagrams | `{{mermaidId unique-id}}` |
| `join` | Join array elements | `{{join tags ", "}}` |
| `now` | Current timestamp | `Generated: {{now}}` |

### 3. Advanced Pattern: Filtering Nodes by Type

Create a template that groups nodes by their type:

**File:** `templates/nodes-by-type.md`

**Content:**
```handlebars
# Architecture Components by Type

{{metadata.title}} - Generated {{now}}

{{#each (groupBy nodes "node-type")}}
## {{@key}}

{{#each this}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/each}}

{{/each}}
```

If `groupBy` isn't available, use this pattern instead:

```handlebars
# Architecture Components by Type

## Services

{{#each nodes}}
{{#if (eq node-type "service")}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/if}}
{{/each}}

## Databases

{{#each nodes}}
{{#if (eq node-type "database")}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/if}}
{{/each}}

## Systems

{{#each nodes}}
{{#if (eq node-type "system")}}
- **{{name}}** (`{{unique-id}}`): {{description}}
{{/if}}
{{/each}}

## Other Components

{{#each nodes}}
{{#unless (or (eq node-type "service") (eq node-type "database") (eq node-type "system"))}}
- **{{name}}** ({{node-type}}): {{description}}
{{/unless}}
{{/each}}
```

### 4. Advanced Pattern: Handling Relationship Types

Relationships in CALM can have different types. Create a template that handles all of them:

**File:** `templates/comprehensive-relationships.md`

**Content:**
```handlebars
# Relationship Documentation

## All Connections

This architecture defines **{{relationships.length}}** relationships.

{{#each relationships}}
### {{unique-id}}

{{#with relationship-type}}
{{#if connects}}
**Type:** Connection
- **From:** {{connects.source.node}}{{#if connects.source.interface}} ({{connects.source.interface}}){{/if}}
- **To:** {{connects.destination.node}}{{#if connects.destination.interface}} ({{connects.destination.interface}}){{/if}}
{{/if}}

{{#if interacts}}
**Type:** Interaction
- **Actor:** {{interacts.actor}}
- **Interacts with:** {{#each interacts.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{#if composed-of}}
**Type:** Composition
- **Container:** {{composed-of.container}}
- **Contains:** {{#each composed-of.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{#if deployed-in}}
**Type:** Deployment
- **Infrastructure:** {{deployed-in.container}}
- **Deployed:** {{#each deployed-in.nodes}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}
{{/with}}

{{#if description}}
**Description:** {{description}}
{{/if}}

---

{{/each}}
```

### 5. Advanced Pattern: Generating Mermaid Diagrams

Create a template that generates Mermaid diagram syntax:

**File:** `templates/mermaid-architecture.md`

**Content:**
```handlebars
# Architecture Diagram

## System Overview

```mermaid
graph TD
{{#each nodes}}
    {{mermaidId unique-id}}["{{name}}<br/>{{kebabToTitleCase node-type}}"]
{{/each}}

{{#each relationships}}
{{#with relationship-type}}
{{#if connects}}
    {{mermaidId connects.source.node}} --> {{mermaidId connects.destination.node}}
{{/if}}
{{#if interacts}}
    {{mermaidId interacts.actor}} -.-> {{#each interacts.nodes}}{{mermaidId this}}{{#unless @last}} & {{/unless}}{{/each}}
{{/if}}
{{/with}}
{{/each}}
```

## Node Styles

```mermaid
graph TD
{{#each nodes}}
{{#if (eq node-type "service")}}
    style {{mermaidId unique-id}} fill:#90EE90
{{/if}}
{{#if (eq node-type "database")}}
    style {{mermaidId unique-id}} fill:#87CEEB
{{/if}}
{{#if (eq node-type "actor")}}
    style {{mermaidId unique-id}} fill:#FFB6C1
{{/if}}
{{/each}}
```
```

### 6. Advanced Pattern: Conditional Sections

Create a template with sections that only appear when data exists:

**File:** `templates/architecture-summary.md`

**Content:**
```handlebars
# {{metadata.title}}

{{#if metadata.description}}
> {{metadata.description}}
{{/if}}

**Version:** {{metadata.version}}
{{#if metadata.owner}}**Owner:** {{metadata.owner}}{{/if}}

---

## Components ({{nodes.length}})

{{#each nodes}}
- **{{name}}** ({{kebabToTitleCase node-type}}): {{description}}
{{/each}}

## Integrations ({{relationships.length}})

{{#each relationships}}
- **{{unique-id}}** ({{#with relationship-type}}{{#if connects}}connects{{/if}}{{#if interacts}}interacts{{/if}}{{#if composed-of}}composed-of{{/if}}{{#if deployed-in}}deployed-in{{/if}}{{/with}})
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

{{#if (notEmpty flows)}}
## Business Flows ({{flows.length}})

{{#each flows}}
### {{name}}

{{description}}

| Step | Transition | Description |
|------|------------|-------------|
{{#each transitions}}
| {{sequence-number}} | {{relationship-unique-id}} | {{description}} |
{{/each}}

{{/each}}
{{/if}}

{{#if (notEmpty controls)}}
## Controls

{{#eachInMap controls}}
### {{@key}}

{{this.description}}

{{#if this.requirements}}
**Requirements:**
{{#each this.requirements}}
- {{this.control-requirement-url}}
{{/each}}
{{/if}}

{{/eachInMap}}
{{/if}}

---
*Generated from CALM architecture on {{now}}*
```

### 7. Generate All Advanced Templates

```bash
# Generate all templates
calm docify -a architectures/ecommerce-platform.json -t templates/nodes-by-type.md -o docs/generated/nodes-by-type.md
calm docify -a architectures/ecommerce-platform.json -t templates/comprehensive-relationships.md -o docs/generated/comprehensive-relationships.md
calm docify -a architectures/ecommerce-platform.json -t templates/mermaid-architecture.md -o docs/generated/mermaid-architecture.md
calm docify -a architectures/ecommerce-platform.json -t templates/architecture-summary.md -o docs/generated/architecture-summary.md
```

### 8. Review Generated Outputs

Open each generated file and verify:
- Nodes are correctly grouped and displayed
- Relationships show proper connection details
- Mermaid diagrams render correctly (paste into a Mermaid viewer)
- Conditional sections appear only when data exists

### 9. Create a Template for Your Use Case

**Prompt:**
```text
Create a Handlebars template for [YOUR USE CASE]. For example:
- Security review checklist
- Compliance documentation
- Developer onboarding guide
- Executive summary

The template should use CALM docify helpers and produce a well-formatted output.
```

### 10. Commit Your Work

```bash
git add templates/ docs/generated/ README.md
git commit -m "Day 13: Create advanced Handlebars templates for custom documentation"
git tag day-13
```

## Deliverables

✅ **Required:**
- `templates/nodes-by-type.md` - Nodes grouped by type
- `templates/comprehensive-relationships.md` - Full relationship documentation
- `templates/mermaid-architecture.md` - Mermaid diagram generator
- `templates/architecture-summary.md` - Comprehensive summary with conditionals
- Generated outputs in `docs/generated/`
- Updated `README.md` - Day 13 marked complete

✅ **Validation:**
```bash
# Verify templates exist
ls templates/*.md

# Verify generated docs
ls docs/generated/*.md

# Check tag
git tag | grep -q "day-13"
```

## Resources

- [Handlebars Guide](https://handlebarsjs.com/guide/)
- [Handlebars Built-in Helpers](https://handlebarsjs.com/guide/builtin-helpers.html)
- [Mermaid Diagram Syntax](https://mermaid.js.org/syntax/flowchart.html)
- [CALM Docify Source](https://github.com/finos/architecture-as-code/tree/main/cli/src/commands/docify)

## Tips

- Use `{{json variable}}` to debug what data is available
- Test templates incrementally - add one section at a time
- The `notEmpty` helper is your friend for conditional sections
- Mermaid IDs need to be sanitised - use `{{mermaidId}}`
- Combine templates for a complete documentation suite

## Common Gotchas

1. **Nested properties:** Use `{{#with}}` to change context, or fully qualify paths like `{{this.relationship-type.connects.source.node}}`
2. **Empty arrays:** Always check with `{{#if}}` or `{{notEmpty}}` before iterating
3. **Special characters:** Mermaid and some outputs need escaping
4. **Whitespace:** Handlebars preserves whitespace - use `{{~` and `~}}` to trim

## Next Steps
Tomorrow (Day 14) you'll use CALM as an expert architecture advisor to improve your e-commerce platform's resilience!
