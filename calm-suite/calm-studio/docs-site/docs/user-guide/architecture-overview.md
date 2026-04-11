---
sidebar_position: 1
title: Architecture Overview
---

# Architecture Overview

CalmStudio is a visual editor for [CALM](https://calm.finos.org/release/1.2/) (Common Architecture Language Model) architectures. It lets you draw diagrams visually and get valid, machine-readable CALM 1.2 JSON automatically — or import existing CALM JSON and get an editable diagram. Architecture becomes the source of truth.

## What is CALM?

CALM is a FINOS open-source specification for describing software architectures as structured JSON. A CALM document contains:

- **Nodes** — architectural components (services, databases, actors, networks, etc.)
- **Relationships** — how components connect or contain each other
- **Controls** — security and compliance requirements attached to individual components

CalmStudio is a visual editor for CALM documents. Every visual change produces valid CALM JSON; every JSON edit is reflected visually.

## The Interface

![CalmStudio interface showing the canvas, node palette, and CALM JSON editor](/img/calmstudio01.png)

CalmStudio has three main areas:

| Area | Location | Purpose |
|------|----------|---------|
| Node palette | Left sidebar | Drag node types onto the canvas |
| Canvas | Centre | Visual diagram workspace |
| CALM JSON editor | Right panel | Raw CALM 1.2 JSON (bidirectional sync) |
| Properties panel | Right panel (context) | Edit selected node or relationship properties |
| Toolbar | Top | File, layout, view, and export actions |

<!-- TODO: capture annotated screenshots for each panel once the UI is finalised -->

## Core Concepts

### Node Types

CALM 1.2 defines 9 built-in node types:

| Type | Description | Typical use |
|------|-------------|-------------|
| `actor` | Human user or external system | End users, administrators, third-party systems |
| `ecosystem` | Logical grouping of systems | Cloud region, Kubernetes cluster, organisation boundary |
| `system` | Bounded software system | Application, platform, product |
| `service` | Independently deployable microservice | API, background worker, function |
| `database` | Persistent data store | PostgreSQL, Redis, S3, MongoDB |
| `network` | Network boundary or zone | VPN, load balancer, CDN, firewall |
| `ldap` | LDAP directory service | Active Directory, LDAP identity provider |
| `webclient` | Browser-based frontend | Web application, SPA |
| `data-asset` | Named data entity or dataset | S3 objects, data streams, files |

Extension packs (see below) add dozens more types for AWS, GCP, Azure, Kubernetes, AI/Agentic systems, and FluxNova.

### Relationship Types

Relationships describe how nodes are connected or structured:

| Type | Meaning | Example |
|------|---------|---------|
| `connects` | Communication channel | Service calls database over HTTPS |
| `interacts` | Human actor interaction | User interacts with web client |
| `deployed-in` | Deployment containment | Service deployed in Kubernetes cluster |
| `composed-of` | Structural containment | Platform composed of microservices |
| `options` | Alternative implementations | Option A or Option B for storage |

Relationships carry protocol information (`HTTP`, `HTTPS`, `gRPC`, `TCP`, `mTLS`, etc.) and source/destination node references.

### Controls

Controls attach security and compliance requirements to individual nodes or relationships. Each control has:

- A **domain-oriented key** (e.g., `data-encryption`, `edge-protection`) — not framework-prefixed
- A **description** of what it enforces
- One or more **requirements** with a `requirement-url` pointing to a policy document
- Optional `config-url` and `config` for framework-specific mapping (e.g., AIGF AIR-IDs)

Controls in CalmStudio appear as badges on nodes and can be edited in the Properties panel.

## Canvas Features

### Drag-and-Drop Editing

The canvas is built on [Svelte Flow](https://svelteflow.dev/) (the Svelte port of React Flow). You can:

- **Drag** nodes from the palette to create them
- **Move** nodes by dragging
- **Resize** container nodes (ecosystem, network, VPC, etc.) by dragging corners
- **Select multiple** nodes with a lasso drag or Shift+click
- **Zoom and pan** with scroll wheel or trackpad gestures
- **Double-click** a node to open inline label editing

### Bidirectional Sync

Every edit on the canvas is immediately reflected in the CALM JSON editor, and vice versa. This bidirectional sync means:

- Visual designers work in the canvas
- Engineers work in the JSON editor
- Both views are always in sync — there is no "save" step between them

The sync is powered by Svelte 5 runes: the CALM document is a single reactive store, and both the canvas and the JSON editor are views over it.

### Properties Panel

Clicking a node or relationship opens the Properties panel. You can edit:

- Name and description
- Node type (changes the visual badge and CALM type field)
- Interfaces (URL endpoints, host-port pairs, container images, port numbers)
- Controls (add, edit, or remove security requirements)
- Custom metadata fields

## Extension Packs

CalmStudio ships 7 built-in extension packs, giving you 60+ additional node types beyond the 9 CALM core types:

| Pack | Node types | Examples |
|------|-----------|---------|
| **CALM Core** | 9 | Actor, Service, Database, Network |
| **AWS** | 33 | Lambda, EC2, S3, DynamoDB, VPC, EKS, RDS, CloudFront, SQS |
| **GCP** | ~20 | Cloud Run, BigQuery, Pub/Sub, GKE, Cloud SQL |
| **Azure** | ~20 | App Service, Cosmos DB, Service Bus, AKS, Blob Storage |
| **Kubernetes** | ~15 | Pod, Deployment, Service, Ingress, ConfigMap, Namespace |
| **AI/Agentic** | ~10 | LLM, AI Agent, Vector Store, Tool, MCP Server |
| **FluxNova** | ~10 | FluxNova Engine, Connector, Workflow, Topic |

You can also create custom packs. See [Extension Packs](../developer-guide/extension-packs.md).

## C4 View Mode

CalmStudio supports C4 hierarchical zoom levels using CALM's containment relationships (`deployed-in`, `composed-of`):

| C4 Level | Zoom | What is shown |
|----------|------|--------------|
| **Context** | Highest | Systems and their external actors only |
| **Container** | Mid | Containers inside each system |
| **Component** | Lowest | Components inside each container |

Switch between levels using the **View** menu in the toolbar. CalmStudio filters the visible nodes based on the CALM containment relationships in your document — no separate diagram needed for each level.

## Governance: AIGF Scoring

CalmStudio integrates the [FINOS AI Governance Framework (AIGF)](https://air-governance-framework.finos.org/) for AI system architectures. When your diagram contains AI nodes (LLM, AI Agent, Vector Store, etc.), CalmStudio can:

- Score your architecture against **23 AIGF risk categories**
- Surface **23 corresponding mitigations** from the AIGF catalogue
- Show a governance scorecard in the sidebar
- Suggest controls to attach to AI nodes

Governance scoring is opt-in — use the **Governance** panel to trigger a scan.

## Auto-Layout

CalmStudio uses [ELK.js](https://eclipse.dev/elk/) for automatic diagram layout. Three presets are available:

| Preset | Algorithm | Best for |
|--------|-----------|---------|
| **Hierarchical LR** | ELK Layered, left-to-right | Service dependency diagrams |
| **Hierarchical TB** | ELK Layered, top-to-bottom | Traditional architecture diagrams |
| **Force-directed** | ELK Force | Exploratory diagrams with many nodes |

Auto-layout respects CALM containment relationships — ecosystem and network containers are laid out with their children inside them.

Trigger re-layout from **Diagram → Auto-layout** in the toolbar.

## Import and Export

| Format | Import | Export |
|--------|--------|--------|
| CALM JSON (`.json`, `.calm.json`) | Yes | Yes |
| SVG | No | Yes |
| PNG | No | Yes |

Import a CALM JSON file to start from an existing architecture (e.g., one generated by the MCP server or CALM CLI). Export lets you save the canonical CALM JSON, or render the diagram as a PNG for documentation.

## MCP Server Integration

CalmStudio ships a standalone MCP server (`@calmstudio/mcp-server`) that lets AI tools like Claude Code and GitHub Copilot create and modify CALM architectures programmatically. The server exposes 21 tools covering node CRUD, relationship management, rendering, and validation.

See [MCP Server](../developer-guide/mcp-server.md) for setup and usage.

## FINOS CALM Ecosystem

CalmStudio is part of the [FINOS Architecture-as-Code](https://github.com/finos/architecture-as-code) ecosystem:

- **CALM spec**: [calm.finos.org/release/1.2/](https://calm.finos.org/release/1.2/)
- **CALM CLI**: Validate, lint, and generate from CALM documents
- **CALM Hub**: Community registry of published CALM architectures
- **CalmStudio**: Visual editor (this project)
