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
// Pure logic function (exported for direct testing)
// ---------------------------------------------------------------------------

export function readCalmGuide(_args: z.infer<typeof ReadCalmGuideSchema>): ToolResponse {
  return toolSuccess(CALM_GUIDE);
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerGuideTools(server: McpServer): void {
  server.tool(
    'read_calm_guide',
    'Get the CALM architecture reference guide: all 9 node types, 5 relationship types, interface types, a complete 3-node example, and usage tips. Read this before creating architectures.',
    ReadCalmGuideSchema.shape,
    async (args) => readCalmGuide(args)
  );
}
