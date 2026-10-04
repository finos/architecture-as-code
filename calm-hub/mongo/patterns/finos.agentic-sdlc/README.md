# finos.agentic-sdlc patterns

`governed-service`: how the Agentic SDLC Blueprint, a reference implementation of a governed agentic software
delivery loop, enforces the FINOS SDLC Common Controls on its estate. The pattern requires the four system-level
controls, pins each to its control requirement document in the `finos-sdlc-common-controls` domain
(`../../controls/finos-sdlc-common-controls/`), defines the parameters the estate's pipeline gates read (review
routing rules, the requirements repository, the blocking gates, what evidence binds to, the allowed sources of a
dependency), and applies the `governed-node` Standard
(`../../standards/finos.agentic-sdlc/`) to every node. Standards say what a node, an interface or a control
requirement looks like; the pattern says which of them an architecture must satisfy. This is how Standards and
patterns work together to let an organisation enforce controls.

Seeded through the name-based API by `calm-hub/nitrite/init-nitrite.sh` (`create_namespace_patterns`), so the
`$id` resolves on the hub:

    https://hub.calm.finos.org/calm/namespaces/finos.agentic-sdlc/patterns/governed-service/versions/1.0.0
