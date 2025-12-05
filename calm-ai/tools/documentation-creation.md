# CALM Documentation Creation Guide

## Overview

This guide covers creating documentation from CALM architectures using the calm-widgets framework and related tooling.

## CALM Widgets Framework

The calm-widgets framework provides reusable components for visualizing and documenting CALM architectures:

- **Architecture Diagrams** - Visual representations of nodes and relationships
- **Node Details** - Component specifications and metadata
- **Flow Visualizations** - Business process flows
- **Control Matrices** - Compliance and governance views
- **Interface Catalogs** - API and communication documentation

## Documentation Generation Methods

### 1. CLI Docify Command

Generate static documentation sites:

```bash
calm docify \
  --architecture architecture.json \
  --output ./docs \
  --template-dir ./templates
```

### 2. Custom Templates

Create Handlebars templates for custom documentation:

**Node Documentation Template:**

```handlebars
{{#each nodes}}
    ##
    {{name}}

    **Type:**
    {{node-type}}
    **Description:**
    {{description}}

    {{#if interfaces}}
        ### Interfaces
        {{#each interfaces}}
            - **{{unique-id}}**:
            {{#if host}}{{host}}:{{port}}{{/if}}{{#if url}}{{url}}{{/if}}
        {{/each}}
    {{/if}}

    {{#if metadata}}
        ### Metadata
        {{#each metadata}}
            {{#each this}}
                - **{{@key}}**:
                {{this}}
            {{/each}}
        {{/each}}
    {{/if}}

{{/each}}
```

**Relationship Documentation Template:**

```handlebars
{{#each relationships}}
    ##
    {{description}}

    **Type:**
    {{relationship-type}}
    {{#if protocol}}**Protocol:** {{protocol}}{{/if}}

    {{#if relationship-type.connects}}
        **Source:**
        {{relationship-type.connects.source.node}}
        **Destination:**
        {{relationship-type.connects.destination.node}}
    {{/if}}

{{/each}}
```

### 3. Widget Integration

Embed CALM widgets in custom documentation:

**HTML Integration:**

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Architecture Documentation</title>
        <script src="calm-widgets.js"></script>
    </head>
    <body>
        <div id="architecture-diagram"></div>
        <script>
            CalmWidgets.createArchitectureDiagram('#architecture-diagram', {
                architecture: architectureData,
                layout: 'dagre',
                showLabels: true,
            });
        </script>
    </body>
</html>
```

**React Integration:**

```jsx
import { ArchitectureDiagram, FlowChart } from '@finos/calm-widgets';

function ArchitectureDoc({ architecture }) {
    return (
        <div>
            <h1>{architecture.name}</h1>
            <ArchitectureDiagram
                data={architecture}
                layout="dagre"
                showLabels={true}
            />
            {architecture.flows && <FlowChart flows={architecture.flows} />}
        </div>
    );
}
```

## Documentation Templates

### Architecture Overview Template

```handlebars
# {{name}}

{{description}}

## Architecture Diagram

{{> architecture-diagram}}

## Components

{{#each nodes}}
### {{name}}
{{description}}

**Type:** {{node-type}}
{{#if data-classification}}**Data Classification:** {{data-classification}}{{/if}}

{{#if interfaces}}
#### Interfaces
{{#each interfaces}}
- **{{unique-id}}**: {{#if url}}{{url}}{{else}}{{host}}:{{port}}{{/if}}
{{/each}}
{{/if}}

{{/each}}

## Flows

{{#each flows}}
### {{description}}

{{#each steps}}
{{@index}}. **{{description}}**
   - Nodes: {{#each node-interactions}}{{node}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}

{{/each}}
```

### Control Documentation Template

```handlebars
# Control Documentation ## Control Requirements

{{#each controls.control-requirements}}
    ###
    {{description}}

    **ID:**
    {{unique-id}}
    **Source:**
    {{source}}

    {{#if metadata}}
        {{#each metadata}}
            {{#each this}}
                - **{{@key}}**:
                {{this}}
            {{/each}}
        {{/each}}
    {{/if}}

{{/each}}

## Control Configurations

{{#each controls.control-configurations}}
    ###
    {{description}}

    **ID:**
    {{unique-id}}
    **Requirements:**
    {{#each requirements}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

    **Implementation:** - **Type:**
    {{implementation.type}}
    {{#each implementation.details}}
        - **{{@key}}:**
        {{this}}
    {{/each}}

{{/each}}
```

## Best Practices

### Documentation Structure

1. **Overview** - High-level architecture purpose and context
2. **Components** - Detailed node documentation
3. **Interfaces** - API and communication specifications
4. **Flows** - Business process documentation
5. **Controls** - Compliance and governance
6. **Deployment** - Infrastructure and operational details

### Automation

- Integrate documentation generation into CI/CD pipelines
- Use architecture validation before generating docs
- Automate deployment of documentation sites
- Version documentation with architecture changes

### Customization

- Create organization-specific templates
- Brand documentation with company styling
- Include additional context and guidelines
- Link to external resources and runbooks

## Output Formats

The calm-widgets framework supports multiple output formats:

- **Static HTML** - Self-contained documentation sites
- **Markdown** - Portable documentation format
- **PDF** - Printable documentation
- **Interactive Web** - Dynamic exploration interfaces

## Validation

Always validate architectures before generating documentation:

```bash
calm validate -a architecture.json --strict
```

This ensures documentation is generated from valid, schema-compliant CALM models.

> **Note:** See **calm-cli-instructions.md** for complete CLI usage, validation modes, and options.
