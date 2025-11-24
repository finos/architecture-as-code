# Draft 1437: Relationship protocol updates

Proposal:
- Make protocol free-form (simple string) rather than constrained to a predefined enum.
- Keep the `protocol` property on relationships optional but explicitly referencing the shared definition when present.

Rationale:
- Supports emerging protocols (e.g., GraphQL, gRPC) without requiring a schema release.
- Retains schema guidance for producers/consumers by keeping the `protocol` property defined while still optional.

Schema changes (in core.json):
- defs.protocol is now simply `{ "type": "string" }`.
- defs.relationship continues to declare `protocol` referencing the shared definition; the field remains optional because it is not listed in `required`.

Examples (prototype/):
- relationship-example-enum.json: uses an enum value (HTTPS).
- relationship-example-with-string.json: uses a non-enum string (GraphQL).
- relationship-example-no-protocol.json: no protocol field present.

Compatibility:
- No breaking change: existing models with or without protocol continue to validate.

Adoption:
- If accepted, mirror these changes into the next release schema and update downstream tooling to treat protocol as an optional free-form string.
