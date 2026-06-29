// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { basename } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  FinalizeArchitectureSchema,
  toolError,
  toolSuccess,
  type ToolResponse,
} from '../types.js';
import { resolveFile, readCalmFile, writeCalmFile } from '../file-io.js';
import { validateArchitecture } from '../validation.js';
import { recomputeAigfDecorators, AIGF_DECORATOR_UNIQUE_ID } from '../aigf-helpers.js';
import { renderArchitectureToSvg } from './render.js';
import { isAINode } from '@calmstudio/calm-core';
import type { CalmArchitecture } from '@calmstudio/calm-core';

type FinalizeArchitectureArgs = z.infer<typeof FinalizeArchitectureSchema>;

/**
 * Finalize an architecture: validate, recompute the AIGF decorator, and
 * (optionally) render an SVG. Returns a structured JSON summary of all three
 * steps. Designed to be called once at the end of an agent-driven build cycle.
 */
export async function finalizeArchitecture(
  args: FinalizeArchitectureArgs,
): Promise<ToolResponse> {
  const filePath = resolveFile(args.file);
  const render = args.render ?? true;

  let arch: CalmArchitecture;
  try {
    arch = readCalmFile(filePath);
  } catch (err) {
    return toolError(`Failed to read architecture: ${String(err)}`);
  }

  // Top up AIGF decorator (idempotent — safe to run even when nodes already auto-attached)
  const updated = recomputeAigfDecorators(arch, basename(filePath));
  writeCalmFile(filePath, updated);

  // Validate against CALM 1.2 schema + structural checks
  const issues = validateArchitecture(updated);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Summarise AIGF state
  const aiNodes = updated.nodes.filter((n) => isAINode(n['node-type']));
  const aigfDecorator = updated.decorators?.find((d) => d['unique-id'] === AIGF_DECORATOR_UNIQUE_ID);

  // Optionally render SVG
  let svg: string | null = null;
  if (render) {
    try {
      svg = await renderArchitectureToSvg(updated, 'DOWN');
    } catch (err) {
      return toolError(`Architecture finalised but SVG render failed: ${String(err)}`);
    }
  }

  const summary = {
    validation: {
      errors: errors.length,
      warnings: warnings.length,
      issues: issues.map((i) => ({ severity: i.severity, message: i.message })),
    },
    aigf: {
      decoratorAttached: aigfDecorator !== undefined,
      aiNodeCount: aiNodes.length,
      decoratorId: aigfDecorator?.['unique-id'] ?? null,
    },
    rendered: svg,
  };

  return toolSuccess(JSON.stringify(summary, null, 2));
}

/**
 * Register the finalize_architecture tool with the MCP server.
 */
export function registerFinalizeTools(server: McpServer): void {
  server.tool(
    'finalize_architecture',
    'Finalize a CALM architecture: validate, ensure the AIGF governance decorator is up to date, and (optionally) render an SVG. Returns a JSON summary describing validation issues, AIGF coverage, and the rendered SVG.',
    FinalizeArchitectureSchema.shape,
    async (args) => finalizeArchitecture(args),
  );
}
