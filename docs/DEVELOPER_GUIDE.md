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


## OWASP DEPENDENCY-CHECK
The [OWASP dependency check tool](https://jeremylong.github.io/DependencyCheck/) will run on PRs and periodically on the committed code, but it can be helpful to be able to run this locally to investigate CVEs.

To use the dependency check tool locally, first install the tool following the instructions for your operating system [here](https://jeremylong.github.io/DependencyCheck/dependency-check-cli/index.html).

Once that is done the tool is configured as a script in the package.json, run `npm run dependency-check`; the reports will be output to `cli/dependency-check-report`.