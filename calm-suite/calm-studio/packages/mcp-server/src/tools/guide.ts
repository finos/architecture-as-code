// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolSuccess, type ToolResponse } from '../types.js';

const ReadCalmGuideSchema = z.object({
  topic: z.string().optional()
});

// ---------------------------------------------------------------------------
// Static CALM reference content
// ---------------------------------------------------------------------------

const CALM_GUIDE = `
# CALM Architecture Reference Guide

## Node Types (9 types)

- **actor**: A human user or external system that interacts with the architecture. Use for end users, administrators, or third-party systems.
- **system**: A software system or application. The primary building block — represents a bounded context or deployable unit.
- **service**: A microservice or API service within a system. More granular than "system" — lives inside a system boundary.
- **database**: A data storage component (relational DB, NoSQL, cache, etc.). Use for PostgreSQL, Redis, MongoDB, etc.
- **network**: A network-level component (load balancer, VPN, firewall, CDN). Use for infrastructure network elements.
- **webclient**: A browser-based client application. Distinguishes web UIs from other actor types.
- **ecosystem**: A collection of systems or a cloud environment (e.g., "AWS region", "Kubernetes cluster"). Container for grouping.
- **ldap**: An LDAP directory or identity provider. Specialized type for auth services like Active Directory, LDAP.
- **data-asset**: A data entity or dataset (files, S3 buckets, data streams). Use for data at rest or in motion.

## Relationship Types (5 types)

- **connects**: A direct connection or communication channel (HTTP, gRPC, TCP, etc.). The most common relationship.
- **interacts**: A human actor interacting with a system (e.g., user -> web app). Use for person-to-system interactions.
- **deployed-in**: Deployment containment — a service deployed inside a system/ecosystem (e.g., service deployed-in kubernetes).
- **composed-of**: Structural containment — a system composed of sub-systems (e.g., platform composed-of services).
- **options**: An alternative relationship showing multiple possible implementations or variants.

## Interface Types

- **url**: A URL endpoint (e.g., "https://api.example.com/v1")
- **host-port**: A host and port pair (e.g., "db.internal:5432")
- **container-image**: A container image reference (e.g., "nginx:1.25-alpine")
- **port**: A network port number (e.g., "8080")

## Complete Example (3 nodes, 2 relationships)

\`\`\`json
{
  "nodes": [
    {
      "unique-id": "user-browser",
      "node-type": "webclient",
      "name": "User Browser",
      "description": "End user accessing the web application",
      "interfaces": [
        { "unique-id": "ui-url", "type": "url", "value": "https://app.example.com" }
      ]
    },
    {
      "unique-id": "api-server",
      "node-type": "service",
      "name": "REST API",
      "description": "Backend REST API service",
      "interfaces": [
        { "unique-id": "api-endpoint", "type": "url", "value": "https://api.example.com/v1" }
      ]
    },
    {
      "unique-id": "postgres-db",
      "node-type": "database",
      "name": "PostgreSQL",
      "description": "Primary relational database",
      "interfaces": [
        { "unique-id": "db-port", "type": "host-port", "value": "postgres:5432" }
      ]
    }
  ],
  "relationships": [
    {
      "unique-id": "browser-to-api",
      "relationship-type": "connects",
      "source": "user-browser",
      "destination": "api-server",
      "protocol": "HTTPS",
      "description": "User requests via HTTPS"
    },
    {
      "unique-id": "api-to-db",
      "relationship-type": "connects",
      "source": "api-server",
      "destination": "postgres-db",
      "protocol": "TCP",
      "description": "API persists data to PostgreSQL"
    }
  ]
}
\`\`\`

## Usage Tips

1. **Start with read_calm_guide** (you just did!) to understand CALM vocabulary.
2. **Use create_architecture** to build an entire architecture in one call — pass all nodes and relationships at once.
3. **Use add_node / add_relationship** for incremental changes after initial creation.
4. **Use validate_architecture** to check for errors (dangling refs, duplicate IDs, orphan nodes).
5. **Use render_diagram** to visualize — returns SVG with color-coded node types.
6. **Use describe_architecture** to get a text summary of all nodes and relationships.
7. Every node needs a globally unique \`unique-id\` (kebab-case recommended).
8. Relationships reference nodes by their \`unique-id\` in \`source\` and \`destination\`.
`.trim();

// ---------------------------------------------------------------------------
// ARB → CALM conversion guide (topic = "arb-conversion")
// ---------------------------------------------------------------------------

