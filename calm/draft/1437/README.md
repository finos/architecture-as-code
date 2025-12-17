# Draft 1437: Relationship protocol updates

Proposal:
- Make protocol extensible like node-type: allow either a value from the existing enum or any string.
- Remove protocol from the relationship schema properties. Because relationships allow additionalProperties, models that include protocol will still validate.

Rationale:
- Supports emerging protocols (e.g., GraphQL, gRPC) without requiring a schema release.
- Decouples schema from optional field usage; tools can still read protocol if present.

Schema changes (in core.json):
- defs.protocol now uses anyOf: [enum | string].
- defs.relationship no longer declares a protocol property; required remains ["unique-id", "relationship-type"].

Examples (prototype/):
- relationship-example-enum.json: uses an enum value (HTTPS).
- relationship-example-with-string.json: uses a non-enum string (GraphQL).
- relationship-example-no-protocol.json: no protocol field present.

Compatibility:
- No breaking change: existing models with or without protocol continue to validate.

Adoption:
- If accepted, mirror these changes into the next release schema and update downstream tooling that relied on relationship.properties.protocol being declared.