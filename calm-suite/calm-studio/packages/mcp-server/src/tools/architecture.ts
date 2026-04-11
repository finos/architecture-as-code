// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CreateArchitectureSchema,
  DescribeArchitectureSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

type CreateArchitectureArgs = z.infer<typeof CreateArchitectureSchema>;
type DescribeArchitectureArgs = z.infer<typeof DescribeArchitectureSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

export function createArchitecture(args: CreateArchitectureArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  // Cast from Zod inferred type to CalmArchitecture — Zod ensures required fields present;
  // the type difference is only exactOptionalPropertyTypes (undefined vs absent).
  const arch: CalmArchitecture = {
    nodes: args.nodes as CalmArchitecture['nodes'],
    relationships: (args.relationships ?? []) as CalmArchitecture['relationships']
  };
  writeCalmFile(filePath, arch);
  const nodeCount = arch.nodes.length;
  const relCount = arch.relationships.length;
  return toolSuccess(
    `Architecture created: ${nodeCount} node${nodeCount !== 1 ? 's' : ''}, ` +
    `${relCount} relationship${relCount !== 1 ? 's' : ''}.\n` +
    `File: ${filePath}\n` +
    `Open: calmstudio://open?file=${encodeURIComponent(filePath)}`
  );
}

export function describeArchitecture(args: DescribeArchitectureArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  let arch: CalmArchitecture;
  try {
    arch = readCalmFile(filePath);
  } catch (err) {
    return toolError(`Failed to read architecture: ${String(err)}`);
  }

  const nodeCount = arch.nodes.length;
  const relCount = arch.relationships.length;

  const nodeLines = arch.nodes
    .map((n) => `  - ${n['unique-id']} (${n['node-type']}): ${n.name}`)
    .join('\n');

  const relLines = arch.relationships
    .map((r) => `  - ${r['unique-id']}: ${r.source} -> ${r.destination} (${r['relationship-type']})`)
    .join('\n');

  return toolSuccess(
    `Architecture: ${filePath}\n` +
    `Nodes (${nodeCount}):\n${nodeLines || '  (none)'}\n` +
    `Relationships (${relCount}):\n${relLines || '  (none)'}`
  );
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerArchitectureTools(server: McpServer): void {
  server.tool(
    'create_architecture',
    'Build a new CALM architecture from structured node and relationship arrays and write it to a .calm file. Overwrites existing content.',
    CreateArchitectureSchema.shape,
    async (args) => createArchitecture(args)
  );

  server.tool(
    'describe_architecture',
    'Read a .calm file and return a structured summary: node count, relationship count, names and types of all nodes, and relationship list.',
    DescribeArchitectureSchema.shape,
    async (args) => describeArchitecture(args)
  );
}
