// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { resolvePackNode } from '@calmstudio/extensions';

// ---------------------------------------------------------------------------
// Core node type color map — matches mcp-server render.ts NODE_TYPE_FILL
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
  'data-asset': '#E74C3C',
};

const DEFAULT_FILL = '#7F8C8D';

const CORE_TEXT_COLOR = '#ffffff';

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export interface NodeStyle {
  fill: string;
  stroke: string;
  textColor: string;
}

/**
 * Resolve node colors from pack registry (for extension types) or core color map.
 */
export function getNodeStyle(nodeType: string): NodeStyle {
  // Try pack registry first (handles colon-prefixed types like 'aws:lambda')
  const packEntry = resolvePackNode(nodeType);
  if (packEntry) {
    return {
      fill: packEntry.color.bg,
      stroke: packEntry.color.stroke,
      textColor: '#1a1a1a', // Pack nodes use light backgrounds, dark text
    };
  }

  // Fall back to core type map
  const fill = NODE_TYPE_FILL[nodeType] ?? DEFAULT_FILL;
  return { fill, stroke: '#333', textColor: CORE_TEXT_COLOR };
}

/**
 * Return the SVG icon string from the pack entry, or null for core types.
 */
export function getNodeIcon(nodeType: string): string | null {
  const packEntry = resolvePackNode(nodeType);
  return packEntry?.icon ?? null;
}

/**
 * Escape XML special characters for safe embedding in SVG attributes and text.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface RenderNodeInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  nodeType: string;
  description?: string;
}

/**
 * Build SVG for a single node: rect + label + icon badge + type label.
 * Includes data-node-id and data-description attributes for tooltip support.
 */
export function renderNodeSvg(node: RenderNodeInput): string {
  const { x, y, width, height, name, nodeType, description } = node;
  const style = getNodeStyle(nodeType);
  const icon = getNodeIcon(nodeType);

  const parts: string[] = [];

  // Group element with tooltip data attributes
  parts.push(
    `<g class="calm-node" data-node-id="${escapeXml(node.id)}" data-description="${escapeXml(description ?? '')}" style="cursor:pointer">`
  );

  // Background rect
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" ry="6" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`
  );

  if (icon && icon.length > 0) {
    // Render icon in top-left area (24x24, 8px padding)
    const iconX = x + 8;
    const iconY = y + 8;
    // Scale icon SVG content to 24x24
    parts.push(
      `<svg x="${iconX}" y="${iconY}" width="24" height="24" viewBox="0 0 24 24" overflow="hidden">`,
      icon,
      `</svg>`
    );

    // Name text, offset right to avoid icon
    const textX = x + 40;
    const textY = y + height / 2 - 6;
    const availableWidth = width - 44;
    parts.push(
      `<text x="${textX}" y="${textY}" dominant-baseline="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="${style.textColor}" clip-path="url(#clip-${escapeXml(node.id)})">${escapeXml(name)}</text>`
    );
    void availableWidth; // tracked but not needed in SVG text

    // Type badge below name
    const badgeX = textX;
    const badgeY = y + height / 2 + 8;
    parts.push(
      `<text x="${badgeX}" y="${badgeY}" dominant-baseline="middle" font-family="sans-serif" font-size="9" fill="${style.textColor}" opacity="0.7">${escapeXml(nodeType)}</text>`
    );
  } else {
    // Core types: centered name + type label below
    const cx = x + width / 2;
    parts.push(
      `<text x="${cx}" y="${y + height / 2 - 8}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="${style.textColor}">${escapeXml(name)}</text>`,
      `<text x="${cx}" y="${y + height / 2 + 8}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="9" fill="${style.textColor}" opacity="0.8">${escapeXml(nodeType)}</text>`
    );
  }

  parts.push(`</g>`);
  return parts.join('\n');
}
