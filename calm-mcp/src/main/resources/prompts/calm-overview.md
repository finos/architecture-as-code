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

### CALM Resources

This MCP server provides comprehensive CALM resources to help you understand and work with CALM architecture models:

#### **CALM Prompt Resources** (`calm://prompts/*`)
- **`calm://prompts/calm-overview`** - This overview document
- **`calm://prompts/calm-version`** - Version reference for CALM v1.0-rc1
- **`calm://prompts/architecture-examples`** - Complete architecture examples (single-file and multi-file)
- **`calm://prompts/node-examples`** - Node examples (services, databases, systems)
- **`calm://prompts/relationship-examples`** - Relationship examples (connects, interacts, etc.)
- **`calm://prompts/interface-examples`** - Interface examples (Kafka, gRPC, HTTP)
- **`calm://prompts/flow-examples`** - Flow examples showing business processes
- **`calm://prompts/control-examples`** - Control examples for compliance and governance
- **`calm://prompts/metadata-examples`** - Metadata examples for enriching models
- **`calm://prompts/glossary`** - CALM terminology and definitions
- **`calm://prompts/rules`** - CALM modeling rules and best practices

#### **CALM Schema Resources** (`calm://schema/*`)
- **`calm://schema/core`** - Core CALM vocabulary (nodes, relationships, metadata)
- **`calm://schema/calm`** - Main schema combining all vocabularies
- **`calm://schema/control`** - Controls and compliance definitions
- **`calm://schema/control-requirement`** - Control requirements schema
- **`calm://schema/evidence`** - Evidence and audit trail definitions
- **`calm://schema/flow`** - Business process flow definitions
- **`calm://schema/interface`** - Communication interface definitions
- **`calm://schema/units`** - Measurement and unit definitions
- **`calm://schema/release-notes`** - v1.0-rc1 release notes
- **`calm://schema/version-info`** - Schema version and usage information

#### **How to Use These Resources**
1. **For examples and guidance**: Use `calm://prompts/*` resources
2. **For schema validation**: Use `calm://schema/*` resources  
3. **For comprehensive help**: Start with `calm://prompts/calm-overview` and `calm://prompts/glossary`
4. **For specific modeling**: Reference the relevant example resources (nodes, relationships, flows, etc.)

All resources are available through this MCP server and contain the latest CALM v1.0-rc1 specifications and examples.

---

Place this file in `.cody/` and include it in `.cody.json` for full Cody awareness of the domain.
