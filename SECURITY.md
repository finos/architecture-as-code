# Security Policy

This project supports responsible disclosure of security vulnerabilities and adheres to the [FINOS Security Vulnerabilities Responsible Disclosure Policy](https://community.finos.org/docs/governance/software-projects/cve-responsible-disclosure). If you believe you have found a security vulnerability in this project, we encourage and appreciate your report. Please report it privately using one of the methods below — **do not** open a public GitHub Issue or otherwise disclose it publicly.

## Reporting a Vulnerability

- **GitHub private vulnerability reporting (preferred):** Use the ["Report a vulnerability"](../../security/advisories/new) button under this repository's **Security** tab. This opens a private advisory and communication channel with the maintainers.
- **Email:** If you're unable to use GitHub's private reporting, email [calm-maintainers@lists.finos.org](mailto:calm-maintainers@lists.finos.org) and [security@finos.org](mailto:security@finos.org) with a description of the issue.

## Vulnerability Process

1. **Report the vulnerability privately** using one of the methods above.
2. The project team will acknowledge receipt, triage the report, and — if confirmed — work with you to investigate and develop a fix.
3. Once a fix is available, it will be released and the vulnerability will be publicly disclosed in accordance with the [FINOS Security Vulnerabilities Responsible Disclosure Policy](https://community.finos.org/docs/governance/software-projects/cve-responsible-disclosure).

## Supported Versions

Security fixes are always delivered as a new release. Which releases are supported, and when a release stops receiving security updates, is stated in [SUPPORT.md](SUPPORT.md).

## Threat Model

The project's threat model and attack surface analysis is maintained in [THREAT_MODEL.md](THREAT_MODEL.md).

## Dependency and Code Scanning Policy

This section is the project's policy for findings from software composition analysis (SCA) and static application security testing (SAST).

Every pull request must pass two SCA checks, and merging is blocked until each violation is addressed. The `osv-scanner` check scans every dependency tree in the repository (the root npm lockfile, the Maven projects `calm-hub` and `calm-models`, and the CALM Studio desktop Cargo lockfile) against the OSV database and fails on any finding with a CVSS score of 5 or higher. The `dependency-review` check evaluates the dependencies that a pull request adds or changes for known vulnerabilities of moderate severity or higher and for malicious packages. OSV Scanner also runs on `main` on every push and twice each working day. Dependabot raises alerts and security update pull requests for npm, Maven, Cargo and GitHub Actions, and Renovate raises update pull requests for outdated dependencies.

Critical and high severity vulnerabilities in a runtime dependency must be fixed within 7 days of being reported. Medium severity vulnerabilities must be fixed within 30 days. Low severity vulnerabilities must be fixed in the next scheduled release. A dependency whose license is incompatible with Apache-2.0, or is otherwise disallowed by the license scanning workflows, must be removed or replaced before the change is merged, so that only dependencies with an approved permissive license ship in a release.

All SCA findings above these thresholds must be addressed before any release of the affected component, and the release is blocked until each finding is fixed or declared non-exploitable as described below. The CLI and CALM Server release workflows enforce this automatically: they publish only when the OSV Scanner run for the commit being released has passed. For every other component, the releasing maintainer must confirm that the latest OSV Scanner run on `main` passed before the release.

A finding may be suppressed only when a maintainer declares it non-exploitable for this project. The suppression must be an entry in `osv-scanner.toml`, added through a reviewed pull request, with the written justification in `reason` and a re-review date in `ignoreUntil`. A Dependabot alert for the same finding is dismissed with the same justification recorded on the alert. A suppression must be removed when the dependency is upgraded or reviewed again when its re-review date passes.

CodeQL (`.github/workflows/codeql.yml`, with the default query suite, covering every language in the repository) and Semgrep run SAST on every pull request and on a schedule against `main`. The `semgrep/ci` check must pass before a pull request can be merged, and code scanning results of high severity or above block the merge. Critical and high severity SAST findings must be fixed before merge. Medium and low severity SAST findings must be fixed, or dismissed with a documented justification, within 30 days of being raised. A SAST finding may be dismissed only when it is declared a false positive or non-exploitable, with the reason recorded on the alert.

## Secrets and Credentials

Credentials used by the project are stored only as GitHub Actions secrets: npm publishing tokens, Docker Hub credentials, Maven Central deploy credentials and the GPG signing key, the VS Code Marketplace token, Apple and Tauri code-signing credentials for the CALM Studio desktop app, AWS credentials used to publish the documentation sites, the release bot's GitHub token, the Semgrep token and the NVD API key. Most are repository secrets, which GitHub does not expose to workflows triggered from forks; the NVD API key is also scoped to the `code-scan` environment. Secrets are never committed to the repository; GitHub secret scanning and push protection are enabled to enforce this. Each secret is issued with the minimum scope the workflow requires, for example an npm token that can only publish and cannot read account data. Access to secrets is limited to repository administrators. A secret is rotated when a maintainer with access leaves the project, when the workflow that uses it is retired, and immediately on any suspicion of exposure; rotation is announced on the calm-maintainers mailing list.

Maintainers are expected to protect their own GitHub accounts with two-factor authentication.

## Verifying Release Integrity and Authenticity

Releases are produced only by the automated release workflows in this repository. No maintainer publishes a package or image from a personal machine.

**npm packages** `@finos/calm-cli` and `@finos/calm-server` are published with `npm publish --provenance`. `@finos/calm-shared`, `@finos/calm-models` and `@finos/calm-widgets` are bundled into the CLI and are not published to npm. The CALM Studio release workflow can also publish `@calmstudio/calm-core`, `@calmstudio/mcp`, `@calmstudio/diagram` and `@finos/calm-docusaurus-plugin` with provenance; it has not published a release yet. Each version carries a [SLSA provenance attestation](https://slsa.dev/provenance/v1) signed through Sigstore that names this repository, the release workflow and the commit that built it. To verify a package you have installed:

```bash
npm audit signatures
```

The command reports `verified attestations` for each `@finos` package whose registry signature and provenance attestation are valid. To confirm who published a version, open the package's version page on npmjs.com and check that the *Provenance* panel names `finos/architecture-as-code` and the workflow `.github/workflows/automated-release.yml` (`automated-release-calm-server.yml` for `@finos/calm-server`, `automated-release-calm-studio.yml` for the CALM Studio packages). To compare a downloaded tarball with the registry, check its integrity hash against `npm view @finos/calm-cli@<version> dist.integrity`.

**GitHub releases** for the CLI and CALM Server attach the published tarball and a CycloneDX software bill of materials (`*.cdx.json`) describing its runtime dependencies. The release workflow publishes that same tarball to npm, so its integrity hash matches the registry value above.

**Maven artifacts**: `org.finos.calm:calm-models` is published to Maven Central by `release-calm-models-maven-publish.yml` and signed with the project's GPG key. Verify the `.asc` signature that Maven Central serves next to each artifact.

**Docker images** (`finos/calm-hub` and its variants) are built and pushed by the `docker-publish-*` workflows with provenance and SBOM attestations attached to the image index. To inspect them:

```bash
docker buildx imagetools inspect finos/calm-hub:<tag> --format '{{ json .Provenance }}'
docker buildx imagetools inspect finos/calm-hub:<tag> --format '{{ json .SBOM }}'
```

The provenance names the GitHub Actions workflow and commit that produced the image. The native images (`*-native` tags) contain a compiled binary, so their SBOM lists only the base image and not the Java dependencies compiled into the binary. For the dependency list, use the SBOM of the JVM image built from the same commit.

**Experimental components.** CALM Studio (its npm packages and desktop builds), CALMGuard, CALM Lab and `experimental/` are experimental, as stated in [SUPPORT.md](SUPPORT.md). The release controls in this section apply to them once they are promoted out of experimental status.

Thank you for helping keep FINOS projects and their users secure.
