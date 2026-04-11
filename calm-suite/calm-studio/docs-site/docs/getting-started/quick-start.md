---
sidebar_position: 1
title: Quick Start (5 minutes)
---

# Quick Start (5 minutes)

Get CalmStudio running and draw your first CALM architecture diagram in under 5 minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 9 or later (`npm install -g pnpm`)
- Git

## Step 1: Clone and Install

```bash
git clone https://github.com/finos/calmstudio.git
cd calmstudio
pnpm install
```

`pnpm install` sets up the entire monorepo — studio app, packages, and dev dependencies — in one command. This takes about 30–60 seconds on first run.

## Step 2: Start the Dev Server

```bash
pnpm dev
```

This starts the SvelteKit dev server. You will see output like:

```
  VITE v5.x.x  ready in 800 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Step 3: Open CalmStudio in Your Browser

Navigate to [http://localhost:5173](http://localhost:5173).

You will see the CalmStudio interface: a large canvas area in the centre, a node palette on the left, and a CALM JSON editor panel on the right.

![CalmStudio interface showing canvas, palette, and JSON editor](/img/calmstudio01.png)

**Canvas area** — the main diagram workspace where you drag, connect, and arrange nodes.

**Node palette (left)** — all available node types grouped by pack: CALM Core, AWS, GCP, Azure, Kubernetes, AI/Agentic, and FluxNova.

**CALM JSON editor (right)** — the raw CALM 1.2 JSON that backs the diagram. Edits here update the canvas; canvas edits update this JSON automatically.

## Step 4: Drag Nodes onto the Canvas

1. In the left palette, find the **CALM Core** section.
2. Click and drag an **Actor** node onto the canvas.
3. Drag a **Service** node onto the canvas next to it.
4. Drag a **Database** node to the right of the service.

Each node automatically gets a `unique-id`, `node-type`, `name`, and `description` in the CALM JSON. You can see the JSON update live in the right panel.

## Step 5: Connect Nodes with Edges

1. Hover over the Actor node until you see small blue **handles** appear on its edges.
2. Click and drag from a handle on the Actor to the handle on the Service node.
3. A **connects** relationship is created. You will see it appear in the JSON editor.
4. Connect the Service to the Database in the same way.

Relationships in CALM have a type (`connects`, `interacts`, `deployed-in`, `composed-of`, or `options`). You can change the relationship type in the **Properties panel** that appears when you select an edge.

## Step 6: Edit Node Properties

Click on any node to open the **Properties panel** on the right. You can edit:

- **Name** — the human-readable label
- **Description** — what this component does
- **Node type** — change the CALM node type
- **Interfaces** — add URL endpoints, host-port pairs, or container images

Changes sync immediately to the CALM JSON.

## Step 7: Export as CALM JSON

When your diagram is ready:

1. Open the **File menu** (top toolbar).
2. Select **Export → CALM JSON**.
3. Save the `.json` file to your project.

The exported file is valid CALM 1.2 JSON that you can check into version control, validate with the CALM CLI, or use with AI tools via the MCP server.

## What You Just Built

You created a minimal 3-node architecture:

```json
{
  "nodes": [
    { "unique-id": "actor-1", "node-type": "actor", "name": "Actor", "description": "..." },
    { "unique-id": "service-1", "node-type": "service", "name": "Service", "description": "..." },
    { "unique-id": "database-1", "node-type": "database", "name": "Database", "description": "..." }
  ],
  "relationships": [
    {
      "unique-id": "actor-to-service",
      "relationship-type": "connects",
      "source": "actor-1",
      "destination": "service-1",
      "protocol": "HTTPS"
    },
    {
      "unique-id": "service-to-db",
      "relationship-type": "connects",
      "source": "service-1",
      "destination": "database-1",
      "protocol": "TCP"
    }
  ]
}
```

This is a complete, valid CALM 1.2 architecture file.

## Next Steps

- **[Architecture Overview](../user-guide/architecture-overview.md)** — learn all CalmStudio features: C4 view mode, auto-layout, governance scoring, and import/export
- **[Extension Packs](../developer-guide/extension-packs.md)** — add AWS, GCP, Azure, Kubernetes, and AI node types, or create your own pack
- **[MCP Server](../developer-guide/mcp-server.md)** — use Claude Code or GitHub Copilot to generate CALM architectures with AI
- **[Contributing](../developer-guide/contributing.md)** — contribute to CalmStudio
