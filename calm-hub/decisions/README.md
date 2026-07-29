# Architecture Decision Records

This directory holds ADRs for `calm-hub` — decisions about how the backend
itself is built, not to be confused with the CALM **ADR resource type**
(`org.finos.calm.store.AdrStore` etc.), which lets *users* record decisions
about *their own* architectures via the API.

Format: lightweight MADR-style — Status, Context, Decision, Consequences.
`Status` is one of `Proposed`, `Accepted`, `Implemented`, `Superseded by
ADR-000N`. A `Proposed` ADR records a decision that's been made about the
target design before implementation starts — it is not a description of
current behaviour; check the `Status` field before assuming what's written
here is how the code works today.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-versioned-artefact-storage.md) | Versioned artefact storage redesign | Proposed |
| [0002](0002-version-key-encoding.md) | Version field encoding — dots, not dashes | Proposed |
| [0003](0003-shared-version-store-helper.md) | Shared header/version store helper | Proposed |
| [0004](0004-defer-control-and-decorator-storage.md) | Defer Control and Decorator storage redesign | Accepted |
