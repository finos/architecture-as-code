# Changelog

All notable changes to the CALM CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## <small>1.3.1 (2025-09-15)</small>

- Merge pull request #1612 from rocketstack-matt/cve-fix ([f0a8acc](https://github.com/finos/architecture-as-code/commit/f0a8acc)), closes [#1612](https://github.com/finos/architecture-as-code/issues/1612)
- fix(ci): Ensure consistency of dependency check locally and remote ([9ad9372](https://github.com/finos/architecture-as-code/commit/9ad9372))

## 1.3.0 (2025-09-11)

- Merge pull request #1603 from LeighFinegold/vertical-table ([0021f2b](https://github.com/finos/architecture-as-code/commit/0021f2b)), closes [#1603](https://github.com/finos/architecture-as-code/issues/1603)
- Merge pull request #1604 from finos/dependabot/npm_and_yarn/npm_and_yarn-d2c86c59b8 ([3907c64](https://github.com/finos/architecture-as-code/commit/3907c64)), closes [#1604](https://github.com/finos/architecture-as-code/issues/1604)
- chore(deps): bump the npm_and_yarn group across 2 directories with 1 update ([d4830d0](https://github.com/finos/architecture-as-code/commit/d4830d0))
- feat(calm-widgets): table enhancements to support flat vertical tables ([364d4a5](https://github.com/finos/architecture-as-code/commit/364d4a5))

## 1.2.0 (2025-09-09)

- Merge pull request #1592 from LeighFinegold/feature/document-block-architecture-widget ([c399a75](https://github.com/finos/architecture-as-code/commit/c399a75)), closes [#1592](https://github.com/finos/architecture-as-code/issues/1592)
- Merge pull request #1593 from finos/renovate/actions-checkout-digest ([288b704](https://github.com/finos/architecture-as-code/commit/288b704)), closes [#1593](https://github.com/finos/architecture-as-code/issues/1593)
- Merge pull request #1594 from finos/renovate/aws-actions-configure-aws-credentials-digest ([2dc9d58](https://github.com/finos/architecture-as-code/commit/2dc9d58)), closes [#1594](https://github.com/finos/architecture-as-code/issues/1594)
- Merge pull request #1595 from finos/renovate/semgrep-semgrep ([40848d6](https://github.com/finos/architecture-as-code/commit/40848d6)), closes [#1595](https://github.com/finos/architecture-as-code/issues/1595)
- Merge pull request #1596 from finos/renovate/patch-updates ([5d04ec8](https://github.com/finos/architecture-as-code/commit/5d04ec8)), closes [#1596](https://github.com/finos/architecture-as-code/issues/1596)
- Merge pull request #1598 from rocketstack-matt/cve-fixes ([fed336e](https://github.com/finos/architecture-as-code/commit/fed336e)), closes [#1598](https://github.com/finos/architecture-as-code/issues/1598)
- Remove problematic mvnd-sdkman feature from devcontainer ([2645f55](https://github.com/finos/architecture-as-code/commit/2645f55))
- fix(ci): Update Maven build command to include the '-U' flag for dependency updates ([132e418](https://github.com/finos/architecture-as-code/commit/132e418))
- fix(ci): Upgrade Quarkus and Netty versions to address security vulnerabilities ([5903093](https://github.com/finos/architecture-as-code/commit/5903093))
- fix(shared): imply this when when no context provided to widget with no additional options ([20b8d3b](https://github.com/finos/architecture-as-code/commit/20b8d3b))
- feat(calm-widgets): block-architecture widget (#1567) ([68ac659](https://github.com/finos/architecture-as-code/commit/68ac659)), closes [#1567](https://github.com/finos/architecture-as-code/issues/1567)
- chore(calm-hub): Update version to 0.7.6 in pom.xml and documentation ([b4fa57e](https://github.com/finos/architecture-as-code/commit/b4fa57e))
- chore(deps): update actions/checkout digest to 08eba0b ([0e48f22](https://github.com/finos/architecture-as-code/commit/0e48f22))
- chore(deps): update aws-actions/configure-aws-credentials digest to 7474bc4 ([dea8dd6](https://github.com/finos/architecture-as-code/commit/dea8dd6))
- chore(deps): update patch updates ([3dac853](https://github.com/finos/architecture-as-code/commit/3dac853))
- chore(deps): update semgrep/semgrep docker digest to 4eb1dee ([23d7ae6](https://github.com/finos/architecture-as-code/commit/23d7ae6))
- refactor(devcontainer): Replace mvnd-sdkman feature with Java feature and update postCreateCommand ([d260feb](https://github.com/finos/architecture-as-code/commit/d260feb))

## <small>1.1.3 (2025-09-05)</small>

- Merge pull request #1590 from Thels/semantic-release-fixes ([9f83a08](https://github.com/finos/architecture-as-code/commit/9f83a08)), closes [#1590](https://github.com/finos/architecture-as-code/issues/1590)
- fix(release): update success command to remove [skip ci] from changelog commit message ([b9ae424](https://github.com/finos/architecture-as-code/commit/b9ae424))

## <small>1.1.2 (2025-09-05)</small>

- Merge pull request #1588 from markscott-ms/fix-1555-tidy-debug ([57e38ec](https://github.com/finos/architecture-as-code/commit/57e38ec)), closes [#1588](https://github.com/finos/architecture-as-code/issues/1588)
- fix(shared): honour user's selected log level in validation option selection logic ([da6e513](https://github.com/finos/architecture-as-code/commit/da6e513))

## <small>1.1.1 (2025-09-05)</small>

- Merge pull request #1583 from Thels/semantic-release-fixes ([8b3a2b9](https://github.com/finos/architecture-as-code/commit/8b3a2b9)), closes [#1583](https://github.com/finos/architecture-as-code/issues/1583)
- Merge pull request #1585 from Thels/semantic-release-fixes ([4b6da79](https://github.com/finos/architecture-as-code/commit/4b6da79)), closes [#1585](https://github.com/finos/architecture-as-code/issues/1585)
- Merge pull request #1586 from Thels/semantic-release-fixes ([10810a3](https://github.com/finos/architecture-as-code/commit/10810a3)), closes [#1586](https://github.com/finos/architecture-as-code/issues/1586)
- fix(release): remove assets configuration from GitHub plugin ([a82bce1](https://github.com/finos/architecture-as-code/commit/a82bce1))
- fix(release): swap @semantic-release/exec and @semantic-release/github ([299aa43](https://github.com/finos/architecture-as-code/commit/299aa43))
- fix(release): update current version retrieval to use latest git tag instead of package.json ([ad0fcf6](https://github.com/finos/architecture-as-code/commit/ad0fcf6))

## 1.1.0 (2025-09-05)

- Merge pull request #1580 from Thels/semantic-release-fixes ([232ef93](https://github.com/finos/architecture-as-code/commit/232ef93)), closes [#1580](https://github.com/finos/architecture-as-code/issues/1580)
- Merge pull request #1581 from Thels/semantic-release-fixes ([76b5f8d](https://github.com/finos/architecture-as-code/commit/76b5f8d)), closes [#1581](https://github.com/finos/architecture-as-code/issues/1581)
- Merge pull request #1582 from Thels/semantic-release-fixes ([adc8dcd](https://github.com/finos/architecture-as-code/commit/adc8dcd)), closes [#1582](https://github.com/finos/architecture-as-code/issues/1582)
- fix(docs): remove mention of faster delivery from contributing guidelines ([52c58fe](https://github.com/finos/architecture-as-code/commit/52c58fe))
- fix(release): update prepareCmd to include changelog update and push for CLI versioning ([ee5100c](https://github.com/finos/architecture-as-code/commit/ee5100c))
- feat(release): add automated changelog PR creation for CLI releases ([9c93f0b](https://github.com/finos/architecture-as-code/commit/9c93f0b))

## [Unreleased]

### Added

- Introduced semantic-release for automated version management
- Added conventional commit validation
- Automated changelog generation

## [1.0.0] - 2025-08-21

### Added

- Initial stable release of CALM CLI
- Support for CALM schema validation
- Documentation generation capabilities
- Widget support for enhanced functionality

[Unreleased]: https://github.com/finos/architecture-as-code/compare/cli-v1.3.1...HEAD
[1.3.1]: https://github.com/finos/architecture-as-code/compare/cli-v1.3.0...cli-v1.3.1
[1.3.0]: https://github.com/finos/architecture-as-code/compare/cli-v1.2.0...cli-v1.3.0
[1.2.0]: https://github.com/finos/architecture-as-code/compare/cli-v1.1.3...cli-v1.2.0
[1.1.3]: https://github.com/finos/architecture-as-code/compare/cli-v1.1.2...cli-v1.1.3
[1.1.2]: https://github.com/finos/architecture-as-code/compare/cli-v1.1.1...cli-v1.1.2
[1.1.1]: https://github.com/finos/architecture-as-code/compare/cli-v1.1.0...cli-v1.1.1
[1.1.0]: https://github.com/finos/architecture-as-code/compare/v1.0.0...cli-v1.1.0
[1.0.0]: https://github.com/finos/architecture-as-code/releases/tag/v1.0.0
