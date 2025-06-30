# CALM Modeling Rules

1. Every element (node, flow, relationship, control, interface) must have a `unique-id`, `name`, and `description`.
2. Use only properties defined in the CALM release/1.0-rc1 schema.
3. Use `detailed-architecture` on a node to point to a deeper architectural document.
4. Embed controls using valid `control-requirement` schemas and match their required properties.
5. Interfaces must either use a well-defined schema or conform to flat inline interface types (e.g. hostname).
6. Relationships should define `relationship-type` as `connects`, `interacts`, etc., and include `protocol` when appropriate.
7. Metadata is an optional key-value map and should only include relevant non-structural annotations.
8. All flows must reference valid `relationship-unique-id`s and contain at least one `transition`.
9. Avoid redundant or implied links—define structure explicitly.
10. Use consistent casing for IDs and human-readable formatting for names and descriptions.