const ARB_CONVERSION_GUIDE = `
# Convert ARB markdown to CALM

How to convert a FINOS Labs–style AI reference architecture markdown document
into a valid CALM 1.2 architecture using the CALMStudio MCP server. Designed
for AI coding agents (Claude Code, Codex, Cursor, …) — no LLM logic lives in
the MCP server itself; the agent reads the source and drives the MCP calls.

## When to use this guide

You have a markdown document describing an AI architecture (multi-agent, RAG,
agentic, …) such as the FINOS Labs reference at:

  https://github.com/finos-labs/ai-reference-architecture-library

You want a valid CALM 1.2 .calm.json with the FINOS AIGF governance overlay
attached, ready to load into CalmStudio for visual review.

## Prerequisites

- CALMStudio MCP server configured in your runtime
- Working directory configured via CALM_HOME (or pass absolute file paths)
- Read access to the source URL or local file

## Step-by-step

1. Read the source markdown directly. Identify the layered structure (typical
   ARB pattern: User Interaction → Gateway → Agents → Knowledge → LLM → MCP →
   Evaluation → Observability).

2. Plan a node list before any MCP call. Use the mapping table below to
   pick a CALM node type for each component. Use kebab-case unique-ids.

3. Call \`create_architecture\` with the target file path.

4. Call \`batch_create_nodes\` with all components in one payload. AIGF
   governance decorators auto-attach when AI nodes are present — no manual
   step required.

5. Call \`add_relationship\` for each connection visible in the source.
   See the relationship-type table below.

6. (Optional) For nodes whose source document mentions explicit governance
   posture, attach a domain-oriented control to that node using
   \`update_node\` with a \`controls\` field. See the control-key table below.

7. Call \`finalize_architecture\`. This validates the result, tops up the
   AIGF decorator, and renders an ELK SVG. Inspect the JSON summary; iterate
   via \`update_node\`, \`update_relationship\`, etc. until
   \`validation.errors\` is 0.

8. Open the resulting .calm.json in CalmStudio (https://calmstudio.vercel.app/
   or local dev) to review the rendered architecture.

## Layer-to-node-type mapping

| ARB layer / concept           | CALM node type            |
|-------------------------------|---------------------------|
| End user                      | actor                     |
| Web / mobile front end        | webclient                 |
| API gateway, request routing  | ai:api-gateway            |
| Input/output safety filters   | ai:guardrail              |
| Worker agents                 | ai:agent                  |
| Coordinator / supervisor      | ai:orchestrator           |
| Vector / semantic store       | ai:vector-store           |
| Structured policy KB          | ai:knowledge-base         |
| Retrieval pipeline            | ai:rag-pipeline           |
| Foundation / inference model  | ai:llm                    |
| Embedding model               | ai:embedding-model        |
| Reusable prompt template      | ai:prompt-template        |
| Working / persistent memory   | ai:memory                 |
| Callable function or API      | ai:tool                   |
| MCP server endpoint           | ai:mcp-server             |
| Evaluation, scoring           | ai:eval-monitor           |
| Telemetry, tracing, metrics   | ai:observability          |
| Human approval / review       | ai:human-in-the-loop      |
| Generic supporting service    | service                   |

## Relationship patterns

| Pattern                         | Type            | Example                           |
|---------------------------------|-----------------|-----------------------------------|
| API call between services       | connects        | webclient → ai:api-gateway        |
| Agent invokes tool / LLM        | interacts       | ai:agent → ai:llm                 |
| Layer is sub-decomposable       | composed-of     | ai:mcp-server → ai:tool           |
| Component runs in environment   | deployed-in     | ai:agent → ecosystem              |
| Configuration alternative       | options         | A/B variants                       |

\`connects\` should carry a \`protocol\` field (HTTPS, gRPC, JDBC, …).

## Recommended control keys (CALM 1.2 — domain-oriented, not framework-prefixed)

| Node type             | Control key              | When to apply                           |
|-----------------------|--------------------------|-----------------------------------------|
| ai:mcp-server         | mcp-security             | always — capability authz               |
| ai:api-gateway        | edge-protection          | always                                  |
| ai:guardrail          | input-output-validation  | always                                  |
| ai:tool               | tool-isolation           | when the tool has side effects          |
| ai:memory             | data-residency           | when memory persists across sessions    |
| ai:observability      | ai-telemetry             | always                                  |

The \`requirement-url\` field of the control points at the AIGF mitigation
page (mi-XX). \`config-url\` is optional — use to reference framework-specific
guidance such as NIST-AI-600-1 §5.2.

## Worked example

The FINOS Labs multi-agent reference architecture
(\`Library/reference-architecture/multi-agent/ma_ref_arch_jan_2026.md\`) maps
to 15 nodes covering all 8 ARB layers. A canonical converted artifact ships
in the calm-core test fixtures as
\`multi-agent-arb-jan-2026.calm.json\` for reference and demo use.

## Troubleshooting

- **Validation error: dangling relationship reference** — every \`source\`
  and \`destination\` unique-id must exist as a node. Add nodes before
  relationships.
- **AIGF decorator not appearing** — confirm the node-type starts with
  \`ai:\`. Non-AI nodes do not generate the overlay.
- **SVG render fails** — try \`direction: 'RIGHT'\` for wide architectures;
  ELK has limits on dense layouts.
`.trim();

// ---------------------------------------------------------------------------
// Pure logic function (exported for direct testing)
// ---------------------------------------------------------------------------

export function readCalmGuide(args: z.infer<typeof ReadCalmGuideSchema>): ToolResponse {
  if (args.topic === 'arb-conversion') {
    return toolSuccess(ARB_CONVERSION_GUIDE);
  }
  return toolSuccess(CALM_GUIDE);
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerGuideTools(server: McpServer): void {
  server.tool(
    'read_calm_guide',
    'Get a CALM reference guide. Default returns the CALM vocabulary (9 node types, 5 relationship types, interface types, example). Pass topic="arb-conversion" for a step-by-step skill on converting FINOS-Labs-style AI reference architecture markdown into CALM 1.2 via this MCP server.',
    ReadCalmGuideSchema.shape,
    async (args) => readCalmGuide(args)
  );
}
