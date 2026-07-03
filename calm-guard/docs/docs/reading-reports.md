---
sidebar_position: 4
title: Reading Reports
---

# Reading Reports

CALMGuard's dashboard presents analysis results across multiple panels, each providing a different lens on your architecture's compliance posture.

## Dashboard Overview

When analysis completes, the dashboard shows:

```
┌─────────────────┬──────────────────────────────┬──────────────────┐
│  Compliance     │  Architecture Graph           │  Agent Feed      │
│  Score Gauge    │                               │                  │
├─────────────────┤  Nodes with compliance colors │  Live streaming  │
│  Framework      │  connected by relationships   │  agent events    │
│  Breakdown      │                               │  and findings    │
├─────────────────┴──────────────────────────────┤                  │
│  Risk Heat Map  │  Control Matrix               │                  │
│                 │                               │                  │
├─────────────────┴──────────────────────────────┴──────────────────┤
│  Findings Table (sortable, filterable by severity/framework)       │
├──────────────────────────────────────────────────────────────────  │
│  Pipeline Preview (generated GitHub Actions + Security scanning)   │
└────────────────────────────────────────────────────────────────────┘
```

## Compliance Score Gauge

The **compliance score gauge** displays your overall compliance score from 0 to 100.

| Score Range | Status | Color |
|-------------|--------|-------|
| 80-100 | Compliant | Emerald (green) |
| 50-79 | Partially Compliant | Amber (yellow) |
| 0-49 | Non-Compliant | Red |

The gauge animates as the Risk Scorer agent calculates the final score. Below the gauge, a **framework breakdown** shows per-framework scores:

- **SOX** — Sarbanes-Oxley financial controls
- **PCI-DSS** — Payment Card Industry Data Security Standard
- **NIST-CSF** — NIST Cybersecurity Framework
- **FINOS-CCC** — FINOS Common Cloud Controls

You can **filter frameworks** using the framework selector to focus on specific regulatory requirements.

## Architecture Graph

The **architecture graph** visualizes your CALM document as an interactive node graph.

### Node Colors

Each node is colored by its compliance risk level:

| Border Color | Risk Level | Meaning |
|-------------|------------|---------|
| Emerald | Low | No significant compliance gaps |
| Amber | Medium | Some gaps, review recommended |
| Red | High/Critical | Immediate attention required |

### Node Types

Icons and shapes indicate the CALM node type:

- Actor (person icon) — humans or external systems
- Service (gear icon) — microservices and applications
- Database (cylinder icon) — data stores
- Network (network icon) — network infrastructure
- WebClient (browser icon) — front-end clients

### Trust Boundaries

`deployed-in` and `composed-of` relationships render as **trust boundary boxes** — dashed containers grouping related nodes. These represent logical or physical deployment boundaries (e.g., VPC, datacenter, cloud region).

### Interaction

The graph is **read-only** (nodes are not draggable). The auto-layout algorithm (dagre) positions nodes for optimal readability. Hover over nodes to see tooltips with node details.

## Risk Heat Map

The **risk heat map** shows compliance risk across nodes and frameworks in a grid:

- **Rows**: Architecture nodes
- **Columns**: Compliance frameworks (SOX, PCI-DSS, NIST-CSF, FINOS-CCC)
- **Cell colors**: Same emerald/amber/red scale as the graph

This matrix view makes it easy to spot which nodes have issues with which frameworks — for example, a database node may be high-risk for PCI-DSS but low-risk for NIST-CSF.

## Control Matrix

Below the heat map, the **control matrix** shows individual control requirements:

| Control ID | Description | Framework | Status |
|------------|-------------|-----------|--------|
| pci-req-3 | Protect stored cardholder data | PCI-DSS | Partial |
| sox-802 | Financial record retention | SOX | Compliant |

Filter by framework or compliance status using the dropdowns.

## Findings Table

The **findings table** is the most actionable panel — it shows specific compliance gaps with recommendations.

### Columns

| Column | Description |
|--------|-------------|
| Severity | Critical / High / Medium / Low / Info |
| Framework | Which compliance framework the finding applies to |
| Node | Which architecture node is affected |
| Finding | Description of the compliance gap |
| Recommendation | Suggested remediation step |

### Severity Levels

| Level | Color | Action |
|-------|-------|--------|
| Critical | Red | Immediate remediation required |
| High | Orange | Fix before next release |
| Medium | Amber | Address in current sprint |
| Low | Blue | Schedule for backlog |
| Info | Gray | Informational, no action required |

### Filtering

Use the severity dropdown to filter findings by priority. The table is sorted by severity (critical first) by default.

## Pipeline Preview

The **pipeline preview** shows auto-generated CI/CD configuration based on your architecture.

CALMGuard's Pipeline Generator agent produces:

- **GitHub Actions workflows** — security scanning pipeline (`.github/workflows/security.yml`)
- **Trivy configuration** — container and filesystem vulnerability scanning
- **OWASP ZAP** — dynamic application security testing
- **Secrets scanning** — detect credentials in source code

Toggle between configuration formats using the tab selector. The YAML syntax is highlighted for readability.

### Using the Generated Pipeline

Copy the generated YAML to your repository's `.github/workflows/` directory. The pipeline is pre-configured for your specific architecture — for example, if your architecture includes a database, the pipeline includes SQL injection scanning; if it includes APIs, it includes API fuzzing.

## Agent Feed

The **Agent Feed** (right sidebar) shows the live stream of agent events as analysis runs:

| Event Type | Description |
|------------|-------------|
| Started | Agent begins execution |
| Thinking | Agent processing — intermediate reasoning |
| Finding | A specific compliance finding discovered |
| Completed | Agent finished successfully |
| Error | Agent encountered an error |

The feed persists after analysis completes so you can review what each agent found and in what order.
