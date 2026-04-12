// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// @ts-expect-error — elkjs-svg is a CJS module with no type declarations
import { Renderer } from 'elkjs-svg';
// elkjs/lib/elk.bundled.js is a CJS module — esModuleInterop allows default import
import ELKImport from 'elkjs/lib/elk.bundled.js';
// Handle both CJS default export and ESM default export shapes
const ELK = (ELKImport as unknown as { default?: new () => { layout: (graph: unknown) => Promise<unknown> } }).default ?? ELKImport as unknown as new () => { layout: (graph: unknown) => Promise<unknown> };
import {
  ValidateArchitectureSchema,
  RenderDiagramSchema,
  toolSuccess,
  toolError,
  type ToolResponse
} from '../types.js';
import { resolveFile, readCalmFile, writeSidecar } from '../file-io.js';
import { validateArchitecture } from '../validation.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

type ValidateArchitectureArgs = z.infer<typeof ValidateArchitectureSchema>;
type RenderDiagramArgs = z.infer<typeof RenderDiagramSchema>;

// ---------------------------------------------------------------------------
// Node type color map for SVG styling
// ---------------------------------------------------------------------------

const NODE_TYPE_FILL: Record<string, string> = {
  actor: '#4A90D9',
  system: '#2ECC71',
  service: '#E67E22',
  database: '#9B59B6',
  network: '#1ABC9C',
  webclient: '#3498DB',
  ecosystem: '#27AE60',
  ldap: '#8E44AD',
  'data-asset': '#E74C3C'
};

const DEFAULT_FILL = '#7F8C8D';

// ---------------------------------------------------------------------------
// Pure logic functions (exported for direct testing)
// ---------------------------------------------------------------------------

/**
 * Validate a CALM architecture file and return formatted issues as text.
 */
export function validateArchitectureTool(args: ValidateArchitectureArgs): ToolResponse {
  const filePath = resolveFile(args.file);
  let arch: CalmArchitecture;
  try {
    arch = readCalmFile(filePath);
  } catch (err) {
    return toolError(`Failed to read architecture: ${String(err)}`);
  }

  const issues = validateArchitecture(arch);

  if (issues.length === 0) {
    return toolSuccess('No validation issues found.');
  }

  const lines = issues.map((issue) => {
    const label =
      issue.severity === 'error' ? '[ERROR]' :
      issue.severity === 'warning' ? '[WARNING]' :
      '[INFO]';
    return `${label} ${issue.message}`;
  });

  return toolSuccess(lines.join('\n'));
}

/**
 * Pure function: render a CalmArchitecture object to an SVG string using ELK layout.
 * No file I/O — accepts the architecture in-memory. Used by the VS Code extension and GitHub Action.
 */
