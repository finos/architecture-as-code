# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-25

### Added

#### GitOps PR Generation
- GitHub repository integration — fetch CALM files from any public/private repo
- Three-button GitOps workflow: DevSecOps CI, Compliance Remediation, Cloud Infrastructure PRs
- GitHub client library with branch creation, file commit, and PR generation
- SHA tracking on all generated PRs for auditability
- Tab-based architecture selector (Upload, GitHub, Demo)

#### Compliance Intelligence
- SOC2 Trust Service Criteria skill file (21 controls: CC6.x, CC7.x, CC8.x, CC9.x)
- PROTOCOL-SECURITY skill file with upgrade mappings (HTTP→HTTPS, FTP→SFTP, JDBC→TLS) grounded in PCI-DSS, NIST-CSF, SOC2
- DEVSECOPS-PIPELINE skill file for compliance-first CI generation
- Closed Control ID Reference tables in PCI-DSS and NIST-CSF skills to prevent LLM hallucination
- SOC2 as fifth compliance framework wired into analysis pipeline

#### Self-Learning Engine
- Compliance pattern extraction after every analysis (structural fingerprinting)
- Confidence tracking with observation count across runs
- Auto-promotion: patterns observed 3+ times at 75%+ confidence become deterministic rules
- Oracle agent (Phase 0) fires promoted rules instantly — zero LLM latency
- Learning Intelligence dashboard with Recharts visualization of intelligence growth
- Deterministic Rules deck with promotion progress indicators

#### Cloud Infrastructure Generation
- Cloud Infra Generator agent — maps CALM nodes to AWS Terraform (VPC, ECS, RDS, IAM, Security Groups)
- CLOUD-INFRASTRUCTURE skill file for AWS resource mapping
- CALM-to-Terraform traceability for every generated resource
- Runs in Phase 1 parallel alongside Scout, Ranger, and Arsenal

#### CALM Remediator
- Programmatic change application engine (`applyChangesToCalm`) — LLM identifies gaps, deterministic code applies fixes
- Protocol strength ordering prevents downgrades (HTTP=0 → mTLS=5)
- Preserves all existing controls during remediation (no stripping)
- Zod `.min(1)` validation ensures LLM always produces actionable changes

#### Multi-Version CALM Support
- Automatic version detection for CALM v1.0, v1.1, v1.2
- Legacy type mapping (v1.0 `apigateway`→`service`, `uses`→`connects`)
- Version badge on dashboard with node/relationship counts

#### Dashboard Enhancements
- Visual pipeline stage diagram with vertical flow and split-screen layout
- Agent squad callsigns (HQ, Oracle, Scout, Ranger, Arsenal, Sniper)
- Squad page with agent profiles, skills, and execution flow
- Dedicated Learning Intelligence page
- Oracle pre-check findings collapsed into single summary (reduced UI noise)
- Cloud Infra Generator findings collapsed into single summary

#### Documentation
- 12-phase product roadmap from hackathon prototype to enterprise platform
- Remediation before/after proof with real CALM repository links
- Comprehensive agent system documentation with 6-agent squad architecture

### Fixed

- Remediation PRs now programmatically apply changes instead of trusting LLM JSON output
- Oracle pre-check findings collapsed from N events to single summary
- Cloud Infra Generator findings collapsed from N events to single summary
- Semgrep SAST `unsafe-formatstring` resolved with `%d` format specifiers
- Prevent double-normalization of v1.0 CALM documents
- Learning engine confidence grows with observations, not dilutes with runs
- CI workflow uses `packageManager` field instead of hardcoded pnpm version
- Added `.npmrc` for pnpm 10 registry auth compatibility in GitHub Actions

## [1.1.0] - 2026-02-24

### Added

#### CALM Parser & Validation
- Full CALM 1.1 schema support with Zod runtime validation
- Node types: actor, ecosystem, system, service, database, network, ldap, webclient, data-asset
- Relationship types: interacts, connects, deployed-in, composed-of, options
- Flow and interface parsing with control extraction
- Two demo architectures: Payment Gateway and Trading Platform

#### AI Agent System
- Architecture Analyzer agent — evaluates patterns, anti-patterns, severity-scored findings
- Compliance Mapper agent — maps CALM controls to regulatory frameworks with gap analysis
- Pipeline Generator agent — generates CI/CD configs, SAST/DAST, IaC
- Risk Scorer agent — aggregates findings into weighted risk scores with heat map data
- YAML-based agent definitions (AOF-inspired) in `agents/`
- Multi-provider LLM support: Google Gemini (default), Anthropic Claude, OpenAI GPT, xAI Grok
- Vercel AI SDK `generateObject` with Zod schemas for all structured outputs
- Phase 1 parallel orchestration (Analyzer + Mapper + Pipeline Gen) + Phase 2 sequential (Risk Scorer)

#### Compliance Knowledge
- NIST Cybersecurity Framework (CSF) skill file (23.4 KB)
- PCI DSS compliance skill file
- SOX financial reporting compliance skill file
- FINOS Common Cloud Controls (CCC) skill file

#### Real-Time Dashboard
- SSE-based streaming from agents to dashboard via EventSource
- Zustand single-store state management
- React Flow interactive architecture graph with custom node types per CALM node-type
- Dagre auto-layout for architecture visualization
- Touring camera animation with node info overlay during analysis
- Pause/play controls for touring camera
- Compliance score gauges and risk heat maps (Recharts)
- Agent squad status sidebar with running/completed indicators
- Pipeline preview with fullscreen mode and syntax highlighting (Shiki)
- Exportable compliance report modal
- Demo mode — run analysis with sample data, no API keys required

#### Infrastructure & CI/CD
- Next.js 15 App Router with Turbopack dev server
- GitHub Actions CI: lint, typecheck, test, build, dependency audit, license check
- Semgrep SAST scanning workflow
- Husky pre-commit hooks with ESLint auto-fix (zero warnings policy)
- Docusaurus documentation site with Mermaid diagram support

### Security

- Zod schema validation on all external inputs (CALM JSON, LLM outputs)
- Structured LLM output only (`generateObject`) — no raw text injection surface
- TypeScript strict mode with zero `any` types
- GPL/AGPL dependency license blocking via `license-checker`
- Semgrep static analysis in CI
- HTTPS-only transport, same-origin SSE policy
- Zero data persistence — no user data stored server-side
- Comprehensive threat model documented in SECURITY.md

## [0.1.0] - 2026-02-09

### Added

- Initial project scaffold with Next.js 15 and TypeScript strict mode
- shadcn/ui component library setup with dark theme
- Basic project structure and configuration

[1.3.0]: https://github.com/finos-labs/dtcch-2026-opsflow-llc/compare/v1.1.0...v1.3.0
[1.1.0]: https://github.com/finos-labs/dtcch-2026-opsflow-llc/compare/v0.1.0...v1.1.0
[0.1.0]: https://github.com/finos-labs/dtcch-2026-opsflow-llc/releases/tag/v0.1.0
