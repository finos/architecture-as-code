CALM Schema Change Proposal
Target Schema:
Add a new non-required field to the decorator base schema.

Description of Change:
Include a new optional field target-type which is an array of the allowed targets this can reference:

control
architecture
pattern
standard
This will restrict which targets can be included in the target section, and will be verified when a user tries to put a decorator in CALM Hub.

If the field if not used, then the decorator targets can be anything, but if the decorator schema target-type is just ["patterns"], then all targets in the target section must be patterns.

Use Cases:
For the work in #1908 for deployments; a deployment should only be able to target an architecture. A user should not be able to create and document a deployment which refers to a control or a pattern for example.

Current Limitations:
There is no restriction on what targets a decorator can target, and would need to be done on a case by case basis in CALM Hub.

Proposed Schema Changes:
New optional field on the decorator base schema:

{
  "type": "array",
  "title": "target-type",
  "items": {
    "type": "string",
    "enum": ["architecture", "pattern", "standard", "control"]
  },
  "minItems": 1,
  "uniqueItems": true
}
The deployment decorator standard would be:

{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://calm.finos.org/release/1.2/meta/deployment.decorator.schema.json",
    "title": "CALM Deployment Decorator Schema",
    "allOf": [
        {
            "$ref": "https://calm.finos.org/release/1.2/meta/decorators.json#/defs/decorator"
        },
        {
            "type": "object",
            "properties": {
                "type": { "const": "deployment" },
                "target-type": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "const": "architecture"
                    },
                    "minItems": 1
                },
                "data": {
                    "type": "object",
                    "properties": {
                        "deployment-start-time": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "deployment-status": {
                            "type": "string",
                            "enum": [
                                "in-progress",
                                "failed",
                                "completed",
                                "rolled-back",
                                "pending"
                            ]
                        },
                        "deployment-observability": {
                            "type": "string",
                            "format": "uri"
                        }
                    },
                    "required": [
                        "deployment-start-time",
                        "deployment-status"
                    ],
                    "additionalProperties": true
                }
            },
            "required": ["type", "data"]
        }
    ]
}
An example deployment decorator would look like?

{
    "$schema": "https://calm.finos.org/release/1.2/meta/kubernetes.decorator.schema.json",
    "unique-id": "aks-cluster-deployment-001",
    "type": "deployment",
    "target-type": ["architecture"],
    "target": ["aks-architecture.json"],
    "applies-to": ["aks-cluster"],
    "data": {
        "deployment-start-time": "2026-02-12T09:30:00Z",
        "deployment-status": "completed",
        "deployment-observability": "https://grafana.example.com/d/aks-prod/aks-cluster-overview"
    }
}
Backward Compatibility:
Will existing CALM documents remain valid?
Yes, this is a non-breaking change as it is a new non-required field.

Are there any breaking changes?
There are no breaking changes.

Implementation Impact:
There are currently no tools which refer to decorators.

Version Strategy:
This could be added to 1.2 (as it's a non-breaking change) or can be for a new 1.3 schema.