![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

<img align="right" width="40%" src="https://www.finos.org/hubfs/FINOS/finos-logo/FINOS_Icon_Wordmark_Name_RGB_horizontal.png">

# FINOS Software Project Blueprint

Project blueprint is a GitHub repository template for all [Fintech Open Source Foundation (FINOS)](https://www.finos.org/) hosted GitHub repositories, contributed and maintained by FINOS as part of the [Open Developer Platform (ODP)](https://odp.finos.org) initiative.


## Using DCO to sign your commits

All commits must be signed with a DCO signature to avoid being flagged by the DCO Bot. This means that your commit log message must contain a line that looks like the following one, with your actual name and email address:

```
Signed-off-by: John Doe <john.doe@example.com>
```

Adding the `-s` flag to your `git commit` will add that line automatically. You can also add it manually as part of your commit log message or add it afterwards with `git commit --amend -s`.

### Helpful DCO Resources
- [Git Tools - Signing Your Work](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
- [Signing commits
](https://docs.github.com/en/github/authenticating-to-github/signing-commits)


## How to use this blueprint

1. Clone this repository locally (`git clone https://github.com/finos-labs/project-blueprint.git`)
2. Copy the `LICENSE`, `LICENSE.spdx`, and `NOTICE` files, as well as the entire `.github` directory, to your own repository (do _not_ copy this `README.md` file).
3. Copy the `README.template.md` file to your repository, and rename it to `README.md`.
4. Search and replace the following tokens in the newly copied files:

  | Token                        | Replace with                                                      |
  | ---------------------------- | ----------------------------------------------------------------- |
  | `{project name}`             | The name of the GitHub repository the project resides in.         |
  | `{yyyy}`                     | The year you started working on the code.                         |
  | `{current_year}`             | The current year.                                                 |
  | `{name of copyright owner}`  | The copyright owner of the code (typically you or your employer). |
  | `{email of copyright owner}` | The email address of the copyright owner of the code (if known).  |

5. Open the `NOTICE` file in a text editor and either remove the `{Other notices, as necessary}` token, or [add attributions if required by your code's dependencies](https://finosfoundation.atlassian.net/wiki/spaces/FINOS/pages/75530255/License+Categories).
6. Open the `README.md` file in a text editor and complete the content as appropriate for your project.
7. Add the [Apache license header to all of your source files](https://www.apache.org/licenses/LICENSE-2.0.html#apply).
8. Commit all of your changes.

## License

Copyright 2020 Fintech Open Source Foundation

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)
