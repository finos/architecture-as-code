# CALM Schema v1.0 Release Notes

CALM v1.0 is the first stable, production-ready version of the Common Architecture Language Model, based on community agreement of the v1.0-rc2 candidate. This release provides a clean, extensible schema for architecture modeling and documentation.

## Core Schema Concepts

**Nodes** - Architecture components (systems, services, databases) with properties, interfaces, and deployments; 

**Relationships** - Connections between nodes (`interacts`, `connects`, `deployed-in`, `composed-of`) and how they interact.

**Flows** - Business flows with transitions that reference relationships by sequence number, mapping flows to technical components with control requirements

**Controls** - Security and compliance requirements with domain-based organization; simplified property names (`requirement-url`, `config-url`, `config`) for better readability

**Interfaces** - Modular interface definitions using external schemas (`interface-definition`) or flexible interface types (`interface-type`); 

**Metadata** - Flexible metadata support accepting either single objects or arrays, providing extensible annotation capabilities across all schema elements

## Question and Feedback

For questions or feedback, please engage with the CALM community through the appropriate channels.