// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * decorators.ts — MCP tools for working with CALM 1.2 decorators (#2551).
 *
 *   - get_decorators            list all decorators, optionally filtered by type
 *   - get_decorators_for_node   reverse-index by node unique-id
 *   - get_threats_for_node      aggregate threat-model decorators by node
 *   - get_control               look up a control id in any control-catalog decorator
 *   - add_threat_decorator      append a new threat-model decorator to the architecture
 *
 * These tools operate on the architecture file's `decorators[]` field.
 * The Studio side may store decorators in a sidecar (`<arch>.threats.calm.json`)
 * to keep the architecture file clean and compatible with strict CALM 1.2
 * validators — that mirroring is handled by the studio I/O layer; this MCP
 * surface treats the in-memory architecture as the source of truth.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  GetDecoratorsSchema,
  GetDecoratorsForNodeSchema,
  GetThreatsForNodeSchema,
  GetControlSchema,
  AddThreatDecoratorSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js';
import {
  getDecoratorsByType,
  getDecoratorsForNode,
  getThreatsForNode,
  getControlById,
  type CalmDecorator
} from '@calmstudio/calm-core';

type GetDecoratorsArgs = z.infer<typeof GetDecoratorsSchema>;
type GetDecoratorsForNodeArgs = z.infer<typeof GetDecoratorsForNodeSchema>;
type GetThreatsForNodeArgs = z.infer<typeof GetThreatsForNodeSchema>;
type GetControlArgs = z.infer<typeof GetControlSchema>;
type AddThreatDecoratorArgs = z.infer<typeof AddThreatDecoratorSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

export function getDecorators(args: GetDecoratorsArgs): ToolResponse {
  const arch = readCalmFile(resolveFile(args.file));
  const all = arch.decorators ?? [];
  const filtered = args.type ? getDecoratorsByType(arch, args.type) : all;
  if (filtered.length === 0) {
    return toolSuccess(
      args.type
        ? `No decorators of type "${args.type}" found.`
        : 'No decorators in this architecture.'
    );
  }
  const lines = filtered.map(formatDecoratorSummary).join('\n');
  return toolSuccess(`Found ${filtered.length} decorator(s):\n${lines}`);
}

export function getDecoratorsForNodeTool(args: GetDecoratorsForNodeArgs): ToolResponse {
  const arch = readCalmFile(resolveFile(args.file));
  const matches = getDecoratorsForNode(arch, args.nodeId);
  if (matches.length === 0) {
    return toolSuccess(`No decorators reference node "${args.nodeId}".`);
  }
  const lines = matches.map(formatDecoratorSummary).join('\n');
  return toolSuccess(
    `Found ${matches.length} decorator(s) referencing node "${args.nodeId}":\n${lines}`
  );
}

export function getThreatsForNodeTool(args: GetThreatsForNodeArgs): ToolResponse {
  const arch = readCalmFile(resolveFile(args.file));
  const threats = getThreatsForNode(arch, args.nodeId);
  if (threats.length === 0) {
    return toolSuccess(`No threats reference node "${args.nodeId}".`);
  }
  const lines = threats
    .map(
      (t) =>
        `  - [${t.id}] ${t.name}\n` +
        `      ${t.description}\n` +
        `      Mitigations: ${t.mitigations}\n` +
        `      Controls: ${t.controls.join(', ')}`
    )
    .join('\n');
  return toolSuccess(
    `Node "${args.nodeId}" is referenced by ${threats.length} threat(s):\n${lines}`
  );
}

export function getControl(args: GetControlArgs): ToolResponse {
  const arch = readCalmFile(resolveFile(args.file));
  const c = getControlById(arch, args.controlId);
  if (!c) {
    return toolError(
      `Control "${args.controlId}" not found in any control-catalog decorator.`
    );
  }
  return toolSuccess(`Control ${c.id}: ${c.description}`);
}

export function addThreatDecorator(args: AddThreatDecoratorArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  const arch = readCalmFile(filePath);

  // Reject duplicate unique-ids
  if (arch.decorators?.some((d) => d['unique-id'] === args.decorator['unique-id'])) {
    return toolError(
      `Decorator unique-id "${args.decorator['unique-id']}" already exists in the architecture.`
    );
  }

  // Cross-ref check: every applies-to + threat affected-nodes id must exist
  const nodeIds = new Set(arch.nodes.map((n) => n['unique-id']));
  const allRefs = new Set<string>(args.decorator['applies-to']);
  for (const t of args.decorator.data.threats) {
    for (const id of t['affected-nodes'] ?? []) allRefs.add(id);
  }
  const dangling = [...allRefs].filter((id) => !nodeIds.has(id));
  if (dangling.length > 0) {
    return toolError(
      `Cannot add decorator: ${dangling.length} dangling node reference(s): ${dangling.join(', ')}.`
    );
  }

  const decorator: CalmDecorator = {
    'unique-id': args.decorator['unique-id'],
    type: args.decorator.type,
    target: args.decorator.target ?? args.targetFiles ?? [resolveFile(args.file)],
    'applies-to': args.decorator['applies-to'],
    data: args.decorator.data as Record<string, unknown>
  };

  arch.decorators = [...(arch.decorators ?? []), decorator];
  writeCalmFile(filePath, arch);
  return toolSuccess(
    `Decorator "${decorator['unique-id']}" (${decorator.type}) added. ` +
    `${args.decorator.data.threats.length} threat(s), ` +
    `${decorator['applies-to'].length} node(s) in applies-to.`
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatDecoratorSummary(d: CalmDecorator): string {
  const applies = Array.isArray(d['applies-to']) ? d['applies-to'].join(', ') : '?';
  const data = d.data as { threats?: unknown[]; controls?: unknown[] };
  const extras: string[] = [];
  if (Array.isArray(data.threats)) extras.push(`threats=${data.threats.length}`);
  if (Array.isArray(data.controls)) extras.push(`controls=${data.controls.length}`);
  const extraStr = extras.length > 0 ? ` (${extras.join(', ')})` : '';
  return `  - ${d['unique-id']} [${d.type}]${extraStr}\n      applies-to: ${applies}`;
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerDecoratorTools(server: McpServer): void {
  server.tool(
    'get_decorators',
    'List decorators on a CALM architecture. Optionally filter by `type` (e.g. "threat-model", "control-catalog", "aigf-governance").',
    GetDecoratorsSchema.shape,
    async (args) => getDecorators(args)
  );

  server.tool(
    'get_decorators_for_node',
    'Return every decorator that references the given node unique-id, via either the decorator\'s `applies-to[]` or any inner threat\'s `affected-nodes[]`. Used by the Studio properties panel.',
    GetDecoratorsForNodeSchema.shape,
    async (args) => getDecoratorsForNodeTool(args)
  );

  server.tool(
    'get_threats_for_node',
    'Aggregate every threat from every threat-model decorator that references the given node unique-id. Threats with explicit `affected-nodes[]` are filtered by that; threats without it inherit the parent decorator\'s `applies-to[]`.',
    GetThreatsForNodeSchema.shape,
    async (args) => getThreatsForNodeTool(args)
  );

  server.tool(
    'get_control',
    'Look up a control id (e.g. "C8") in any control-catalog decorator attached to the architecture.',
    GetControlSchema.shape,
    async (args) => getControl(args)
  );

  server.tool(
    'add_threat_decorator',
    'Append a new threat-model decorator to the architecture. Rejects duplicate unique-id and dangling node references.',
    AddThreatDecoratorSchema.shape,
    async (args) => addThreatDecorator(args)
  );
}
