# Developing the CALM DOCS

The [CALM documentation](https://calm.finos.org/) is presented using [Docusaurus](https://docusaurus.io/).  Content is generated from Markdown files within the `docs` directory, starting with `index.md`.

## Running locally

From within the project folder (which contains this developer guide), run these commands to give you a locally-running Docusaurus server:
```bash
npm install
npm run serve -- --build
```
For options such as changing the ports, see the [Docusaurus docs](https://docusaurus.io/docs/cli).

Whilst the server is running, if you run `npm run build` then it'll pick up any changes you've made to the source Markdown files.  You can then simply refresh the browser to view.


## Committing changes

See the main [contributing guide](../README.md#contributing) for details on commit standards, etc.


## Dependency vulnerability scanning

[OSV Scanner](https://google.github.io/osv-scanner/) runs on every pull request and on `main` (`.github/workflows/osv-scanner.yml`). To run the same scan locally, install `osv-scanner` and run this from the repository root:

```bash
osv-scanner scan source --config osv-scanner.toml -L package-lock.json
```

Suppressions go in `osv-scanner.toml`, with a justification. See `SECURITY.md`.

## Search Configuration

The documentation uses [Algolia DocSearch](https://docsearch.algolia.com/) for full-text search.

To configure search locally or for production:
1. Apply for DocSearch at https://docsearch.algolia.com/apply
2. Once approved, Algolia will provide an `appId` and `apiKey`
3. Update `docusaurus.config.js` with these credentials
4. The crawler configuration is managed by Algolia, but runs weekly to index the content
