# Threat Model and Attack Surface Analysis

This is the project's security self-assessment: a threat model and attack surface analysis for the software released from this repository. It satisfies OSPS Baseline controls OSPS-SA-03.01 and OSPS-SA-03.02 and is declared in [`security-insights.yml`](security-insights.yml). It is reviewed when a component gains a new external interface, a new trust boundary, or a new distribution channel, and at least once a year.

Last reviewed: 2026-09-26.

## Scope

| Component | Runs as | Trust boundary |
|---|---|---|
| CALM specification (`calm/`) | JSON Schema files served from calm.finos.org | Consumed by every other component and by third-party tools |
| `@finos/calm-cli` (bundles `@finos/calm-shared`, `@finos/calm-models` and `@finos/calm-widgets`) | Developer workstation or CI job | Reads architecture, pattern and template files supplied by the user; fetches remote schemas |
| `@finos/calm-server` | Local HTTP service (binds `127.0.0.1` by default) | Validates documents sent over HTTP; no authentication |
| CALM Hub (`calm-hub/`) and Hub UI | Server-side service, Docker image | Multi-tenant store of architectures with per-namespace authorization |
| VS Code extension | Inside the editor, renders a webview | Processes files in the user's workspace |
| CALM Studio, CALMGuard, CALM Lab, `experimental/` | Various | Experimental; not covered by this assessment until promoted |
| Build and release pipeline (`.github/workflows`) | GitHub Actions | Produces every released asset |

## Assets to protect

1. **Integrity of released assets**: npm packages, Docker images, the VS Code extension, and the published specification. A tampered CLI or schema would be executed or trusted inside adopters' pipelines.
2. **Confidentiality and integrity of architectures stored in a CALM Hub**: they describe adopters' internal systems, controls and network topology.
3. **The user's workstation and CI environment** when the CLI processes untrusted input.
4. **Repository and publishing credentials**: npm token, Docker Hub credentials, the Actions token, and maintainer accounts.

## Attack surface and threats

### CLI and shared library

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Architecture, pattern and template files passed on the command line | Malicious JSON causes excessive resource use (deeply nested `$ref`, large documents) | Ajv validation with bounded schema resolution; files are parsed, never executed | Low. Denial of service is limited to the invoking process |
| `$ref` and `$schema` URLs in user documents | Server-side request forgery or local file read through a crafted reference | `DirectUrlDocumentLoader` in `shared` accepts only local fragment references and absolute `http(s)` URLs to an allow-listed host (default `calm.finos.org`); filesystem paths and `file://` are rejected. CodeQL `js/request-forgery` findings are triaged for every change | Low |
| Handlebars template bundles used by `template` and `docify` | A template bundle from an untrusted source writes files outside the output directory or embeds active content in generated documents | Output is written relative to the output directory given on the command line; generated Markdown and HTML are documentation and are never executed by the CLI | Medium. A template bundle is effectively code and must be sourced with the same care as a dependency |
| Diagram export (`--export-diagrams`) | Launches a local Chromium via `playwright-core` to render Mermaid; a crafted diagram could exploit the browser | Rendering is local, headless and short-lived; the browser is the user's own installation and receives its own security updates | Low |
| Hub commands (`push`, `pull`, `list`) | The CLI talks to a Hub that is reachable without credentials | The CLI Hub client sends no credentials of its own; a Hub used with the CLI must be fronted by an authenticating proxy (`proxy-auth` mode) or restricted by network controls | Medium. Documented limitation; native CLI authentication is future work |

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
| Container image | Vulnerable base image or bundled dependency | Images are rebuilt on every release; Maven CVE scanning and Renovate keep the Quarkus stack current; Docker images are published with provenance and an SBOM | Low |

### VS Code extension

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Workspace files opened in the editor | Crafted architecture triggers script execution in the preview webview | The webview renders Mermaid produced from the model; VS Code's webview isolation and content-security policy apply | Low |

### Build, release and supply chain

| Entry point | Threat | Mitigation | Residual risk |
|---|---|---|---|
| Pull requests from forks | Malicious workflow changes or code execution with repository secrets | Workflows run with `permissions:` declared per workflow and a read-only default token; secrets are scoped to environments; `pull_request_target` is used only by the labelling workflow, which never checks out or runs pull-request code | Low |
| Third-party GitHub Actions | A compromised action exfiltrates tokens | Every action is pinned to a commit SHA and updated by Renovate; `step-security/harden-runner` audits egress | Low |
| Dependencies (npm, Maven, Cargo) | Known vulnerabilities or malicious packages enter the tree | Dependency Review blocks pull requests that introduce packages with known vulnerabilities of moderate severity or higher, or known-malicious packages; OWASP Dependency-Check, Dependabot and Renovate cover the existing tree; a single root lockfile is validated in CI. See the policy in [SECURITY.md](SECURITY.md) | Low |
| Publishing | An attacker with a stolen token publishes a rogue version | `@finos/calm-cli` and `@finos/calm-server` are published only from the release workflows with `--provenance`, so every version carries a SLSA attestation naming this repository and workflow; Docker images carry provenance and SBOM attestations. Secret scanning and push protection are enabled | Medium. Token theft from a maintainer's environment remains the main residual risk; tokens are rotated on any suspicion |
| Repository | Direct pushes or unreviewed merges to `main` | Ruleset requires a pull request, one approving review, code-owner review, dismissal of stale reviews, and passing required status checks; force pushes and deletion are blocked | Low |

## Out of scope

- Security of the infrastructure an adopter uses to run CALM Hub (network, identity provider, database hardening). Deployment guidance is in `calm-hub/README.md`.
- The AI agent tools in `calm-ai/` are prompts and tool definitions. They execute nothing themselves; the security posture of the agent runtime that loads them belongs to that runtime.
- Experimental components until they are promoted.

## Review

Changes to this document are proposed by pull request. Any pull request that adds an external interface, a new storage backend, a new authentication mode or a new distribution channel must update the relevant table.
