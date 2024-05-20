[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/8821/badge)](https://www.bestpractices.dev/projects/8821)
[![CodeQL](https://github.com/finos/architecture-as-code/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/github-code-scanning/codeql)
[![CVE Scanning for Maven](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-maven.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-maven.yml)
[![CVE Scanning for Node.js](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-node.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/cve-scanning-node.yml)
[![License Scanning for Maven](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-maven.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-maven.yml)
[![License Scanning for Node.js](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-node.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/license-scanning-node.yml)

# Architecture as Code

**Architecture as Code (AasC)** aims to devise and manage software architecture via a human and machine readable and
version-controlled
codebase, fostering a robust understanding, efficient development, and seamless maintenance of complex software
architectures.

This repository contains the Common Architecture Language Model (CALM) Specification, as well as capabilities being
built to utilize the
specification. This page lists the domains and capabilities being built by the official AasC community.

Whilst others are welcome to build their own capabilities, away from the AasC monorepo, we encourage you to join the
community and contribute your projects to the AasC monorepo which has the benefits of being visible to the whole
community; thereby attracting contributions and ensuring that changes to the manifest will be proactively built against
your project.

## Projects

| Project                                      | Lead Maintainers                                                                                                                                                                                      | Builds                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|----------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Common Architecture Language Model](./calm) | [@rocketstack-matt](https://github.com/rocketstack-matt), [@jpgough-ms](https://github.com/jpgough-ms)                                                                                                | [![Validation of CALM Samples](https://github.com/finos/architecture-as-code/actions/workflows/spectral-validation.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/spectral-validation.yml)                                                                                                                                                                                                             |
| [Docs](./docs)                               | [@rocketstack-matt](https://github.com/rocketstack-matt)                                                                                                                                              | [![Build Docs](https://github.com/finos/architecture-as-code/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/docs-deploy.yml) [![pages-build-deployment](https://github.com/finos/architecture-as-code/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/pages/pages-build-deployment) |
| [CLI](./cli)                                 | [@jaidanm3341](https://github.com/aidanm3341), [@lbulanti-ms](https://github.com/lbulanti-ms), [@willosborne](https://github.com/willosborne), [@grahampacker-ms](https://github.com/grahampacker-ms) | [![Build CLI](https://github.com/finos/architecture-as-code/actions/workflows/cli-tests.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/cli-tests.yml)                                                                                                                                                                                                                                                  |
| [Spectral](./spectral)                       | [@willosborne](https://github.com/willosborne), [@lbulanti-ms](https://github.com/lbulanti-ms), [@grahampacker-ms](https://github.com/grahampacker-ms)                                                | [![Validation of CALM Samples](https://github.com/finos/architecture-as-code/actions/workflows/spectral-validation.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/spectral-validation.yml)                                                                                                                                                                                                             |
| [Translators](./translator)                  | [@Budlee](https://github.com/Budlee) [@matthewgardner](https://github.com/matthewgardner) [@jpgough-ms](https://github.com/jpgough-ms)                                                                | [![Build Translators](https://github.com/finos/architecture-as-code/actions/workflows/translator.yml/badge.svg)](https://github.com/finos/architecture-as-code/actions/workflows/translator.yml)                                                                                                                                                                                                                                        |

## Getting Involved

Architecture as Code is part of
the [DevOps Automation Special Interest Group](https://devops.finos.org/docs/working-groups/aasc/). Our Zoom meetups
take place on the fourth Tuesday of every month,
see [here](https://github.com/finos/devops-automation/issues?q=label%3Ameeting+label%3Aarchitecture-as-code+) for
upcoming and previous meetings.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose) in this
repository.

## Contributing

Architecture as Code operates as a monorepo, in here you will find both the CALM JSON Schema and the various projects
that are being built to utilize the CALM specification.

We accept contributions via Pull Request, to make a contribution:

1. Pick an issue you are interested in contributing to (or raise one yourself) and speak to the lead maintainers about
   what you plan to do either in the issue itself or come to a meetup.
2. Fork the repo (<https://github.com/finos/architecture-as-code/fork>)
3. Create your feature branch (`git checkout -b feature/fooBar`)
4. Read our [contribution guidelines](.github/CONTRIBUTING.md)
   and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
5. Commit your changes (`git commit -am 'Add some fooBar'`)
6. Push to the branch (`git push origin feature/fooBar`)
7. Create a new Pull Request

## License

Copyright 2024 FINOS

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)
