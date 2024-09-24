---
id: why-use-calm
title: Why Use CALM?
sidebar_position: 3
---

# Why Use CALM?

Software architecture often suffers from disconnection between design and implementation. Traditional approaches, such as whiteboard sketches or static diagrams in tools like Visio, lack standardization, version control, and validation, making it difficult to ensure that what is designed is what is built. CALM (Common Architecture Language Model) addresses these issues by bringing architecture into the world of code—structured, consistent, and automated.

## The Challenges of Traditional Architecture

Traditional methods of defining architecture often involve informal, visual representations that can be:

- **Inconsistent**: Designs are often undocumented or maintained in siloed tools, leading to misinterpretation and deviation from the intended architecture.
- **Difficult to Maintain**: Static diagrams can quickly become outdated as the system evolves, and keeping them in sync with the actual implementation is a manual, error-prone process.
- **Lack of Automation**: Without a standardized, machine-readable format, automating architecture validation, compliance checks, or impact analysis is nearly impossible.
- **Disconnected from Code**: Architecture is often treated separately from the actual code, leading to mismatches between design intent and what is actually deployed.

## CALM: A Solution for Modern Architecture

CALM aims to address these challenges by defining architecture as code using a standardized, version-controlled, and machine-readable format. Here’s how CALM helps:

### 1. **Standardization and Consistency**

CALM provides a standardized language for defining software architectures, making it easier for teams to communicate and maintain a shared understanding of the system. By capturing architecture as JSON schemas, CALM ensures:

- **Uniformity**: All architectural definitions follow a common structure, reducing ambiguity and miscommunication.
- **Reusability**: Architectural patterns can be reused across projects, ensuring consistency and speeding up the design process.

### 2. **Version Control and Change Management**

By defining architecture as code, CALM allows you to manage your architectural designs using the same version control tools (e.g., Git) that you use for your software codebase. This approach provides:

- **Traceability**: Track changes to the architecture over time, understanding who made what changes and why.
- **Collaboration**: Multiple team members can work on architectural designs simultaneously, merging their contributions through familiar workflows.

### 3. **Automation and Validation**

One of CALM’s key strengths is its ability to automate the validation of architectural designs against predefined patterns. This helps ensure that your system adheres to best practices and organizational standards:

- **Pattern-Based Validation**: Use CALM CLI to validate architectural instantiations, catching issues early in the design phase.
- **CI/CD Integration**: Incorporate architectural validation into your CI/CD pipelines, automatically checking compliance and preventing deviations from approved designs.

### 4. **Visualization and Communication**

CALM's built-in visualization capabilities allow you to generate diagrams directly from your architecture definitions, ensuring that visual representations are always accurate and up-to-date:

- **Instant Diagrams**: Use the `visualize` command in CALM CLI to create SVG diagrams that reflect the current state of your architecture.
- **Improved Communication**: Share visual representations that accurately reflect your design, helping to communicate intent to stakeholders more effectively.

### 5. **Control and Compliance**

CALM makes it easier to enforce architectural standards and policies across your organization, reducing the burden of manual reviews and ensuring compliance with internal and external regulations:

- **Enforce Standards**: Define and validate architectural rules, ensuring that designs comply with established guidelines.
- **Automated Compliance Checks**: Use metadata and controls within CALM to capture security, compliance, and operational requirements directly in your architecture.

## Conclusion

By bringing architecture into the domain of code, CALM bridges the gap between design and implementation, providing a consistent, automated, and controlled approach to managing software architecture. Whether you are designing a simple application or a complex enterprise system, CALM equips you with the tools to ensure that what you intend to build is what you actually deploy.
