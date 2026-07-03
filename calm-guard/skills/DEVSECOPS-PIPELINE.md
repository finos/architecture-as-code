# DevSecOps Compliance Pipeline — Skill Guide

## Philosophy

Generate **compliance-first DevSecOps CI pipelines** derived from CALM architecture signals.
Every security stage should map to an architectural decision visible in the CALM document —
protocols, node types, relationships, and controls. Auditors should read the YAML and see
exactly which compliance controls are enforced automatically.

## GitHub Actions Workflow Structure

Generate a SINGLE workflow file with these DevSecOps stages:

```
1. code-quality     — lint + type check (quality gate)
2. unit-test        — fast unit tests
3. sast             — Static Application Security Testing (Semgrep/CodeQL)
4. secret-detection — detect leaked secrets/credentials (gitleaks/trufflehog)
5. sca              — Software Composition Analysis / dependency audit (Trivy/npm-audit)
6. sbom             — generate Software Bill of Materials (syft/cyclonedx)
7. build            — build artifacts (final gate)
```

### Stage Selection Rules (based on CALM signals)

Not every architecture needs every stage. Select based on what CALM tells you:

| CALM Signal | Required Stages |
|-------------|----------------|
| ANY architecture | secret-detection (always), sast (always), build (always) |
| Has `database` nodes | sast with SQL injection rules |
| Has `webclient` nodes | sast with XSS/CSRF rules |
| Uses HTTP (not HTTPS) | Add comment: "WARNING: unencrypted protocol detected" |
| Has `service` nodes | sca (dependency scanning) |
| Compliance controls present | sbom (for audit trail) |
| Has external `ecosystem` nodes | sca (supply chain risk) |

### Workflow Constraints

- 40-60 lines of YAML max
- Triggers: push and pull_request to main
- All security stages run in parallel (after code-quality)
- Build runs last (depends on security stages passing)
- DO NOT generate: deployment, staging, production, Docker, K8s, notifications, caching

## Security Scanning Tool Configs

Generate configs for 2-3 tools. Keep each config 10-20 lines.

| Tool | Purpose | When to Include |
|------|---------|-----------------|
| Semgrep | SAST — code patterns (SQL injection, XSS, insecure crypto) | Always |
| Trivy | SCA — container and dependency vulnerabilities | When service/database nodes present |
| npm-audit | SCA — Node.js dependency vulnerabilities | When webclient nodes present |
| CodeQL | SAST — language-specific vulnerability detection | Alternative to Semgrep for complex architectures |

DO NOT include tools that don't map to CALM architectural signals.

## Infrastructure as Code — Security-Focused Terraform

Generate minimal Terraform showing security controls that map to CALM:

- Provider block
- Security group with rules derived from CALM protocol requirements:
  - HTTPS relationships → allow 443, deny 80
  - Database connections → restrict to service CIDR only
  - mTLS relationships → reference certificate resources
- 1 network resource (VPC or subnet) showing segmentation

Keep to 20-40 lines. This demonstrates compliance-as-code, not full infrastructure.

## Recommendations — 3-4 Max

Each recommendation MUST:
- Reference a specific CALM architectural signal (node, protocol, relationship)
- Map to a compliance framework (SOX, PCI-DSS, NIST-CSF, etc.)
- Be actionable as a pipeline stage or config change

## Formatting Rules

- All YAML/HCL strings MUST contain real newline characters
- Use 2-space indentation
- Add brief comments on security-critical lines (e.g., "# PCI-DSS: encrypt data in transit")
- No markdown fencing in output strings
