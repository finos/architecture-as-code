// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CreateViewSchema, UpdateViewSchema, toolError, type ToolResponse } from '../types.js';
import { resolveFile, writeSidecar } from '../file-io.js';
import { renderDiagram } from './render.js';

type CreateViewArgs = z.infer<typeof CreateViewSchema>;
type UpdateViewArgs = z.infer<typeof UpdateViewSchema>;

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

/**
 * Create a view: render architecture to SVG and write ELK positions to sidecar.
 */
export async function createView(args: CreateViewArgs): Promise<ToolResponse> {
  const filePath = resolveFile(args.file);

  // Render SVG — reuses render_diagram logic
  const renderResult = await renderDiagram({ file: args.file, direction: 'DOWN' });
  if (renderResult.isError) {
    return renderResult;
  }

  // Write sidecar with view metadata
  try {
    writeSidecar(filePath, {
      generatedAt: new Date().toISOString(),
      viewType: 'elk-svg',
      source: filePath
    });
  } catch (err) {
    // Sidecar write failure is non-fatal — return SVG anyway
    return toolError(`SVG rendered but sidecar write failed: ${String(err)}`);
  }

  return renderResult;
}

/**
 * Update a view: re-render architecture to SVG (same as create, overwrites sidecar).
 */
export async function updateView(args: UpdateViewArgs): Promise<ToolResponse> {
  // Update is equivalent to create — just re-render
  return createView(args);
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerViewTools(server: McpServer): void {
  server.tool(
    'create_view',
    'Render a CALM architecture file as an SVG diagram for Claude Cowork. Writes ELK layout positions to the sidecar file. Returns SVG content.',
    CreateViewSchema.shape,
    async (args) => createView(args)
  );

  server.tool(
    'update_view',
    'Re-render a CALM architecture SVG view after architecture changes. Overwrites the previous sidecar layout data.',
    UpdateViewSchema.shape,
    async (args) => updateView(args)
  );
}
