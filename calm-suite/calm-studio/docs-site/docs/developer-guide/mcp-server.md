---
sidebar_position: 2
title: MCP Server for AI Integration
---

# MCP Server for AI Integration

CalmStudio ships a standalone MCP (Model Context Protocol) server that lets AI assistants create, read, update, and render CALM architectures through natural language. Use it with Claude Code, GitHub Copilot, or any MCP-compatible client.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard for AI tools to call structured functions — similar to REST APIs, but designed for AI clients. An MCP server exposes a set of **tools** that an AI assistant can invoke.

CalmStudio's MCP server (`@calmstudio/mcp-server`) exposes 21 tools covering the full lifecycle of CALM architecture management: guide, nodes, relationships, architecture-level operations, views, I/O, rendering, and validation.

## Available Tools

### Guide

| Tool | Description |
|------|-------------|
| `read_calm_guide` | Returns the CALM reference guide: all 9 node types, 5 relationship types, interface types, a complete 3-node example, and usage tips. Start here. |

### Architecture

| Tool | Description |
|------|-------------|
| `create_architecture` | Create an entire architecture in one call — all nodes and relationships at once |
| `describe_architecture` | Get a text summary of all nodes and relationships in a CALM file |

### Nodes

| Tool | Description |
|------|-------------|
| `add_node` | Add a single node to an existing architecture |
| `get_node` | Read a node by its `unique-id` |
| `update_node` | Update node fields (name, description, node-type, interfaces, controls) |
| `delete_node` | Remove a node and any relationships that reference it |
| `query_nodes` | Filter nodes by type, name, or custom predicate |
| `batch_create_nodes` | Create multiple nodes in a single tool call |

### Relationships

| Tool | Description |
|------|-------------|
| `add_relationship` | Add a relationship between two existing nodes |
| `get_relationship` | Read a relationship by its `unique-id` |
| `update_relationship` | Update relationship fields (protocol, description, source, destination) |
| `delete_relationship` | Remove a relationship |

### Views

| Tool | Description |
|------|-------------|
| `create_view` | Create a named view that filters nodes to a C4 zoom level |
| `update_view` | Update an existing view's filter criteria |

### Import / Export

| Tool | Description |
|------|-------------|
| `export_calm` | Export a CALM architecture to a file path |
| `import_calm` | Import and validate a CALM JSON file |

### Render and Validate

| Tool | Description |
|------|-------------|
| `validate_architecture` | Validate a CALM file and return errors and warnings |
| `render_diagram` | Generate an SVG diagram using ELK layout with color-coded node types |

## Setup with Claude Code

Claude Code supports MCP servers via the `.claude/mcp.json` configuration file.

### Install the MCP Server

```bash
# Install as a dev dependency in your architecture repository
npm install --save-dev @calmstudio/mcp-server

# Or install globally
npm install -g @calmstudio/mcp-server
```

### Configure Claude Code

Create or edit `.claude/mcp.json` in your project:

```json
{
  "mcpServers": {
    "calmstudio": {
      "command": "npx",
      "args": ["@calmstudio/mcp-server"]
    }
  }
}
```

If you installed globally, use the binary directly:

```json
{
  "mcpServers": {
    "calmstudio": {
      "command": "calmstudio-mcp"
    }
  }
}
```

Restart Claude Code. The 21 CalmStudio tools will appear in the tool list.

### HTTP Mode

For environments where stdio MCP is not available, run the server in HTTP mode:

```bash
calmstudio-mcp --http --port 3100
```

Then configure your MCP client to connect to `http://localhost:3100`.

## Setup with VS Code + GitHub Copilot

VS Code supports MCP servers in Copilot Chat via the `.vscode/mcp.json` workspace settings file.

### Configure VS Code

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "calmstudio": {
      "type": "stdio",
      "command": "npx",
      "args": ["@calmstudio/mcp-server"]
    }
  }
}
```

Open Copilot Chat (Ctrl+Shift+I / Cmd+Shift+I) and enable MCP servers in the Copilot settings. The CalmStudio tools will appear.

## Usage Examples

### Generate a Microservices Architecture

In Claude Code:

```
Create a CALM architecture for a three-tier web app with a React frontend,
Node.js API, and PostgreSQL database. Save it to architecture.json.
```

Claude Code will call:
1. `read_calm_guide` — load CALM vocabulary
2. `create_architecture` — build the three nodes and two relationships
3. `export_calm` — save to `architecture.json`

### Add AWS Infrastructure

```
Add AWS infrastructure to my existing architecture in arch.json:
VPC containing two subnets (public and private), an ALB in the public subnet,
and the API service deployed in the private subnet. Use deployed-in relationships.
```

Claude Code will call `add_node` and `add_relationship` iteratively.

### Validate and Render

```
Validate architecture.json and render it as an SVG diagram.
```

Claude Code calls `validate_architecture` and then `render_diagram`, returning an SVG you can embed in documentation.

### Query and Update

```
Find all database nodes in architecture.json and add a data-encryption control
to each one with requirement-url pointing to our security policy.
```

Claude Code calls `query_nodes` to find databases, then `update_node` for each.

## How the Server Connects to CalmStudio

The MCP server operates on **CALM JSON files on disk** — it reads and writes `.json` files directly using Node.js `fs`. It does not require the CalmStudio web app to be running.

When you have both the MCP server and CalmStudio studio running simultaneously:

1. AI tools modify the CALM JSON file via MCP tools
2. CalmStudio detects the file change and refreshes the canvas
3. You see the AI-generated changes appear visually in real time

This file-based integration keeps the MCP server stateless and works reliably across all platforms.

## API Reference

The MCP server's tool schemas are defined in `packages/mcp-server/src/types.ts`. See the [API Reference](/docs/api/) for the full `CalmArchitecture`, `CalmNode`, and `CalmRelationship` type documentation.

## Links

- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [MCP SDK for TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
