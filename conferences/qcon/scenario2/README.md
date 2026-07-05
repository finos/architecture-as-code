# Scenario 2: MCP with CALM Control-Based Guardrails

This scenario demonstrates how to deploy a Model Context Protocol (MCP) server with security controls defined in CALM architecture and enforced through Kubernetes ConfigMaps.

## Key Features

- **CALM Controls**: MCP Guardrail control defines denied trading symbols
- **Control-to-Config Pipeline**: Control configuration automatically generates Kubernetes ConfigMaps
- **Network Policies**: Kubernetes network policies restrict traffic between services
- **Infrastructure as Code**: All infrastructure generated from CALM architecture

## Architecture

The architecture includes:
- **MCP Server**: Exposes tools for querying trade data with symbol restrictions
- **Trades API**: REST API for trade data
- **MCP Guardrail Control**: Located in `calm/controls/`, defines denied trading symbols (VOD, GME, AMC)
- **Network Policies**: Kubernetes network policies for micro-segmentation

## 1. Run the Demo

**Prerequisite**: Scenario 1 must be running and port-forwarding must be active.

The `demo.sh` script will:
1. Verify the existing deployment (requires Scenario 1 to be running)
2. Display the MCP Guardrail control configuration and its linkage in the architecture
3. Generate Kubernetes manifests from the CALM architecture using `calm template`
4. Show the generated `denied-symbols-configmap.yaml` produced from the control
5. Apply the updated configuration and restart the MCP server deployment
6. Wait for the rollout to complete and verify deployment

```bash
./demo.sh
```

**Port-forwarding** from Scenario 1 must remain active in a separate terminal. If it dropped, restart it:

```bash
cd ../scenario1 && ./port-forward.sh
```

Services are available at:
- MCP Server: http://localhost:8080
- Trades API: http://localhost:8081

## 2. Understanding the Control Pipeline

### Control Definition

The MCP Guardrail control is defined in two files:

**`calm/controls/mcp-guardrail.requirement.json`**: Defines the schema
```json
{
  "control-id": "mcp-001",
  "name": "MCP Trading Symbol Restriction",
  "denied-symbols": ["type": "array"],
  "enforcement-point": "string"
}
```

**`calm/controls/mcp-guardrail.config.json`**: Provides the actual configuration
```json
{
  "control-id": "mcp-001",
  "denied-symbols": ["VOD", "GME", "AMC"],
  "enforcement-point": "mcp-server"
}
```

### Control to ConfigMap

The `bundle/trades-transformer.js` reads the control configuration and extracts the denied symbols:

1. Reads `calm/controls/mcp-guardrail.config.json`
2. Extracts the `denied-symbols` array
3. Converts to comma-separated string: `"VOD,GME,AMC"`
4. Injects into `denied-symbols-configmap.yaml` template

The MCP server deployment then mounts this ConfigMap as the `DENIED_SYMBOLS` environment variable.

## 3. Connecting Claude to the MCP Server

Port-forwarding from `scenario1/port-forward.sh` must be active:
- **MCP Server**: http://localhost:8080
- **Trades API**: http://localhost:8081

To expose the MCP server to Claude, create a public tunnel with ngrok in a new terminal:

```bash
ngrok http 8080
```

`ngrok` will provide you with a public HTTPS URL (e.g., `https://<unique-id>.ngrok-free.app`). Use this URL as the MCP server endpoint in Claude.

**Note**: The MCP server will reject queries for denied symbols (VOD, GME, AMC) based on the control configuration.

## 4. Modifying the Control

To update the denied symbols:

1. Edit `calm/controls/mcp-guardrail.config.json`
2. Modify the `denied-symbols` array (e.g., add `"TSLA"`)
3. Press Ctrl+C to stop the running demo.sh
4. Run `./demo.sh` again to regenerate and apply the updated configuration

The new ConfigMap will be automatically generated from your control changes!
