// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AddNodeSchema,
  GetNodeSchema,
  UpdateNodeSchema,
  DeleteNodeSchema,
  QueryNodesSchema,
  BatchCreateNodesSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js';

// Use z.infer so function params match what MCP SDK passes (respects exactOptionalPropertyTypes)
type AddNodeArgs = z.infer<typeof AddNodeSchema>;
type GetNodeArgs = z.infer<typeof GetNodeSchema>;
type UpdateNodeArgs = z.infer<typeof UpdateNodeSchema>;
type DeleteNodeArgs = z.infer<typeof DeleteNodeSchema>;
type QueryNodesArgs = z.infer<typeof QueryNodesSchema>;
type BatchCreateNodesArgs = z.infer<typeof BatchCreateNodesSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

export function addNode(args: AddNodeArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  // Cast from Zod inferred type — required fields guaranteed by schema, difference is only undefined vs absent
  arch.nodes.push(args.node as import('@calmstudio/calm-core').CalmNode);
  writeCalmFile(filePath, arch);
  return toolSuccess(`Node added: ${args.node['unique-id']} (${args.node.name})`);
}

export function getNode(args: GetNodeArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const node = arch.nodes.find((n) => n['unique-id'] === args.id);
  if (!node) {
    const available = arch.nodes.map((n) => n['unique-id']).join(', ');
    return toolError(
      `Node "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  return toolSuccess(
    `Node: ${node['unique-id']}\n` +
    `  Name: ${node.name}\n` +
    `  Type: ${node['node-type']}\n` +
    (node.description ? `  Description: ${node.description}\n` : '') +
    (node.interfaces?.length ? `  Interfaces: ${node.interfaces.length}\n` : '')
  );
}

export function updateNode(args: UpdateNodeArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const idx = arch.nodes.findIndex((n) => n['unique-id'] === args.id);
  if (idx === -1) {
    const available = arch.nodes.map((n) => n['unique-id']).join(', ');
    return toolError(
      `Node "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  // Merge — do not replace (preserve unique-id and unspecified fields)
  arch.nodes[idx] = { ...arch.nodes[idx], ...args.updates } as import('@calmstudio/calm-core').CalmNode;
  writeCalmFile(filePath, arch);
  return toolSuccess(`Node "${args.id}" updated.`);
}

export function deleteNode(args: DeleteNodeArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const idx = arch.nodes.findIndex((n) => n['unique-id'] === args.id);
  if (idx === -1) {
    const available = arch.nodes.map((n) => n['unique-id']).join(', ');
    return toolError(
      `Node "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  arch.nodes.splice(idx, 1);
  // Cascade: remove any relationships that reference this node
  const before = arch.relationships.length;
  arch.relationships = arch.relationships.filter(
    (r) => r.source !== args.id && r.destination !== args.id
  );
  const removed = before - arch.relationships.length;
  writeCalmFile(filePath, arch);
  return toolSuccess(
    `Node "${args.id}" deleted.` +
    (removed > 0 ? ` Removed ${removed} relationship${removed !== 1 ? 's' : ''} referencing it.` : '')
  );
}

export function queryNodes(args: QueryNodesArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  let results = arch.nodes;

  if (args.type) {
    results = results.filter((n) => n['node-type'] === args.type);
  }
  if (args.name) {
    const lower = args.name.toLowerCase();
    results = results.filter((n) => n.name.toLowerCase().includes(lower));
  }

  if (results.length === 0) {
    return toolSuccess('No nodes matched the query.');
  }

  const lines = results.map((n) => `  - ${n['unique-id']} (${n['node-type']}): ${n.name}`).join('\n');
  return toolSuccess(`Found ${results.length} node${results.length !== 1 ? 's' : ''}:\n${lines}`);
}

export function batchCreateNodes(args: BatchCreateNodesArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  // Single read-write cycle for all nodes
  for (const node of args.nodes) {
    arch.nodes.push(node as import('@calmstudio/calm-core').CalmNode);
  }
  writeCalmFile(filePath, arch);
  const count = args.nodes.length;
  return toolSuccess(`Added ${count} node${count !== 1 ? 's' : ''}.`);
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerNodeTools(server: McpServer): void {
  server.tool(
    'add_node',
    'Append a single node to an existing .calm architecture file.',
    AddNodeSchema.shape,
    async (args) => addNode(args)
  );

  server.tool(
    'get_node',
    'Retrieve a node by its unique-id from a .calm file.',
    GetNodeSchema.shape,
    async (args) => getNode(args)
  );

  server.tool(
    'update_node',
    'Merge updates into an existing node (preserves unspecified fields). Identified by unique-id.',
    UpdateNodeSchema.shape,
    async (args) => updateNode(args)
  );

  server.tool(
    'delete_node',
    'Remove a node by unique-id and cascade-delete all relationships that reference it.',
    DeleteNodeSchema.shape,
    async (args) => deleteNode(args)
  );

  server.tool(
    'query_nodes',
    'Filter nodes by node-type and/or name substring (case-insensitive). Returns matching node summaries.',
    QueryNodesSchema.shape,
    async (args) => queryNodes(args)
  );

  server.tool(
    'batch_create_nodes',
    'Add multiple nodes to a .calm file in a single read-write cycle.',
    BatchCreateNodesSchema.shape,
    async (args) => batchCreateNodes(args)
  );
}
