---
name: calm
description: Model software architecture with FINOS CALM (Common Architecture Language Model). Use when creating, editing, validating or documenting CALM JSON documents - architectures, patterns, timelines, decorators, standards - or their nodes, relationships, interfaces, controls, flows, moments and metadata, and when running the calm CLI (validate, generate, docify, template).
license: Apache-2.0
metadata:
  calm-schema: "1.3"
  source: https://github.com/finos/architecture-as-code/tree/main/calm-ai
---

# FINOS CALM

CALM is a declarative, JSON-based language for describing software architecture, built for regulated
environments such as financial services. A CALM document is validated against the CALM meta schema
and, optionally, against a pattern. The schema is authoritative: when this skill and the schema
disagree, follow the schema.

CALM models:

| Concept | What it is |
|---|---|
| Node | A component: service, database, actor, system, network, webclient, data-asset, ... |
| Interface | How a node is reached: a port, URL, host, or an external interface definition |
| Relationship | A link between nodes: `connects`, `interacts`, `deployed-in`, `composed-of`, `options` |
| Flow | A business process as an ordered sequence of transitions over existing relationships |
| Control | A compliance or governance requirement, applied to the architecture, a node, a relationship or a flow |
| Metadata | Free-form annotation on any element: a single object or an array of objects |
| Pattern | A JSON Schema that constrains an architecture and can generate one |
| Standard | A JSON Schema that extends a CALM component with organisational requirements |
| Timeline | Moments that record how an architecture changes over time |
| Decorator | A standalone document that attaches cross-cutting data to architecture elements |

## Workflow

1. Identify the document and the element the user needs (see the table below).
2. Read the reference file for that element **before** writing JSON. Each reference holds the exact
   schema, an example and the validation rules. Read only the files the task needs.
3. Write the JSON. Reuse the `unique-id` of nodes and relationships that already exist in the file.
4. Validate with the `calm` CLI and fix every error before you report the work as done.

## References

All paths are relative to this file.

| Task | Read |
|---|---|
| Create or restructure an architecture file | `references/architecture.md` |
| Add or change a node | `references/node.md` |
| Add an interface to a node | `references/interface.md` |
| Add or change a relationship | `references/relationship.md` |
| Add metadata at any level | `references/metadata.md` |
| Add a control or compliance requirement | `references/control.md` |
| Model a business flow | `references/flow.md` |
| Write a pattern (`calm generate` input) | `references/pattern.md` |
| Write a standard (JSON Schema extension) | `references/standards.md` |
| Create a timeline | `references/timeline.md` |
| Add a moment to a timeline | `references/moment.md` |
| Create a decorator | `references/decorator.md` |
| Generate documentation from a model | `references/documentation.md` |
| Any `calm` CLI command, option or output format | `references/cli.md` |

## Rules that always apply

- Target schema release 1.3: `"$schema": "https://calm.finos.org/release/1.3/meta/calm.json"`
  (timelines use `calm-timeline.json`, decorators use `decorators.json`).
- File suffixes: `.architecture.json`, `.pattern.json`, `.timeline.json`, `.decorator.json`.
- `unique-id` values are kebab-case and unique within the document.
- An interface is **either** an `interface-definition` (`unique-id`, `definition-url`, `config`, nothing
  else) **or** an `interface-type` (`unique-id` plus any properties). Never mix the two.
- `relationship-type` holds exactly one of `connects`, `interacts`, `deployed-in`, `composed-of`, `options`.
- A relationship description states intent and direction without repeating the node names, for
  example "Reads customer records from".
- A control has a `description` and at least one requirement. Each requirement has a
  `requirement-url` and exactly one of `config` or `config-url`.
- Flow transitions reference relationships that already exist. Flows never create connections.
- Do not invent `definition-url`, `requirement-url` or standard URLs. Ask the user, or use
  `interface-type` and inline `config`.

## Validate

Confirm the CLI is available with `calm --version`. If it is missing, install it with
`npm install -g @finos/calm-cli` and tell the user.

```shell
calm validate -a <file>.architecture.json            # architecture (uses its $schema or pattern)
calm validate -p <file>.pattern.json                 # pattern is a well-formed schema
calm validate -p <pattern> -a <architecture>         # architecture against a pattern
calm validate --timeline <file>.timeline.json        # timeline and its moments
```

The work is done only when the output shows `"hasErrors": false`. Read both
`jsonSchemaValidationOutputs` and `spectralSchemaValidationOutputs`, fix every error, then re-run.
Report any warning you did not fix. Valid JSON is not valid CALM.

## Minimal architecture

```json
{
    "$schema": "https://calm.finos.org/release/1.3/meta/calm.json",
    "unique-id": "example-trading-system",
    "name": "Example Trading System",
    "description": "A simple trading system architecture",
    "nodes": [],
    "relationships": []
}
```
