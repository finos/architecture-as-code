# What is CALM?

**CALM** stands for **Common Architecture Language Model**.

It is a declarative, JSON-based modeling language used to describe complex systems, particularly in regulated environments (e.g., financial services, cloud architectures).

CALM enables you to model:

- **Nodes** – components like services, databases, user interfaces
- **Interfaces** – how components communicate using schemas
- **Relationships** – structural or behavioral links between components
- **Flows** – business-level processes traversing your architecture
- **Controls** – compliance policies and enforcement mechanisms
- **Metadata** – supplemental, non-structural annotations

### Key Features

- Each model is versioned and validated using JSON Schema (e.g., `release/1.0-rc1`)
- Supports modular composition using `detailed-architecture` on nodes
- Promotes traceable, explainable architecture definitions
- Integrates with compliance artifacts (e.g., control requirements and configurations)

### Use Case Example

A single CALM model may define a system with:
- A **web frontend** (node) that calls an **API** (relationship) which stores data in a **database** (another node),
- Protected by controls like **access policy enforcement** or **permitted connection validation**,
- With a **flow** describing how user actions propagate through the system.

For more, see: [https://calm.finos.org](https://calm.finos.org)

---

Place this file in `.cody/` and include it in `.cody.json` for full Cody awareness of the domain.
