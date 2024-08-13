# Developing the CALM DOCS

## OWASP DEPENDENCY-CHECK
The [OWASP dependency check tool](https://jeremylong.github.io/DependencyCheck/) will run on PRs and periodically on the committed code, but it can be helpful to be able to run this locally to investigate CVEs.

To use the dependency check tool locally, first install the tool following the instructions for your operating system [here](https://jeremylong.github.io/DependencyCheck/dependency-check-cli/index.html).

Once that is done the tool is configured as a script in the package.json, run `npm run dependency-check`; the reports will be output to `cli/dependency-check-report`.