export async function renderArchitectureToSvg(
  arch: CalmArchitecture,
  direction: 'DOWN' | 'RIGHT' | 'UP' = 'DOWN'
): Promise<string> {
  // Empty architecture — return minimal SVG placeholder
  if (arch.nodes.length === 0) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">' +
      '<text x="10" y="50" font-family="sans-serif" font-size="14" fill="#999">No nodes</text>' +
      '</svg>'
    );
  }

  // Build ELK graph — flat structure matching established pattern (RESEARCH Pitfall 7)
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '60'
    },
    children: arch.nodes.map((n) => ({
      id: n['unique-id'],
      width: 160,
      height: 60,
      labels: [{ text: n.name }]
    })),
    edges: arch.relationships.map((r) => ({
      id: r['unique-id'],
      sources: [r.source],
      targets: [r.destination]
    }))
  };

  type ElkChild = { id: string; x?: number; y?: number; width?: number; height?: number; labels?: Array<{ text: string }> };
  type ElkEdgeSection = { startPoint?: { x: number; y: number }; endPoint?: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }> };
  type ElkLayouted = { children?: ElkChild[]; edges?: Array<{ id: string; sections?: ElkEdgeSection[] }> };

  const elk = new ELK();
  const layouted = await elk.layout(graph) as ElkLayouted;

  // Build node type map for coloring
  const nodeTypeMap = new Map<string, string>();
  for (const n of arch.nodes) {
    nodeTypeMap.set(n['unique-id'], n['node-type']);
  }

  // Compute canvas size from laid-out positions
  const svgWidth = Math.max(
    400,
    ...(layouted.children ?? []).map((c) => (c.x ?? 0) + (c.width ?? 160) + 40)
  );
  const svgHeight = Math.max(
    200,
    ...(layouted.children ?? []).map((c) => (c.y ?? 0) + (c.height ?? 60) + 40)
  );

  // Build SVG manually for CALM-specific styling
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`
  ];

  // Arrow marker definition
  parts.push(
    '<defs>',
    '<marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto-start-reverse">',
    '<path d="M 0 0 L 10 5 L 0 10 z" fill="#555"/>',
    '</marker>',
    '</defs>'
  );

  // Draw edges first (behind nodes)
  for (const edge of layouted.edges ?? []) {
    const e = edge;
    for (const section of e.sections ?? []) {
      const points: string[] = [];
      if (section.startPoint) {
        points.push(`${section.startPoint.x},${section.startPoint.y}`);
      }
      for (const bp of section.bendPoints ?? []) {
        points.push(`${bp.x},${bp.y}`);
      }
      if (section.endPoint) {
        points.push(`${section.endPoint.x},${section.endPoint.y}`);
      }
      if (points.length >= 2) {
        parts.push(
          `<polyline points="${points.join(' ')}" fill="none" stroke="#555" stroke-width="1.5" marker-end="url(#arrow)"/>`
        );
      }
    }
  }

  // Draw nodes
  for (const child of layouted.children ?? []) {
    const x = child.x ?? 0;
    const y = child.y ?? 0;
    const w = child.width ?? 160;
    const h = child.height ?? 60;
    const nodeType = nodeTypeMap.get(child.id) ?? 'system';
    const fill = NODE_TYPE_FILL[nodeType] ?? DEFAULT_FILL;
    const label = child.labels?.[0]?.text ?? child.id;

    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="${fill}" stroke="#333" stroke-width="1"/>`,
      `<text x="${x + w / 2}" y="${y + h / 2 - 6}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="11" fill="#fff" font-weight="bold">${escapeXml(label)}</text>`,
      `<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="9" fill="rgba(255,255,255,0.8)">${escapeXml(nodeType)}</text>`
    );
  }

  parts.push('</svg>');

  return parts.join('\n');
}

/**
 * Render a CALM architecture as an SVG string using ELK layout.
 * Reads from file — thin wrapper around renderArchitectureToSvg.
 */
export async function renderDiagram(args: RenderDiagramArgs): Promise<ToolResponse> {
  const filePath = resolveFile(args.file);
  const direction = args.direction ?? 'DOWN';

  let arch: CalmArchitecture;
  try {
    arch = readCalmFile(filePath);
  } catch (err) {
    return toolError(`Failed to read architecture: ${String(err)}`);
  }

  try {
    const svg = await renderArchitectureToSvg(arch, direction);
    return toolSuccess(svg);
  } catch (err) {
    return toolError(`ELK layout failed: ${String(err)}`);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// MCP registration
// ---------------------------------------------------------------------------

export function registerRenderTools(server: McpServer): void {
  server.tool(
    'validate_architecture',
    'Validate a CALM architecture file. Returns a list of errors and warnings, or "No validation issues found" for a valid architecture.',
    ValidateArchitectureSchema.shape,
    async (args) => validateArchitectureTool(args)
  );

  server.tool(
    'render_diagram',
    'Generate an SVG diagram from a CALM architecture file using ELK layout. Returns the SVG string with CALM node type color coding.',
    RenderDiagramSchema.shape,
    async (args) => renderDiagram(args)
  );
}

// Re-export writeSidecar for use in view.ts
export { writeSidecar };
