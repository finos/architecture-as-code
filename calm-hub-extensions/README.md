# CALM Hub extensions

The [CALM Hub extensions](../docs/docs/calm-hub/index.md#extensions) that the CALM project owns. Each
one is an HTTP service that runs next to CALM Hub, and each one is a worked example for extension authors.
To install one, see [Install an extension](../docs/docs/extensions/install.md) and the
[Extensions page](https://calm.finos.org/extensions) of the docs site.

| Extension | What it adds |
|---|---|
| [`c4`](c4) | The C4 lens on the Diagram tab: context, container, component and deployment diagrams in a Structurizr-style notation |
| [`ea-layers`](ea-layers) | The Layers lens on the Diagram tab: business, application and technology layers in the ArchiMate® notation |

## Layout

Each extension has its own folder, and the folder name is the manifest `id`. So you can copy the folder,
or mount it, into `calm.extensions.dir` with no change.

```text
calm-hub-extensions/<id>/
├── extension.json   # the manifest
├── notation.json    # for a diagram lens: the shapes and styles
├── src/             # the service
├── Dockerfile       # build from the repository root
└── README.md        # what it does, its settings, how to run it
```

Rules for a new extension:

- Make it an npm workspace in the root `package.json`, after `calm-hub-ui`. Use a private package named
  `@finos/calm-hub-<id>`.
- Add its id to the matrix of `.github/workflows/build-calm-hub-extensions.yml`.
- Add a case to `TestExtensionManifestLoaderShould` that loads the folder, so a manifest or notation that
  CALM Hub refuses fails the Java tests.
- Add it to the table above.

ArchiMate is a registered trademark of The Open Group in the United States and other countries.

Extensions that are not here:

| Where | What |
|---|---|
| `calm-hub/src/main/resources/META-INF/calm-extensions/builtin/` | The built-in decorator views. They have no service and ship in the CALM Hub jar |
| `calm-hub/local-dev/extensions/example-services` | A small fixture backend for local development |
| `calm-hub/local-dev/demo-extensions/release-tracker` | A demo that uses every UI extension point, to test the UI layout |
