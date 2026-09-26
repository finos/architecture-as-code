# Support

This page states what support the Architecture as Code (CALM) project provides, which releases are supported, and when a release stops receiving security updates.

## Getting help

Support is provided by the community on a best-effort basis. There is no service-level agreement.

- **Questions and usage help:** open a [Support Question](https://github.com/finos/architecture-as-code/issues/new?template=Support_question.md) issue, or join the monthly community meeting and weekly Office Hours listed in the [README](README.md#getting-involved).
- **Bugs:** open a [Bug Report](https://github.com/finos/architecture-as-code/issues/new?template=Bug_report.md).
- **Security vulnerabilities:** do not open a public issue. Follow [SECURITY.md](SECURITY.md).
- **Documentation:** https://calm.finos.org

## Supported releases

The project ships several independently released components. For every component, **only the latest published release is supported**. Bug fixes and security fixes are delivered by publishing a new release, not by patching older ones.

| Component | Distribution | Supported |
|---|---|---|
| CALM specification (`calm/`) | https://calm.finos.org/release, tagged `<major>.<minor>.<patch>` | Latest release. Earlier published releases stay available at their URLs so existing documents keep validating, but they receive no further changes. |
| `@finos/calm-cli`, `@finos/calm-server` | npm | Latest published version of each package. `@finos/calm-shared`, `@finos/calm-models` and `@finos/calm-widgets` are bundled into the CLI and are not published separately. |
| `calm-models` (Java) | Maven Central | Latest published version. |
| CALM Hub | Docker Hub `finos/calm-hub` (and the read-only and native variants) | Latest tag. |
| CALM VS Code extension | Visual Studio Marketplace | Latest published version. |
| CALM Studio, CALMGuard, CALM Lab, `experimental/` | Various | Experimental. No support commitment and no security-update commitment until they are promoted out of experimental status. |

## When a release stops receiving security updates

A release stops receiving security updates **at the moment a newer release of the same component is published**. Security fixes are always released as a new version. If you are on an older version, upgrade to the latest release to receive the fix.

Pre-releases (for example `-rc` or `-next` versions) are not supported and receive no security updates.

## Versioning

All components follow [Semantic Versioning](https://semver.org/). Breaking changes only ship in a new major version and are called out in the release notes.
