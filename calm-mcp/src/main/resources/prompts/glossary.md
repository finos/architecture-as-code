# CALM Glossary

- **Node**: A logical or physical element in the system (e.g., service, database, system).
  - **detailed-architecture**: A pointer on a node to a separate CALM file that contains more specific substructure.
- **Interface**: A defined access point for communication, ths is how functional capabilities of nodes are defined.
- **Relationship**: A structural or behavioral connection between nodes.
- **Flow**: A business-level sequence of transitions over architecture relationships.
- **Control**: A way to link non-functional requirements sych as security, observability and performance requirements to nodes, relationships or entire architectures.
  - **control-requirement**: A JSON Schema defining how a control must be configured.
  - **control-configuration**: The implementation of a control as defined by the requirement.
- **Metadata**: Key-value pairs used to enrich any CALM element with additional, non-structural context.
