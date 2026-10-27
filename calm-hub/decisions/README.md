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
| [0001](0001-versioned-artefact-storage.md) | Versioned artefact storage redesign | Implemented |
| [0002](0002-version-key-encoding.md) | Version field encoding — dots, not dashes | Implemented |
| [0003](0003-shared-version-store-helper.md) | Shared header/version store helper | Implemented |
| [0004](0004-defer-control-and-decorator-storage.md) | Defer Control and Decorator storage redesign | Accepted — fulfilled for Control by 0007; Decorator still deferred |
| [0005](0005-layout-is-hub-internal-not-a-calm-schema.md) | Layout is a Hub-internal shape, not a CALM schema | Implemented |
| [0006](0006-denormalize-adr-title-onto-header.md) | Denormalize ADR title onto the header | Implemented |
| [0007](0007-control-storage-header-version-split.md) | Control storage — header/version split via two composed helper instances | Implemented |
| [0008](0008-pattern-implementations-read-the-architecture-schema.md) | Pattern implementations are found by reading the architecture's `$schema` | Implemented |
| [0009](0009-extensions-run-out-of-process-behind-a-hub-proxy.md) | Extensions run out of process, behind a Hub proxy | Proposed |
| [0010](0010-extension-identity-is-a-hub-signed-assertion.md) | Extension identity is a Hub-signed, request-bound assertion | Proposed |
| [0011](0011-extension-proxy-request-handling.md) | Extension proxy request handling | Proposed |
| [0012](0012-extension-manifest-registry-and-versioning.md) | Extension manifest, registry and versioning | Proposed |
| [0013](0013-extension-ui-is-tiered-with-hub-rendered-blocks-by-default.md) | Extension UI is tiered, with Hub-rendered blocks by default | Proposed |
| [0014](0014-extension-commands-in-the-cli-and-mcp.md) | Extension commands in the CLI and MCP | Proposed |
| [0015](0015-architecture-validation-is-a-hub-feature-behind-an-spi.md) | Architecture validation is a Hub feature behind an SPI, recorded async first | Proposed |
| [0016](0016-store-write-seam-and-outbox-for-post-write-events.md) | Store write seam and outbox for post-write events | Proposed |
