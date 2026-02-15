
{{#if metadata}}

## Architecture Metadata

{{#each metadata}}
- **{{@key}}:** {{.}}
{{/each}}
{{/if}}

## System Architecutre
{{block-architecture}}

{{#if controls}}
## Architecture-Level Controls

{{#each controls}}
### {{@key}}

{{description}}

#### Requirements
{{#each requirements}}
- **Requirement:** {{requirement-url}}
{{#if config-url}}
- **Config:** {{config-url}}
{{/if}}
{{/each}}

{{/each}}
{{/if}}


## Architecture Statistics

- **Total Nodes:** {{nodes.length}}
- **Total Relationships:** {{relationships.length}}
{{#if flows}}
- **Total Flows:** {{flows.length}}
{{/if}}

## Components by Type

{{#each nodes}}
### {{name}}

**Type:** `{{node-type}}`  
**Unique ID:** `{{unique-id}}`

#### Description
{{description}}


This component exposes the following interfaces:

{{#if interfaces}}
#### Interfaces

This component exposes the following interfaces:

{{#each interfaces}}
- **{{name}}** (`{{unique-id}}`)
  - **Protocol:** {{protocol}}{{#if port}} / **Port:** {{port}}{{/if}}
  - **Description:** {{description}}
  {{#if schema}}
  - **Schema:** {{schema.specification}}
    {{#if schema.operations}}
    - **Operations**
    {{#each schema.operations}}
      {{#if path}}
      - `{{method}} {{path}}` — {{description}}
      {{else}}
      - `{{event}}` ({{direction}}) — {{description}}
      {{/if}}
    {{/each}}
    {{/if}}
  {{/if}}
{{/each}}
{{/if}}

{{#if metadata}}
#### Metadata

{{#each metadata}}
- **{{@key}}:** {{.}}
{{/each}}
{{/if}}

{{#if controls}}
### Controls

This component has the following controls applied:

{{#each controls}}
- **{{@key}}:** {{description}}
{{/each}}
{{/if}}

---

{{/each}}

{{#if flows}}
## Business Flows

This document describes the business processes that traverse the {{name}} architecture.

{{#each flows}}
### {{name}}

**Unique ID:** `{{unique-id}}`

#### Description
{{description}}

{{#if requirement-url}}
**Requirements:** [{{requirement-url}}]({{requirement-url}})
{{/if}}

#### Sequence Diagram

```mermaid
sequenceDiagram
{{#each transitions}}
{{#each ../../relationships}}
{{#if (eq unique-id ../relationship-unique-id)}}
{{#with relationship-type.connects}}
{{#if (eq ../../direction "source-to-destination")}}
    {{source.node}}->>{{destination.node}}: {{../../sequence-number}}. {{../../description}}
{{else if (eq ../../direction "destination-to-source")}}
    {{destination.node}}->>{{source.node}}: {{../../sequence-number}}. {{../../description}}
{{/if}}
{{/with}}
{{#with relationship-type.interacts}}
{{#if (eq ../../direction "source-to-destination")}}
{{#each nodes}}
    {{../actor}}->>{{this}}: {{../../../sequence-number}}. {{../../../description}}
{{/each}}
{{else if (eq ../../direction "destination-to-source")}}
{{#each nodes}}
    {{this}}->>{{../actor}}: {{../../../sequence-number}}. {{../../../description}}
{{/each}}
{{/if}}
{{/with}}
{{/if}}
{{/each}}
{{/each}}
```

#### Flow Steps

{{#each transitions}}
{{sequence-number}}. **{{description}}**
   - **Relationship:** `{{relationship-unique-id}}`
   - **Direction:** {{direction}}
{{/each}}

{{#if metadata}}
#### Flow Metadata
{{#each metadata}}
- **{{@key}}:** {{.}}
{{/each}}
{{/if}}

{{#if controls}}
#### Flow Controls
{{#each controls}}
- **{{@key}}:** {{description}}
{{/each}}
{{/if}}

---

{{/each}}

{{/if}}

