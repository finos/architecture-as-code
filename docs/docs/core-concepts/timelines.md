---
id: timelines
title: Timelines
sidebar_position: 6
---

# Timelines in CALM

:::info Schema Version
Timelines were introduced in **CALM schema version 1.2**. To use timelines, include the following schema reference in your timeline document:

```json
"$schema": "https://calm.finos.org/release/1.2/meta/calm-timeline.json"
```
:::

Timelines in CALM provide a powerful way to document how your architecture evolves over time. They capture significant moments in your architecture's history, allowing you to track changes, understand the current state, and reference past or future architectural states.

## What is a Timeline?

A timeline is a collection of "moments"—snapshots of your architecture at specific points in time. Each moment represents a significant architectural state, whether it's the initial design, a major refactoring, the addition of new components, or planned future changes. This temporal view helps teams understand not just what the architecture looks like now, but how it got there and where it's headed.

### Why Use Timelines?

Timelines serve several important purposes:

- **Historical Record**: Document how your architecture has evolved, capturing the reasoning behind major changes.
- **Change Management**: Track architectural changes systematically, making it easier to understand the impact of modifications.
- **Future Planning**: Model planned architectural changes, helping teams visualize and prepare for upcoming transformations.
- **Compliance & Audit**: Maintain a clear record of architectural states for regulatory requirements or internal audits.
- **Knowledge Transfer**: Help new team members understand the architectural journey and decision-making process.

## Key Properties of Timelines

A timeline document has the following key properties:

- **current-moment**: A string that references the `unique-id` of the moment representing the current state of the architecture.
- **moments**: An array of moment objects, each representing a significant architectural state.
- **metadata**: Optional metadata providing context about the timeline itself, such as title, description, owner, and creation date.

## Moments: The Building Blocks of Timelines

Each moment in a timeline is a specialized node with the following properties:

- **unique-id**: A mandatory string that uniquely identifies this moment within the timeline.
- **node-type**: Must be set to "moment" for timeline entries.
- **name**: A human-readable name for this architectural state.
- **description**: A brief explanation of what this moment represents or what changed.
- **valid-from**: Optional date (in YYYY-MM-DD format) when this architectural state came into effect.
- **details**: Required; Contains references to the detailed architecture:
  - **detailed-architecture**: A reference (URL or file path) to the full CALM architecture document for this moment.
  - **required-pattern**: Optional; the pattern that this architecture must conform to.
- **adrs**: Optional array of strings containing links to Architecture Decision Records (ADRs) or similar documents that explain why the architecture changed.

### Example of a Timeline Definition

Here's a complete example of a timeline tracking the evolution of a system:

```json
{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm-timeline.json",
  "current-moment": "v3-microservices",
  "moments": [
    {
      "unique-id": "v1-monolith",
      "node-type": "moment",
      "name": "Initial Monolithic Architecture",
      "description": "The original monolithic application serving all functionality",
      "valid-from": "2020-01-15",
      "details": {
        "detailed-architecture": "architectures/v1-monolith.json"
      },
      "adrs": [
        "https://github.com/org/repo/blob/main/docs/adr/001-initial-architecture.md"
      ]
    },
    {
      "unique-id": "v2-separated-db",
      "node-type": "moment",
      "name": "Database Separation",
      "description": "Separated the database into dedicated instances for improved scalability",
      "valid-from": "2022-06-20",
      "details": {
        "detailed-architecture": "architectures/v2-separated-db.json"
      },
      "adrs": [
        "https://github.com/org/repo/blob/main/docs/adr/005-database-separation.md"
      ]
    },
    {
      "unique-id": "v3-microservices",
      "node-type": "moment",
      "name": "Microservices Architecture",
      "description": "Decomposed the monolith into domain-driven microservices with API gateway",
      "valid-from": "2025-03-10",
      "details": {
        "detailed-architecture": "architectures/v3-microservices.json",
        "required-pattern": "patterns/microservices-pattern.json"
      },
      "adrs": [
        "https://github.com/org/repo/blob/main/docs/adr/012-microservices-migration.md",
        "https://github.com/org/repo/blob/main/docs/adr/013-api-gateway-selection.md"
      ]
    },
    {
      "unique-id": "v4-event-driven",
      "node-type": "moment",
      "name": "Event-Driven Architecture (Planned)",
      "description": "Planned introduction of event-driven patterns with message broker for asynchronous communication",
      "details": {
        "detailed-architecture": "architectures/v4-event-driven.json",
        "required-pattern": "patterns/event-driven-pattern.json"
      },
      "adrs": [
        "https://github.com/org/repo/blob/main/docs/adr/020-event-driven-proposal.md"
      ]
    }
  ],
  "metadata": {
    "title": "Payment System Architecture Timeline",
    "description": "Evolution of the payment processing system from monolith to event-driven microservices",
    "owner": "Platform Architecture Team",
    "created": "2023-11-01",
    "updated": "2025-09-15"
  }
}
```

## Using Timelines Effectively

### Document Significant Changes

Focus on capturing moments that represent meaningful architectural changes, not every minor modification. Good candidates for moments include:

- Initial architecture design
- Major refactorings or decompositions
- Introduction of new architectural patterns
- Significant technology migrations
- Compliance-driven architectural changes
- Planned future states

### Link to Detailed Architectures

Each moment should reference a complete CALM architecture document via the `detailed-architecture` property. This allows tools and teams to explore the full architecture at any point in time.

### Capture Decision Context with ADRs

Use the `adrs` property to link to Architecture Decision Records or similar documentation. This provides crucial context about why architectural changes were made, helping future teams understand the reasoning behind decisions.

### Use Dates to Track Timeline

The `valid-from` property helps establish a clear timeline for historical and current moments. Use ISO date format (YYYY-MM-DD) to indicate when each architectural state became active. Planned future moments (those after the `current-moment`) must omit `valid-from`, as they represent intended future states rather than states that are already in effect.

### Model Future States

Timelines aren't just for historical tracking—use them to model planned architectural changes. Future moments do not have `valid-from` until they become current or historical states. This helps teams visualize the target state and plan migration strategies while keeping validation rules satisfied.

### Keep Current Moment Updated

Always ensure the `current-moment` property references the actual current state of your architecture. This provides a clear indicator of "where we are now" in the architectural journey.

## Validating Timelines

Validation ensures that your timeline document conforms to the CALM timeline schema and follows best practices. The CALM CLI provides comprehensive validation capabilities for timelines.

### Using the CLI to Validate

To validate a timeline document, use the `validate` command with the `--timeline` option:

```bash
calm validate --timeline path/to/timeline.json
```

### What Gets Validated

Timeline validation checks multiple aspects of your document:

#### 1. JSON Schema Validation

The validator ensures your timeline conforms to the CALM timeline schema, checking:

- Required properties are present (e.g., `moments` array)
- `node-type` is set to "moment" for each moment
- `unique-id` values are strings and unique within the timeline
- `valid-from` dates follow the correct format (YYYY-MM-DD)
- `details.detailed-architecture` is present for each moment
- Data types match the schema (strings, arrays, objects)

#### 2. Spectral Rules Validation

In addition to schema validation, CALM applies custom validation rules:

- **Current Moment Reference**: The `current-moment` must reference an existing moment's `unique-id`
- **Future Moment Dates**: Moments after the current moment should not have `valid-from` dates (they represent planned future states)
- **Chronological Order**: Moments with `valid-from` dates should be in chronological order
- **Date Format**: All dates must be valid ISO dates (YYYY-MM-DD)

