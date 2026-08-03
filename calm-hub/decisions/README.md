# Architecture Decision Records

This directory holds ADRs for `calm-hub` — decisions about how the backend
itself is built, not to be confused with the CALM **ADR resource type**
(`org.finos.calm.store.AdrStore` etc.), which lets *users* record decisions
about *their own* architectures via the API.

Format: lightweight MADR-style — Status, Context, Decision, Consequences.
`Status` is one of `Proposed`, `Accepted`, `Implemented`, `Superseded by
ADR-000N`.

**Only `Implemented` means the code works this way today.** `Proposed` and
`Accepted` both describe a target design: `Proposed` is still up for debate,
`Accepted` has been agreed but may not be built yet. Check the `Status` line —
it also carries a note on how much of the ADR has actually landed — before
assuming anything here reflects current behaviour.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-versioned-artefact-storage.md) | Versioned artefact storage redesign | Accepted — partially implemented (Architecture only) |
| [0002](0002-version-key-encoding.md) | Version field encoding — dots, not dashes | Accepted — partially implemented (Architecture only) |
| [0003](0003-shared-version-store-helper.md) | Shared header/version store helper | Accepted — partially implemented (Architecture only) |
| [0004](0004-defer-control-and-decorator-storage.md) | Defer Control and Decorator storage redesign | Accepted (no code of its own) |

0001–0003 become `Implemented` when all seven versioned types have moved,
not when the first one has.
