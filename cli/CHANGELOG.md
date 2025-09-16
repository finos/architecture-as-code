# Changelog

All notable changes to the CALM CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.2 (2025-09-05)

* Merge pull request #1588 from markscott-ms/fix-1555-tidy-debug ([57e38ec](https://github.com/finos/architecture-as-code/commit/57e38ec)), closes [#1588](https://github.com/finos/architecture-as-code/issues/1588)
* fix(shared): honour user's selected log level in validation option selection logic ([da6e513](https://github.com/finos/architecture-as-code/commit/da6e513))

## 1.1.1 (2025-09-05)

* Merge pull request #1583 from Thels/semantic-release-fixes ([8b3a2b9](https://github.com/finos/architecture-as-code/commit/8b3a2b9)), closes [#1583](https://github.com/finos/architecture-as-code/issues/1583)
* Merge pull request #1585 from Thels/semantic-release-fixes ([4b6da79](https://github.com/finos/architecture-as-code/commit/4b6da79)), closes [#1585](https://github.com/finos/architecture-as-code/issues/1585)
* Merge pull request #1586 from Thels/semantic-release-fixes ([10810a3](https://github.com/finos/architecture-as-code/commit/10810a3)), closes [#1586](https://github.com/finos/architecture-as-code/issues/1586)
* fix(release): remove assets configuration from GitHub plugin ([a82bce1](https://github.com/finos/architecture-as-code/commit/a82bce1))
* fix(release): swap @semantic-release/exec and @semantic-release/github ([299aa43](https://github.com/finos/architecture-as-code/commit/299aa43))
* fix(release): update current version retrieval to use latest git tag instead of package.json ([ad0fcf6](https://github.com/finos/architecture-as-code/commit/ad0fcf6))
## 1.1.0 (2025-09-05)

* Merge pull request #1580 from Thels/semantic-release-fixes ([232ef93](https://github.com/finos/architecture-as-code/commit/232ef93)), closes [#1580](https://github.com/finos/architecture-as-code/issues/1580)
* Merge pull request #1581 from Thels/semantic-release-fixes ([76b5f8d](https://github.com/finos/architecture-as-code/commit/76b5f8d)), closes [#1581](https://github.com/finos/architecture-as-code/issues/1581)
* Merge pull request #1582 from Thels/semantic-release-fixes ([adc8dcd](https://github.com/finos/architecture-as-code/commit/adc8dcd)), closes [#1582](https://github.com/finos/architecture-as-code/issues/1582)
* fix(docs): remove mention of faster delivery from contributing guidelines ([52c58fe](https://github.com/finos/architecture-as-code/commit/52c58fe))
* fix(release): update prepareCmd to include changelog update and push for CLI versioning ([ee5100c](https://github.com/finos/architecture-as-code/commit/ee5100c))
* feat(release): add automated changelog PR creation for CLI releases ([9c93f0b](https://github.com/finos/architecture-as-code/commit/9c93f0b))

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
