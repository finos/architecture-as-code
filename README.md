![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

# Architecture as Code

**Architecture as Code (AasC)** aims to devise and manage software architecture via a human and machine readable and version-controlled
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

| Project                                      | Lead Maintainers                        |
|----------------------------------------------|-----------------------------------------|
| [Common Architecture Language Model](./calm) | @rocketstack-matt, @jpgough-ms          |
| [Docs](./docs)                               | @rocketstack-matt                       |
| [CLI](./cli)                                 | @aidanm3341, @lbulanti-ms, @willosborne |
| [Spectral](./spectral)                       | @willosborne, @lbulanti-ms              |
| [Visualizer](./visualizer)                   | @aidanm3341, @Budlee, @willosborne      |

## Getting Involved
Architecture as Code is part of the [DevOps Automation Special Interest Group](https://devops.finos.org/docs/working-groups/aasc/). Our Zoom meetups take place on the fourth Tuesday of every month, see [here](https://github.com/finos/devops-automation/issues?q=label%3Ameeting+label%3Aarchitecture-as-code+) for upcoming and previous meetings.

Have an idea or feedback? [Raise an issue](https://github.com/finos-labs/architecture-as-code/issues/new/choose) in this repository.

## Contributing
Architecture as Codee operates as a monorepo, in here you will find both the CALM JSON Schema and the various projects that are being built to utilize the CALM specification.

We accept contributions via Pull Request, to make a contribution:
1. Pick an issue you are interested in contributing to (or raise one yourself) and speak to the lead maintainers about what you plan to do either in the issue itself or come to a meetup.
2. Fork the repo (<https://github.com/finos-labs/architecture-as-code/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Read our [contribution guidelines](.github/CONTRIBUTING.md)
   and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
4. Commit your changes (`git commit -am 'Add some fooBar'`)
5. Push to the branch (`git push origin feature/fooBar`)
6. Create a new Pull Request

## License

Copyright 2024 FINOS

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)
