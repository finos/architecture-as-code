// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AddRelationshipSchema,
  GetRelationshipSchema,
  UpdateRelationshipSchema,
  DeleteRelationshipSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js';
import {
  getReferencedNodeIds,
  getRelationshipVariant,
  type CalmRelationship
} from '@calmstudio/calm-core';

type AddRelationshipArgs = z.infer<typeof AddRelationshipSchema>;
type GetRelationshipArgs = z.infer<typeof GetRelationshipSchema>;
type UpdateRelationshipArgs = z.infer<typeof UpdateRelationshipSchema>;
type DeleteRelationshipArgs = z.infer<typeof DeleteRelationshipSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

export function addRelationship(args: AddRelationshipArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);

  // CRITICAL: Validate that every node referenced by this relationship's variant
  // exists in the architecture (no dangling refs across all 5 variants).
  const nodeIds = new Set(arch.nodes.map((n) => n['unique-id']));
  const availableIds = [...nodeIds].join(', ');

  // Cast the Zod-validated input to CalmRelationship — Zod's union has already
  // enforced the nested shape; the type difference is only exactOptionalPropertyTypes.
  const rel = args.relationship as unknown as CalmRelationship;

  const refs = getReferencedNodeIds(rel);
  for (const id of refs) {
    if (!nodeIds.has(id)) {
      return toolError(
        `Cannot add relationship: referenced node "${id}" not found. ` +
        `Available node IDs: ${availableIds || '(none)'}`
      );
    }
  }

  arch.relationships.push(rel);
  writeCalmFile(filePath, arch);
  return toolSuccess(
    `Relationship added: ${rel['unique-id']} ` +
    `(${getRelationshipVariant(rel['relationship-type'])}: ${refs.join(' -> ')})`
  );
}

export function getRelationship(args: GetRelationshipArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const rel = arch.relationships.find((r) => r['unique-id'] === args.id);
  if (!rel) {
    const available = arch.relationships.map((r) => r['unique-id']).join(', ');
    return toolError(
      `Relationship "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  const variant = getRelationshipVariant(rel['relationship-type']);
  const refs = getReferencedNodeIds(rel).join(', ');
  return toolSuccess(
    `Relationship: ${rel['unique-id']}\n` +
    `  Variant: ${variant}\n` +
    `  References: ${refs}\n` +
    (rel.protocol ? `  Protocol: ${rel.protocol}\n` : '') +
    (rel.description ? `  Description: ${rel.description}\n` : '')
  );
}

export function updateRelationship(args: UpdateRelationshipArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const idx = arch.relationships.findIndex((r) => r['unique-id'] === args.id);
  if (idx === -1) {
    const available = arch.relationships.map((r) => r['unique-id']).join(', ');
    return toolError(
      `Relationship "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  // Merge — do not replace. Cast through unknown because Zod's union output
  // shape differs from CalmRelationship only in exactOptionalPropertyTypes.
  arch.relationships[idx] = {
    ...arch.relationships[idx],
    ...args.updates
  } as unknown as CalmRelationship;
  writeCalmFile(filePath, arch);
  return toolSuccess(`Relationship "${args.id}" updated.`);
}

export function deleteRelationship(args: DeleteRelationshipArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);
  const idx = arch.relationships.findIndex((r) => r['unique-id'] === args.id);
  if (idx === -1) {
    const available = arch.relationships.map((r) => r['unique-id']).join(', ');
    return toolError(
      `Relationship "${args.id}" not found. Available IDs: ${available || '(none)'}`
    );
  }
  arch.relationships.splice(idx, 1);
  writeCalmFile(filePath, arch);
  return toolSuccess(`Relationship "${args.id}" deleted.`);
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerRelationshipTools(server: McpServer): void {
  server.tool(
    'add_relationship',
    'Add a directed relationship between two nodes in a .calm file. Rejects if source or destination node does not exist (dangling ref).',
    AddRelationshipSchema.shape,
    async (args) => addRelationship(args)
  );

  server.tool(
    'get_relationship',
    'Retrieve a relationship by its unique-id from a .calm file.',
    GetRelationshipSchema.shape,
    async (args) => getRelationship(args)
  );

  server.tool(
    'update_relationship',
    'Merge updates into an existing relationship (preserves unspecified fields). Identified by unique-id.',
    UpdateRelationshipSchema.shape,
    async (args) => updateRelationship(args)
  );

  server.tool(
    'delete_relationship',
    'Remove a relationship by unique-id from a .calm file.',
    DeleteRelationshipSchema.shape,
    async (args) => deleteRelationship(args)
  );
}
