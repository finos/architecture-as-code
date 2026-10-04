# Threat Model and Attack Surface Analysis

This is the project's security self-assessment: a threat model and attack surface analysis for the software released from this repository. It satisfies OSPS Baseline controls OSPS-SA-03.01 and OSPS-SA-03.02 and is declared in [`security-insights.yml`](security-insights.yml). It is reviewed when a component gains a new external interface, a new trust boundary, or a new distribution channel, and at least once a year.

Last reviewed: 2026-10-03.

## Scope

| Component | Runs as | Trust boundary |
|---|---|---|
| CALM specification ([finos/calm-schema](https://github.com/finos/calm-schema)) | JSON Schema files served from calm.finos.org and published to npm as `@finos/calm-schema` | Consumed by every other component and by third-party tools |
| `@finos/calm-cli` (bundles `@finos/calm-shared`, `@finos/calm-models` and `@finos/calm-widgets`) | Developer workstation or CI job | Reads architecture, pattern and template files supplied by the user; fetches remote schemas |
| `@finos/calm-server` | Local HTTP service (binds `127.0.0.1` by default) | Validates documents sent over HTTP; no authentication |
| CALM Hub (`calm-hub/`) and Hub UI | Server-side service, Docker image | Multi-tenant store of architectures with per-namespace authorization |
| VS Code extension | Inside the editor, renders a webview | Processes files in the user's workspace |
| CALM Lab (`calm-lab/`) | Static site at lab.calm.finos.org; the engine runs in the visitor's browser | Processes documents the visitor enters; nothing is sent to a server |
| CALM Studio, CALMGuard, `experimental/` | Various | Experimental; not covered by this assessment until promoted |
| Build and release pipelines (`.github/workflows` here and in finos/calm-schema) | GitHub Actions | Produce every released asset |

## Assets to protect

1. **Integrity of released assets**: npm packages, Docker images, the VS Code extension, the CALM Lab site, and the published specification. A tampered CLI or schema would be executed or trusted inside adopters' pipelines.
2. **Confidentiality and integrity of architectures stored in a CALM Hub**: they describe adopters' internal systems, controls and network topology.
3. **The user's workstation and CI environment** when the CLI processes untrusted input.
4. **Repository and publishing credentials**: npm, Docker Hub, Maven Central (with the GPG signing key) and VS Code Marketplace credentials, code-signing credentials, cloud credentials for the documentation sites and CALM Lab, the Actions tokens, and maintainer accounts.

## Attack surface and threats

### CLI and shared library

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Architecture and pattern files passed on the command line | Malicious JSON causes excessive resource use (deeply nested `$ref`, large documents) | Ajv validation with bounded schema resolution; files are parsed, never executed | Low. Denial of service is limited to the invoking process |
| Remote `$ref` and `$schema` URLs in user documents | Server-side request forgery through a crafted reference | `DirectUrlDocumentLoader` in `shared` fetches only absolute `http(s)` URLs to an allow-listed host (default `calm.finos.org`). CodeQL `js/request-forgery` findings are triaged for every change | Low |
| Local `$ref` values (relative paths, absolute paths, `file://`) in user documents | A document from an untrusted source references a local file and its content ends up in validation output or generated documentation | Local loading is intentional: `FileSystemDocumentLoader` resolves local references so the CLI can work on the user's own files, with the invoking user's permissions. There is no sandbox; the CLI trusts the documents it is pointed at | Medium. Treat architecture documents from third parties as untrusted input and run the CLI in an environment without sensitive files |
| Template bundles used by `template` and `docify` (Handlebars templates and a JavaScript or TypeScript transformer) | A bundle from an untrusted source runs arbitrary code, writes files outside the output directory, or embeds active content in generated documents | None for code execution: the CLI imports the bundle's transformer module and runs it in-process with the invoking user's permissions. Generated Markdown and HTML are never executed by the CLI. Output file names from a bundle are joined onto the output directory without a containment check, so a bundle can write outside it | High for bundles from an untrusted source. A template bundle is code and must be sourced with the same care as a dependency; adding a containment check on output paths is planned hardening |
| Diagram export (`--export-diagrams`) | Launches a local Chromium via `playwright-core` to render Mermaid; a crafted diagram could exploit the browser | Rendering is local, headless and short-lived; the browser is the user's own installation and receives its own security updates | Low |
| Hub commands (`push`, `pull`, `list`) | Credentials for a Hub leak, or a Hub is reachable without credentials | Authentication is optional and plugin-based: the CLI sends no credentials unless an auth plugin is configured through `authPluginPath` in the CLI config, in which case the plugin supplies the request headers. Plugin code and any secrets it uses live in the user's own configuration, outside the repository | Medium. A Hub used without an auth plugin must be fronted by an authenticating proxy (`proxy-auth` mode) or restricted by network controls |
| Auth plugin (`authPluginPath` in `~/.calm.json`, or `CALM_AUTH_PLUGIN_PATH`) | An attacker who can change the user's CLI config or environment points it at a malicious module, which runs with the user's permissions and supplies the headers for every Hub request | The plugin path comes only from the user's own config file and environment. The CLI imports that module and runs it in-process; there is no signature or allow-list check | Medium. Protect the CLI config file and environment as executable configuration |

### CALM Server

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| HTTP `/calm/validate` and related endpoints | Exposure on a network interface lets any client validate arbitrary documents and probe the host | Binds to `127.0.0.1` by default; a warning is logged when bound elsewhere. No authentication is implemented, and the documentation says so | Medium if deployed on a shared network. Deploy behind an authenticating proxy |
| User-supplied pattern `$ref` values | Local file read or SSRF through references | Same loader rules as the CLI: fragment-only or `http(s)` to allow-listed hosts; everything else returns `400` | Low |

### CALM Hub and Hub UI

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| REST API for namespaces, architectures, patterns, flows, standards, ADRs and documents | Unauthenticated access, or access to another tenant's namespace | Default profile is `secure` and rejects every request with `401`. Supported modes are OIDC (Keycloak) and proxy-injected identity; `no-auth` is for local testing only. Per-namespace permission checks are enforced in `org.finos.calm.security` for every resource | Low when deployed with OIDC or a trusted proxy. High if an operator ships `no-auth` to production; the read-only image is the safe public-facing option |
| Document and version payloads (JSON) | Unsafe deserialization or injection through stored documents | Payloads are parsed as JSON into typed models; MongoDB and Nitrite access goes through the storage abstraction with no string-built queries. A CodeQL `java/unsafe-deserialization` finding on `DocumentResource` is open and tracked in code scanning | Medium until that alert is resolved |
| Git-backed read-only storage mode | The Hub clones a remote repository; a hostile remote or a race between sync and read serves inconsistent or crafted content | Clone target is operator-configured; reads are served from a local checkout. Concurrency between sync and readers is tracked in issue #3093 | Medium |
| Hub UI (React) | Cross-site scripting through architecture content rendered in the browser | Content is rendered through React and ReactFlow components, which escape text by default | Low |
| Container image | Vulnerable base image or bundled dependency | Images are rebuilt on every release; OSV Scanner checks the Maven dependency tree on every pull request; Dependabot and Renovate keep the Quarkus stack current; Docker images are published with provenance and an SBOM; the SBOM of a native image lists only its base image | Low |

### VS Code extension

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Workspace files opened in the editor | Crafted architecture triggers script execution in the preview webview | The webview renders Mermaid produced from the model; VS Code's webview isolation and content-security policy apply | Low |

### CALM Lab

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Documents typed or pasted into the editor and terminal | A crafted document causes excessive resource use, or makes the lab fetch from an attacker's host | The engine runs in the visitor's browser with the bundled meta-schemas only. Remote loading is off: a remote `$ref` gives an error and is never fetched. Nothing the visitor enters is sent to a server | Low. Denial of service is limited to the visitor's own tab |
| Workspace files and lesson progress in `localStorage` | Another site, or another user of the same browser, reads the visitor's work | Data is stored on the lab's own origin, separate from calm.finos.org, and is never uploaded | Low. Anyone with access to the browser profile can read it. Do not enter confidential architectures |
| `?lesson=` query parameter and rendered content | Cross-site scripting through a crafted link or document | The parameter only selects a bundled lesson by id. Terminal output, lessons and the diagram are rendered through React and ReactFlow, which escape text; the lab renders no raw HTML | Low. The site sends no Content-Security-Policy, so there is no second layer of defence if an escaping defect is introduced |
| Google Fonts stylesheet | A third party sees visitor IP addresses or serves altered CSS | Fonts are the only third-party resource; no third-party script is loaded | Low |
| Hosting and deployment (S3 bucket and CloudFront distribution for lab.calm.finos.org) | An attacker with the AWS credentials, with write access to `main`, or on the visitor's network serves modified JavaScript to visitors | `s3-lab-sync.yml` deploys only from `main`, which requires a reviewed pull request, and only when the OSV Scanner run for that commit has passed. A manual run on another branch does not deploy. The AWS credentials are repository secrets and are not exposed to workflows triggered from forks. HTTP requests are redirected to HTTPS | Medium. The site sends no HSTS header, so a first request over HTTP can be intercepted. The AWS credentials are shared with the documentation sites and are available to a workflow on any branch of this repository, so a user with write access can deploy a branch by changing the workflow on it. The bucket and distribution are configured outside this repository |

### Build, release and supply chain

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Pull requests from forks | Malicious workflow changes or code execution with repository secrets | Workflows run with `permissions:` declared per workflow and a read-only default token; repository secrets are not exposed to workflows triggered from forks; `pull_request_target` is used only by the labelling workflow, which never checks out or runs pull-request code | Low |
| Third-party GitHub Actions | A compromised action exfiltrates tokens | Every action is pinned to a commit SHA and updated by Renovate; `step-security/harden-runner` audits egress | Low |
| Dependencies (npm, Maven, Cargo) | Known vulnerabilities or malicious packages enter the tree | OSV Scanner blocks pull requests while any dependency tree has a known vulnerability with a CVSS score of 5 or higher, and the CLI and CALM Server releases and the CALM Lab deploy require a passing scan of the commit being released or deployed; Dependency Review blocks pull requests that introduce known-vulnerable or known-malicious packages; Dependabot and Renovate raise update pull requests; a single root lockfile is validated in CI. In finos/calm-schema, whose only dependencies are test tools, Dependency Review and Dependabot apply. See the policy in [SECURITY.md](SECURITY.md) | Low |
| Publishing | An attacker with a stolen token publishes a rogue version | `@finos/calm-cli` and `@finos/calm-server` are published only from the release workflows with `--provenance`, so every version carries a SLSA attestation naming this repository and workflow. `calm-models` is published to Maven Central from its release workflow and GPG-signed. The CALM Studio release workflow publishes its npm packages with provenance. Docker images carry provenance and SBOM attestations. `@finos/calm-schema` is published only by finos/calm-schema's `publish.yml` through npm trusted publishing, which uses a short-lived GitHub OIDC token, so no npm token is stored. The workflow runs the schema tests on the release tag first, and each version carries SLSA provenance naming finos/calm-schema. Secret scanning and push protection are enabled | Medium. Token theft from a maintainer's environment remains the main residual risk; tokens are rotated on any suspicion |
| Repository | Direct pushes or unreviewed merges to `main` | Ruleset requires a pull request, one approving review, code-owner review, dismissal of stale reviews, and passing required status checks; force pushes and deletion are blocked | Low |

## Out of scope

- Security of the infrastructure an adopter uses to run CALM Hub (network, identity provider, database hardening). Deployment guidance is in `calm-hub/README.md`.
- The AI agent tools in `calm-ai/` are prompts and tool definitions. They execute nothing themselves; the security posture of the agent runtime that loads them belongs to that runtime.
- Experimental components until they are promoted.

## Review

Changes to this document are proposed by pull request. Any pull request that adds an external interface, a new storage backend, a new authentication mode or a new distribution channel must update the relevant table.
