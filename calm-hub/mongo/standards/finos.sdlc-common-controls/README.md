# finos.sdlc-common-controls Standards

One [CALM Standard](https://calm.finos.org/core-concepts/standards/), `sdlc-control-requirement`: the JSON Schema
every control requirement document of the [FINOS SDLC Common Controls Catalog](https://finos.github.io/sdlc-common-controls/)
conforms to. The 22 documents in the `finos-sdlc-common-controls` control domain
(`../../controls/finos-sdlc-common-controls/`) declare it as their `$schema`.

This is the integration described under
[Standards and Controls Integration](https://calm.finos.org/core-concepts/standards/#standards-and-controls-integration):
a Standard defines the consistent structure of a family of control requirements, each requirement document uses it
as its JSON Schema base, and architectures cite the documents through `requirement-url`. The CALM CLI validates a
cited document against this Standard before it validates the architecture's control config against the document, so
a document that drifts from the catalog's shape fails validation, and a config that names the wrong `control-id`
fails too.

The Standard and the documents are maintained together: a document that stops conforming fails `calm validate`
for any architecture that cites it, so change the Standard only together with the documents.

Seeded through the name-based API by `calm-hub/nitrite/init-nitrite.sh` (`create_namespace_standards`), so the
`$id` resolves on the hub:

    https://hub.calm.finos.org/calm/namespaces/finos.sdlc-common-controls/standards/sdlc-control-requirement/versions/1.0.0
