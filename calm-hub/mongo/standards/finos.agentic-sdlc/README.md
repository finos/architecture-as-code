# finos.agentic-sdlc Standards

Two [CALM Standards](https://calm.finos.org/core-concepts/standards/) for the Agentic SDLC Blueprint, a reference
implementation of a governed agentic software delivery loop: a small trade capture estate modelled in CALM whose
pipeline gates read the model to check what a coding agent changed. They are the organisation-level extensions the
docs describe, applied to every node by the pattern in `../../patterns/finos.agentic-sdlc/`.

| Standard | Extends | Requires |
| --- | --- | --- |
| `governed-node` | the CALM node | on services and databases, the SDLC-PREV-013 inventory metadata the review policy reads (criticality tier, data classification); on services, `source-path`, where the code lives; every interface conforms to `env-binding-interface` |
| `env-binding-interface` | the CALM interface | `env-binding`, the environment variable code binds to, so a dependency scanner can map code to the model |

The parameters the estate's gates read for each SDLC control live in the pattern, not here: the catalog's
documents (domain `finos-sdlc-common-controls`) say what each control is, and the pattern says what this estate
requires of it.

Seeded through the name-based API by `calm-hub/nitrite/init-nitrite.sh` (`create_namespace_standards`), so each
`$id` resolves on the hub.
