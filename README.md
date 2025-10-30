[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/8821/badge)](https://www.bestpractices.dev/projects/8821)
[![CodeQL](https://github.com/finos/architecture-as-code/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/github-code-scanning/codeql)
[![CVE Scanning for Maven](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-maven.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-maven.yml)
[![CVE Scanning for Node.js](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-node.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-node.yml)
[![License Scanning for Maven](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-maven.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-maven.yml)
[![License Scanning for Node.js](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-node.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-node.yml)

![FINOS Common Architecture Language Model](https://raw.githubusercontent.com/finos/architecture-as-code/main/brand/Horizontal/2025_CALM_Horizontal.png)

# Architecture as Code

**Architecture as Code (AasC)** aims to devise and manage software architecture via a human and machine readable and
version-controlled
codebase, fostering a robust understanding, efficient development, and seamless maintenance of complex software
architectures.

This repository contains the Common Architecture Language Model (CALM) Specification, as well as capabilities being
built to utilize the specification. This page lists the domains and capabilities being built by the official AasC community.

Whilst others are welcome to build their own capabilities, away from the AasC monorepo, we encourage you to join the
community and contribute your projects to the AasC monorepo which has the benefits of being visible to the whole
community; thereby attracting contributions and ensuring that changes to the manifest will be proactively built against
your project.

Ready to get started? Read the [CALM quickstart guide](https://calm.finos.org/quick-start/).

## Projects

| Project                                                                                        | Lead Maintainers                                                                                                                                                                                                                     | Builds                                                                                                                                                                                                                                                                                                                                                                                      |
|------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Common Architecture Language Model](./calm)                                                   | [@rocketstack-matt](https://github.com/rocketstack-matt), [@jpgough-ms](https://github.com/jpgough-ms)                                                                                                                               | [![Validation of CALM Samples](https://github.com/finos/architecture-as-code/actions/workflows/validate-spectral.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/validate-spectral.yml)                                                                                                                                                                     |
| [CLI](./cli), [Shared](./shared), [Models](./calm-models) & [Widget Framework](./calm-widgets) | [@aidanm3341](https://github.com/aidanm3341), [@lbulanti-ms](https://github.com/lbulanti-ms), [@willosborne](https://github.com/willosborne), [@Thels](https://github.com/Thels), [@LeighFinegold](https://github.com/LeighFinegold) | [![Build CLI](https://github.com/finos/architecture-as-code/actions/workflows/build-cli.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-cli.yml)                                                                                                                                                                                                      |
| [CALM AI](./calm-ai)                                                                           | [@rocketstack-matt](https://github.com/rocketstack-matt)                                                                                                                                                                             | No build, prompt tools only, managed separately to CLI for easier maintenance and broader reuse.                                                                                                                                                                                                                                                                                            |
| [CALM Hub](./calm-hub)                                                                         | [@jpgough-ms](https://github.com/jpgough-ms), [@grahampacker-ms](https://github.com/grahampacker-ms)                                                                                                                                                                                       | [![Build Calm Hub](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub.yml)                                                                                                                                                                                       |
| [CALM Hub UI](./calm-hub-ui)                                                                   | [@oliviajanejohns](https://github.com/oliviajanejohns), [@aidanm3341](https://github.com/aidanm3341), [@aamanrebello](https://github.com/aamanrebello), [@yoofitt96](https://github.com/YoofiTT96)                                   | [![Build CALM Hub UI](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub-ui.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-hub-ui.yml)                                                                                                                                                                              |
| [Docs](./docs)                                                                                 | [@rocketstack-matt](https://github.com/rocketstack-matt)                                                                                                                                                                             | [![Sync Docs to S3](https://github.com/finos/architecture-as-code/actions/workflows/s3-docs-sync.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/s3-docs-sync.yml) [![Build Docs](https://github.com/finos/architecture-as-code/actions/workflows/build-docs.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-docs.yml) |
| [CALM VSCode Plugin](./calm-plugins/vscode)                                                    | [@LeighFinegold](https://github.com/LeighFinegold), [@rocketstack-matt](https://github.com/rocketstack-matt)                                                                                                                         | ![Build VS Code Extension](https://github.com/finos/architecture-as-code/workflows/Build%20VS%20Code%20Extension/badge.svg)                                                                                                                                                                                                                                                                 |
| [CALM Visualizer](./calm-visualizer)                                                           | [@pmerrison](https://github.com/pmerrison)                                                                                                                                                                                           | [![Build CALM Visualizer](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-visualizer.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/build-calm-visualizer.yml)                                                                                                                                                                  |

## Getting Involved

Architecture as Code was developed as part of the [DevOps Automation Special Interest Group](https://devops.finos.org/) before graduating as a top level project in it's own right. Our community Zoom meetups
take place on the fourth Tuesday of every month,
see [here](https://github.com/finos/architecture-as-code/issues?q=label%3Ameeting) for
upcoming and previous meetings. For active contributors we have Office Hours every Thursday, see the [FINOS Event Calendar](http://calendar.finos.org) for meeting details.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose) in this
repository.

## Contributing

Architecture as Code operates as a monorepo, in here you will find both the CALM JSON Schema and the various projects
that are being built to utilize the CALM specification.

We accept contributions via Pull Request, to make a contribution:

1. Pick an issue you are interested in contributing to (or raise one yourself) and speak to the lead maintainers about what you plan to do either in the issue itself or come to a meetup. [Some issues](https://github.com/finos/architecture-as-code/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are suggested for first time contributors.
2. Fork the repo (<https://github.com/finos/architecture-as-code/fork>)
3. Create your feature branch (`git checkout -b feature/fooBar`)
4. Read our [contribution guidelines](.github/CONTRIBUTING.md)
   and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
5. Commit your changes (`git commit -am 'Add some fooBar'`)
6. Push to the branch (`git push origin feature/fooBar`)
7. Create a new Pull Request

## GitHub actions

There aren't many standards to follow when it comes to Github actions - but some good rules of thumb for this project are;

- GitHub actions should follow the naming conventions of pre-existing actions to maintain consistency. So that users can find other build-related steps in the same place.
- Ensure that any obscure actions are documented so that others can follow and maintain them.

## Language Dependencies

### TypeScript Packages

Currently we have three typescript packages - two of which are managed via `npm workspaces` and one which is just raw `npm`. How these are built and manages slightly differs until they are all under the same worksapce - please look at their related github actions to learn how to build/test each of them.

## License

Copyright 2024 FINOS

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)
