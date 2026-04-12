// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { CalmArchitecture, CalmFlow } from '@calmstudio/calm-core';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export interface EdgeLayout {
  id: string;
  points: Array<{ x: number; y: number }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render flow overlay SVG elements (animated dots + sequence badges) for a given flow.
 * Returns SVG string to be appended AFTER edge and node layers so animated dots are
 * always on top and not subject to edge/node dimming.
 *
 * @param flow - The active CalmFlow to render
 * @param edgeLayouts - Map from relationship-unique-id to EdgeLayout (id + points array)
 * @returns SVG group string containing animated dots and sequence badge circles
 */
export function renderFlowOverlay(
  flow: CalmFlow,
  edgeLayouts: Map<string, EdgeLayout>
): string {
  const parts: string[] = ['<g class="flow-overlay">'];

  for (const transition of flow.transitions) {
    const edge = edgeLayouts.get(transition['relationship-unique-id']);
    if (!edge || edge.points.length < 2) continue;

    const pathId = `flow-path-${edge.id}`;
    const direction = transition.direction ?? 'source-to-destination';
    const keyPoints = direction === 'destination-to-source' ? '1;0' : '0;1';

    // Build SVG path from edge points (M x,y L x,y L x,y ...)
    const pathD = edge.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
      .join(' ');

    // Hidden path for animateMotion reference
    parts.push(
      `<path id="${pathId}" d="${pathD}" fill="none" stroke="none"/>`
    );

    // Animated dot travelling along the edge path
    parts.push(
      `<circle r="5" fill="#3b82f6" stroke="#fff" stroke-width="1.5">`,
      `  <animateMotion dur="1.8s" repeatCount="indefinite" keyPoints="${keyPoints}" keyTimes="0;1" calcMode="linear">`,
      `    <mpath href="#${pathId}"/>`,
      `  </animateMotion>`,
      `</circle>`
    );

    // Compute midpoint for badge placement
    const midIdx = Math.floor(edge.points.length / 2);
    const midPoint = edge.points[midIdx];
    const midX = midPoint.x;
    const midY = midPoint.y;

    // Sequence badge (numbered circle with tooltip)
    parts.push(
      `<g class="flow-badge" data-summary="${escapeAttr(transition.summary)}">`,
      `  <circle cx="${midX}" cy="${midY}" r="10" fill="#3b82f6"/>`,
      `  <text x="${midX}" y="${midY}" fill="white" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central">${transition['sequence-number']}</text>`,
      `  <title>${escapeAttr(transition.summary)}</title>`,
      `</g>`
    );
  }

  parts.push('</g>');
  return parts.join('\n');
}

/**
 * Returns opacity value ("1" or "0.3") for an edge or node based on whether it is
 * part of the active flow. When no flow is active (empty set), all elements are full opacity.
 *
 * @param elementId - The unique-id of the edge or node
 * @param activeFlowEdgeIds - Set of relationship-unique-ids that belong to the active flow
 * @param isEdge - true for edges (can be dimmed), false for nodes (always full opacity)
 * @returns opacity string suitable for SVG opacity attribute
 */
export function applyFlowDimming(
  elementId: string,
  activeFlowEdgeIds: Set<string>,
  isEdge: boolean
): string {
  if (activeFlowEdgeIds.size === 0) return '1';
  if (isEdge) {
    return activeFlowEdgeIds.has(elementId) ? '1' : '0.3';
  }
  // Nodes are always rendered at full opacity; callers can apply node-level dimming
  // independently via getFlowNodeIds if desired.
  return '1';
}

/**
 * Determine which node IDs are connected by at least one flow transition edge.
 * Useful for node-level dimming: nodes NOT in this set can be dimmed.
 *
 * @param arch - The CALM architecture (used for relationship source/destination lookup)
 * @param flow - The active flow
 * @returns Set of node unique-ids that are endpoints of flow transition edges
 */
export function getFlowNodeIds(
  arch: CalmArchitecture,
  flow: CalmFlow
): Set<string> {
  const nodeIds = new Set<string>();
  const flowEdgeIds = new Set(flow.transitions.map((t) => t['relationship-unique-id']));
  for (const rel of arch.relationships) {
    if (flowEdgeIds.has(rel['unique-id'])) {
      nodeIds.add(rel.source);
      nodeIds.add(rel.destination);
    }
  }
  return nodeIds;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
