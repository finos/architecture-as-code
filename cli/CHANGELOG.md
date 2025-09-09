# Changelog

All notable changes to the CALM CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.2.0 (2025-09-09)

* Merge pull request #1592 from LeighFinegold/feature/document-block-architecture-widget ([c399a75](https://github.com/finos/architecture-as-code/commit/c399a75)), closes [#1592](https://github.com/finos/architecture-as-code/issues/1592)
* Merge pull request #1593 from finos/renovate/actions-checkout-digest ([288b704](https://github.com/finos/architecture-as-code/commit/288b704)), closes [#1593](https://github.com/finos/architecture-as-code/issues/1593)
* Merge pull request #1594 from finos/renovate/aws-actions-configure-aws-credentials-digest ([2dc9d58](https://github.com/finos/architecture-as-code/commit/2dc9d58)), closes [#1594](https://github.com/finos/architecture-as-code/issues/1594)
* Merge pull request #1595 from finos/renovate/semgrep-semgrep ([40848d6](https://github.com/finos/architecture-as-code/commit/40848d6)), closes [#1595](https://github.com/finos/architecture-as-code/issues/1595)
* Merge pull request #1596 from finos/renovate/patch-updates ([5d04ec8](https://github.com/finos/architecture-as-code/commit/5d04ec8)), closes [#1596](https://github.com/finos/architecture-as-code/issues/1596)
* Merge pull request #1598 from rocketstack-matt/cve-fixes ([fed336e](https://github.com/finos/architecture-as-code/commit/fed336e)), closes [#1598](https://github.com/finos/architecture-as-code/issues/1598)
* Remove problematic mvnd-sdkman feature from devcontainer ([2645f55](https://github.com/finos/architecture-as-code/commit/2645f55))
* fix(ci): Update Maven build command to include the '-U' flag for dependency updates ([132e418](https://github.com/finos/architecture-as-code/commit/132e418))
* fix(ci): Upgrade Quarkus and Netty versions to address security vulnerabilities ([5903093](https://github.com/finos/architecture-as-code/commit/5903093))
* fix(shared): imply this when when no context provided to widget with no additional options ([20b8d3b](https://github.com/finos/architecture-as-code/commit/20b8d3b))
* feat(calm-widgets): block-architecture widget (#1567) ([68ac659](https://github.com/finos/architecture-as-code/commit/68ac659)), closes [#1567](https://github.com/finos/architecture-as-code/issues/1567)
* chore(calm-hub): Update version to 0.7.6 in pom.xml and documentation ([b4fa57e](https://github.com/finos/architecture-as-code/commit/b4fa57e))
* chore(deps): update actions/checkout digest to 08eba0b ([0e48f22](https://github.com/finos/architecture-as-code/commit/0e48f22))
* chore(deps): update aws-actions/configure-aws-credentials digest to 7474bc4 ([dea8dd6](https://github.com/finos/architecture-as-code/commit/dea8dd6))
* chore(deps): update patch updates ([3dac853](https://github.com/finos/architecture-as-code/commit/3dac853))
* chore(deps): update semgrep/semgrep docker digest to 4eb1dee ([23d7ae6](https://github.com/finos/architecture-as-code/commit/23d7ae6))
* refactor(devcontainer): Replace mvnd-sdkman feature with Java feature and update postCreateCommand ([d260feb](https://github.com/finos/architecture-as-code/commit/d260feb))

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

[Unreleased]: https://github.com/finos/architecture-as-code/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/finos/architecture-as-code/releases/tag/v1.0.0
