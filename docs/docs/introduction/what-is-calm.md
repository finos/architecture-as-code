---
id: what-is-calm
title: What is CALM?
sidebar_position: 2
---

# What is CALM?

The Common Architecture Language Model (CALM) is an open-source specification developed by the Architecture as Code (AasC) community under FINOS. CALM provides a standardized, machine-readable, and human-readable format for defining software architectures. By capturing architecture as code, CALM enables a consistent, version-controlled approach that aligns design intent with implementation, fostering better collaboration and automation in software development.

## The Purpose of CALM

CALM was created to address the challenges that arise when software architecture is disconnected from the actual implementation. Traditional approaches often rely on static diagrams, informal notations, or ad hoc documentation, leading to inconsistencies and a lack of traceability. CALM aims to:

- **Standardize Architecture Descriptions**: Provide a common language that architects, developers, and tools can use to describe system architectures consistently.
- **Enable Automation**: Support automated validation, visualization, and compliance checks, integrating architecture into CI/CD workflows.
- **Foster Collaboration**: Create a shared understanding of system designs across teams and stakeholders, reducing miscommunication and errors.

## How CALM Works

CALM structures architecture into three primary components: nodes, relationships, and metadata. This modular approach allows architects to model complex systems flexibly, supporting both high-level overviews and detailed, drill-down architecture.

### 1. **Nodes**

Nodes represent the individual elements of your architecture, such as services, databases, networks, and people. They are the "building blocks" of your system and can be used to model components at various levels of abstraction.

- **Examples of Nodes**: A microservice, a database, a front-end application, or even a person interacting with the system.
- **Properties**: Nodes have key properties such as `unique-id`, `node-type`, `name`, and `description`, which help define their purpose and role within the architecture.

### 2. **Relationships**

Relationships define how nodes interact, connect, or depend on each other. They represent the connections, data flows, and dependencies that exist within the system.

- **Types of Relationships**: Includes direct interactions `interacts`, connections between interfaces `connects`, deployment contexts `deployed-in`, and hierarchical compositions `composed-of`.
- **Properties**: Relationships include properties like unique-id, relationship-type, description, protocol, and authentication to detail the nature of the interaction.

### 3. **Metadata**

Metadata allows architects to capture additional information that provides context or drives specific behaviors in the architecture. This can include compliance tags, custom attributes, or operational data.

- **Flexible and Extensible**: Metadata can be applied to nodes, relationships, or the entire architecture, allowing you to enrich your models with any additional information required by your organization.

## CALM Schema: A JSON Meta Schema

CALM is built on a JSON Meta Schema, which serves as the blueprint for defining architecture. The schema is modular, extensible, and continuously evolving to support new capabilities. Key features of the CALM schema include:

- **JSON-Based**: The use of JSON makes CALM compatible with many existing tools and technologies, facilitating integration into existing workflows.
- **Version Controlled**: CALM’s schema versions are maintained to track changes and improvements, ensuring that your architecture definitions remain up-to-date.
- **Extensible Vocabulary**: CALM’s schema includes a set of predefined terms and structures, but it can be extended to meet the specific needs of different organizations or projects.

## Benefits of CALM

CALM offers several key benefits that make it a powerful tool for modern software architecture:

- **Consistency**: By using a common language and format, CALM ensures that all architecture definitions are consistent, reducing miscommunication and errors.
- **Traceability**: Architectural changes can be tracked and managed just like code, providing a clear history of design decisions and modifications.
- **Automation**: CALM’s integration with CLI tools allows for automated validation, visualization, and compliance checks, streamlining the development process.
- **Integration with CI/CD**: CALM’s code-based approach means that architecture can be validated and tested alongside the software it describes, preventing issues before they reach production.

## Getting Started with CALM

To start using CALM, you can install the CALM CLI and begin exploring its capabilities:

1. **Install the CLI**: Install the CALM CLI using npm with the following command:
   ```shell
   npm install -g @finos/calm-cli
   ```
2. **Explore the CLI Commands**: Use the CLI to generate and validate architectural patterns and architectures.
3. **Join the Community**: Contribute to the CALM monorepo, engage with other architects, and help evolve the standard.

