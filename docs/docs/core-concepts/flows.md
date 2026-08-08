---
id: flows
title: Flows
sidebar_position: 6
---

# Flows in CALM

Flows in CALM describe business processes as they move through your technical architecture. Where nodes and relationships capture what the architecture is, a flow captures how a business capability is realised by traversing those relationships in a defined order. This connects business intent to the concrete components and connections that implement it.

## What is a Flow?

A flow is an ordered sequence of transitions, each of which references an existing relationship in the architecture. By walking the transitions in sequence, a flow traces a single business process, for example a customer placing an order, or an admin checking stock levels, across the nodes and relationships that carry it.

Because transitions reference relationships by `unique-id` rather than redefining connections, flows stay in sync with the architecture: they reuse the same relationships that already exist between nodes.

### Why Use Flows?

Flows serve several purposes:

- Business-to-technical traceability: Show how a business capability maps onto real components and connections.
- Impact analysis: Answer questions like "which services participate in my order flow?"
- Documentation: Generate sequence diagrams that describe a process step by step.
- Compliance: Attach control requirements to a specific process rather than to the whole architecture.

## Key Properties of Flows

A flow has the following properties:

- `unique-id`: A mandatory identifier that uniquely defines the flow within the architecture.
- `name`: A mandatory, human-readable name for the business process.
- `description`: A mandatory description of the flow's purpose.
- `transitions`: A mandatory, ordered array of at least one transition (see below).
- `requirement-url`: Optional link to a detailed requirement document.
- `controls`: Optional controls that apply to the flow, such as audit or logging requirements.
- `metadata`: Optional additional information attached to the flow.

### Transitions: The Steps of a Flow

Each transition describes one step of the process and has the following properties:

- `relationship-unique-id`: A mandatory reference to the `unique-id` of a relationship in the architecture that this step uses.
- `sequence-number`: A mandatory integer indicating the order of this step within the flow (1, 2, 3…).
- `description`: A mandatory functional summary of what happens in this step.
- `direction`: Optional. Either `source-to-destination` (default) or `destination-to-source`, indicating which way the interaction travels along the referenced relationship.

The same relationship can appear more than once in a flow with different directions, which is how request-and-response patterns are modelled.

## Example of a Flow Definition

Flows are defined in a top-level `flows` array in an architecture document, alongside `nodes` and `relationships`:

```json
{
  "flows": [
    {
      "unique-id": "order-processing-flow",
      "name": "Customer Order Processing",
      "description": "End-to-end flow from a customer placing an order to payment confirmation.",
      "transitions": [
        {
          "relationship-unique-id": "customer-to-gateway",
          "sequence-number": 1,
          "description": "Customer submits order via the web interface",
          "direction": "source-to-destination"
        },
        {
          "relationship-unique-id": "gateway-to-order-service",
          "sequence-number": 2,
          "description": "API Gateway routes the order to the Order Service",
          "direction": "source-to-destination"
        },
        {
          "relationship-unique-id": "order-service-to-payment-service",
          "sequence-number": 3,
          "description": "Order Service initiates payment processing",
          "direction": "source-to-destination"
        }
      ]
    }
  ]
}
```

### Modelling Request and Response

To model a response travelling back along the same connection, reuse the relationship with the opposite direction:

```json
{ "relationship-unique-id": "svc-to-db", "sequence-number": 3, "description": "Query current stock levels", "direction": "source-to-destination" },
{ "relationship-unique-id": "svc-to-db", "sequence-number": 4, "description": "Return stock data", "direction": "destination-to-source" }
```

## Using Flows Effectively

- Trace complete business capabilities: Use a flow to capture an end-to-end process rather than a single interaction.
- Reference real relationships: Each transition must point at a relationship that already exists in the architecture, keeping business and technical views consistent.
- Sequence carefully: `sequence-number` defines the order steps are rendered and reasoned about, including in sequence diagrams.
- Attach controls where they belong: Use flow-level `controls` to express requirements that apply to the process as a whole, such as audit logging.

## Visualising Flows

Flows appear in the CALM Model Elements view in the VS Code extension. Selecting a flow renders a sequence diagram showing its transitions in order, making it easy to communicate how a process moves through the architecture.

## Validating Flows

Flows are validated as part of an architecture document. Use the `validate` command:

```bash
calm validate -a path/to/architecture.json
```

Validation checks that each flow has a `unique-id`, `name`, `description`, and at least one transition, and that every transition has a `relationship-unique-id`, `sequence-number`, and `description`.

Beyond JSON Schema, CALM enforces two additional hard-error rules specific to flows:

- **`flow-transitions-references-existing-relationship-in-architecture`**: every `relationship-unique-id` in a transition must match an existing relationship in the architecture. A dangling reference is a hard error. This is the enforcement behind the "keeping business and technical views consistent" guarantee: you cannot describe a process step that points at a connection that does not exist.
- **`flow-transitions-have-unique-sequence-numbers`**: sequence numbers within a single flow must be unique. Duplicate numbers make the ordering of steps ambiguous and are rejected as a hard error.

## Related

- [Relationships](relationships): The connections that transitions reference.
- [Controls](controls): How to attach requirements, which can also be applied at the flow level.
- Tutorial: [Model Business Flows](../tutorials/intermediate/09-business-flows) walks through building flows step by step.
