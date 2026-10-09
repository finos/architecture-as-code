# Architecture Decision Records

This directory holds ADRs for `calm-hub` — decisions about how the backend
itself is built, not to be confused with the CALM **ADR resource type**
(`org.finos.calm.store.AdrStore` etc.), which lets *users* record decisions
about *their own* architectures via the API.

Format: lightweight MADR-style — Status, Context, Decision, Consequences.
`Status` is one of `Proposed`, `Accepted`, `Implemented`, `Superseded by
ADR-000N`, or a combination where one alone would mislead.

**Only `Implemented` means the code works this way today.** `Proposed` and
`Accepted` both describe a target design: `Proposed` is still up for debate,
`Accepted` has been agreed but may not be built yet. Check the `Status` line —
it also carries a note on how much of the ADR has actually landed — before
assuming anything here reflects current behaviour.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-versioned-artefact-storage.md) | Versioned artefact storage redesign | Implemented |
| [0002](0002-version-key-encoding.md) | Version field encoding — dots, not dashes | Implemented |
| [0003](0003-shared-version-store-helper.md) | Shared header/version store helper | Implemented |
| [0004](0004-defer-control-and-decorator-storage.md) | Defer Control and Decorator storage redesign | Accepted — fulfilled for Control by 0007; Decorator still deferred |
| [0005](0005-layout-is-hub-internal-not-a-calm-schema.md) | Layout is a Hub-internal shape, not a CALM schema | Implemented |
| [0006](0006-denormalize-adr-title-onto-header.md) | Denormalize ADR title onto the header | Implemented |
| [0007](0007-control-storage-header-version-split.md) | Control storage — header/version split via two composed helper instances | Implemented |
| [0008](0008-pattern-implementations-read-the-architecture-schema.md) | Pattern implementations are found by reading the architecture's `$schema` | Proposed and Implemented — built, but the approach is not yet agreed |

0001–0003 cover the seven *versioned* resource types; 0007 brings Control
onto the same shape via two composed instances of the same helper. Decorator
alone keeps the one-document-per-namespace shape by decision, not by
omission — see 0004, which is still open with respect to Decorator only.

0008 is the first ADR that changes no storage shape. It adds a read over the
shape 0001 established. It records why the hub resolves the link from a pattern
to its architectures when the request runs, instead of storing that link.
