// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import { readFileSync, writeFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ExportCalmSchema,
  ImportCalmSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile } from '../file-io.js';

type ExportCalmArgs = z.infer<typeof ExportCalmSchema>;
type ImportCalmArgs = z.infer<typeof ImportCalmSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

export function exportCalm(args: ExportCalmArgs): ToolResponse {
  const sourcePath = resolveFile(args.source);
  // Read via readCalmFile (handles auto-init and validation)
  const arch = readCalmFile(sourcePath);
  // Write to destination
  writeFileSync(args.destination, JSON.stringify(arch, null, 2), 'utf-8');
  return toolSuccess(`Architecture exported to: ${args.destination}`);
}

export function importCalm(args: ImportCalmArgs): ToolResponse {
  let raw: string;
  try {
    raw = readFileSync(args.file, 'utf-8');
  } catch (err) {
    return toolError(`Cannot read file "${args.file}": ${String(err)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return toolError(`Invalid JSON in "${args.file}": ${String(err)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>)['nodes'])
  ) {
    return toolError(
      `Invalid .calm file "${args.file}": expected an object with a "nodes" array.`
    );
  }

  const arch = parsed as { nodes: unknown[]; relationships?: unknown[] };
  const nodeCount = arch.nodes.length;
  const relCount = arch.relationships?.length ?? 0;

  return toolSuccess(
    `Architecture imported from: ${args.file}\n` +
    `Nodes: ${nodeCount}\n` +
    `Relationships: ${relCount}`
  );
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerIOTools(server: McpServer): void {
  server.tool(
    'export_calm',
    'Copy the contents of a .calm file to a destination path.',
    ExportCalmSchema.shape,
    async (args) => exportCalm(args)
  );

  server.tool(
    'import_calm',
    'Read and validate a .calm file from any path. Returns a summary with node and relationship counts.',
    ImportCalmSchema.shape,
    async (args) => importCalm(args)
  );
}
