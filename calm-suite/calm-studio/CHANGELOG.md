# Changelog

All notable changes to CalmStudio will be documented in this file.

## [0.9.0] - 2026-03-15

### Added

- **FluxNova BPM Extension Pack** — 10 node types (Platform, Core Engine, Connectors, REST API, BPM Engine, Task Manager, Admin Dashboard, Workers, Modeler, Process Data Store) with hand-crafted SVG icons in orange/amber color family. Platform node supports container/containment.
- **Architecture Template System** — Full-screen template picker modal with category tabs, accessible from toolbar button and empty canvas "Start from a template" link. Dirty state confirmation before loading.
- **6 FluxNova Templates** — Platform, KYC Onboarding, Flash Risk Management, Post-Trade Settlement, AI Agent Orchestration, and Microservices Orchestration blueprints ready to load.
- **CALM 1.2 Controls Support** — Controls, decorators, and evidence types added to calm-core. Controls section visible and editable in both NodeProperties and EdgeProperties panels.
- **Data Classification Badges** — Colored pills on canvas nodes showing PII (red), Confidential (amber), and Public (green) classifications at a glance.
- **AIGF Governance Panel** — Right sidebar "Governance" tab showing applicable risks and mitigations for selected AI nodes. "Apply mitigation" adds CALM controls directly. Severity badges (OP=amber, SEC=red, RC=blue) with external framework references (EU AI Act, ISO 42001, OWASP LLM Top 10).
- **AIGF Risk Catalogue** — 23 risks and 23 mitigations from FINOS AIGF v2.0, with node-type-to-risk mappings for 13 AI node types.
- **Governance Score** — Live architecture-level governance score as colored toolbar badge (green >80%, amber 50-80%, red <50%). Hidden when architecture has no AI nodes. Updates instantly when controls are applied or removed.
- **AIGF Validation Rules** — 10 governance validation rules integrated into the existing ValidationPanel alongside structural rules.
- **AIGF Decorator Export** — CALM JSON export automatically generates an AIGF governance decorator summarizing assessed risks, applied controls, governance score, and regulatory framework mappings.
- **Template Metadata Stripping** — `_template` metadata automatically removed from CALM JSON exports.

### Changed

- **NodePalette Pack Order** — FluxNova BPM and AI/Agentic packs now appear right after core CALM types, before cloud provider packs.
- **C4 Edge Lifting and Empty State** — C4 views now show edge lifting and empty states for better navigation.

## [0.8.0] - 2026-03-13

### Added

- **C4 View Mode** — Hierarchical zoom over CALM data using containment relationships (Context, Container, Component views with drill-down).
- **Extension Pack System** — Pluggable node type packs with pack registry, icon system, and palette integration (AWS 34, GCP 15, Azure 15, Kubernetes 14, AI/Agentic 14).
- **CALM Validation** — On-demand structural validation with schema checking, orphan detection, and severity-sorted results in a bottom drawer panel.
- **MCP Server** — Model Context Protocol server for AI-assisted architecture generation via Claude Code.
- **Import/Export** — CALM JSON import/export with File System Access API, ELK auto-layout (top-to-bottom/left-to-right), pin toggle for layout control.
- **Properties Panel** — Bidirectional sync between canvas, properties panel, and CALM JSON code editor with debounced updates.
- **CALM Canvas Core** — Visual graph editor with typed nodes, edge drawing, containment, undo/redo, clipboard, and dark mode.
