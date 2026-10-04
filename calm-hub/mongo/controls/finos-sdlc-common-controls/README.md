# finos-sdlc-common-controls

The [FINOS SDLC Common Controls Catalog](https://finos.github.io/sdlc-common-controls) as a CALM Hub control domain: one control requirement per
catalog mitigation, 22 in all, generated from the catalog's source at
[748449af280e](https://github.com/finos/sdlc-common-controls/tree/748449af280e50ef1a9fb0d32d369b79f3526e89) (2026-09-30).

Every document declares the catalog's Standard as its `$schema`:

    https://hub.calm.finos.org/calm/namespaces/finos.sdlc-common-controls/standards/sdlc-control-requirement/versions/1.0.0

The Standard (`calm-hub/mongo/standards/finos.sdlc-common-controls/`) is the JSON Schema each document conforms to: identity, summary, phase,
provenance, the risks it mitigates, its requirement statements, its standards references, and the keywords that pin
`control-id` and `name`. This is the Standards and Controls integration described at
https://calm.finos.org/core-concepts/standards/#standards-and-controls-integration: one Standard, many requirement
documents, each cited by architectures through `requirement-url`.

A document is therefore both a readable catalog entry and a JSON Schema that extends CALM's `control-requirement`
meta schema. An architecture that cites a document has its control config validated: `control-id` and `name` are
pinned to the catalog's values and `description` must say how the control is met. Implementation parameters belong
in the pattern an organisation validates its architectures against; the catalog does not prescribe them.

The seed `name` of each control is its slug, so the name-based URL in each document's `$id` resolves once seeded:

    https://hub.calm.finos.org/calm/domains/finos-sdlc-common-controls/controls/<slug>/requirement/versions/1.0.0

| controlId | control-id | name | phase | status |
| --- | --- | --- | --- | --- |
| 19 | SDLC-PREV-001 | Code Review | CODE | Draft |
| 20 | SDLC-PREV-002 | Content Addressable Identities | META | Draft |
| 21 | SDLC-PREV-003 | Software Artifact Provenance | BUILD | Draft |
| 22 | SDLC-PREV-004 | Requirements Repository | LIFECYCLE | Draft |
| 23 | SDLC-PREV-005 | Vulnerability Scanning - SAST | CODE | Draft |
| 24 | SDLC-PREV-006 | Vulnerability Scanning - DAST | RELEASE | Draft |
| 25 | SDLC-PREV-007 | Vulnerability Scanning - Dependencies | BUILD | Draft |
| 26 | SDLC-PREV-008 | Version Control | CODE | First-Reading-Approved |
| 27 | SDLC-PREV-009 | Component Inventory | BUILD | Draft |
| 28 | SDLC-PREV-010 | Secret Detection | CODE | Draft |
| 29 | SDLC-PREV-011 | Vulnerability Remediation SLAs | LIFECYCLE | Draft |
| 30 | SDLC-PREV-012 | Deployment Gating | RELEASE | Draft |
| 31 | SDLC-PREV-013 | System Inventory | LIFECYCLE | Draft |
| 32 | SDLC-PREV-014 | Test Evidence Retention | BUILD | Draft |
| 33 | SDLC-PREV-015 | Testing Requirements | LIFECYCLE | Draft |
| 34 | SDLC-PREV-016 | Test Execution and Sign-Off | BUILD | Draft |
| 35 | SDLC-PREV-017 | Service Dependency Control | RUNTIME | Draft |
| 36 | SDLC-PREV-018 | Dependency Curation |  | Draft |
| 37 | SDLC-PREV-019 | Version Release Approval Gating | RELEASE | Draft |
| 38 | SDLC-PREV-020 | Requirements Approval for Release | RELEASE | Draft |
| 39 | SDLC-PREV-021 | Infrastructure Dependencies | RELEASE | Draft |
| 40 | SDLC-PREV-022 | Data Retention and Disposal | META | Draft |

The documents are generated from the catalog's Jekyll source, one per `docs/_mitigations/*.md` page, and validated
against the Standard before they are committed; the generator belongs with the catalog's tooling, not here. To
refresh, regenerate from a newer catalog revision, replace the files, and bump `controlStoreCounter` in
`calm-hub/mongo/init-mongo.js` if the highest controlId changes.
