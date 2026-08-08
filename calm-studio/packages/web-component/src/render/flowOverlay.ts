// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { getReferencedNodeIds, type CalmArchitecture, type CalmFlow, type CalmRelationship } from '@calmstudio/calm-core';

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
 * A relationship that fans out to multiple render edges (multi-node interacts /
 * composed-of / deployed-in) contributes one animated dot per edge, but a single
 * sequence badge (placed on its first edge).
 *
 * @param flow - The active CalmFlow to render
 * @param edgeLayoutsByRelationship - Map from relationship-unique-id to the EdgeLayouts
 *   of every render edge expanded from that relationship
 * @returns SVG group string containing animated dots and sequence badge circles
 */
export function renderFlowOverlay(
  flow: CalmFlow,
  edgeLayoutsByRelationship: Map<string, EdgeLayout[]>
): string {
  const parts: string[] = ['<g class="flow-overlay">'];

  // Count transitions per relationship so badges on a shared edge can be
  // spread along the path instead of stacking at the midpoint.
  const perRelationshipCount = new Map<string, number>();
  for (const t of flow.transitions) {
    const id = t['relationship-unique-id'];
    perRelationshipCount.set(id, (perRelationshipCount.get(id) ?? 0) + 1);
  }
  const perRelationshipSeen = new Map<string, number>();

  for (const transition of flow.transitions) {
    const layouts = (edgeLayoutsByRelationship.get(transition['relationship-unique-id']) ?? []).filter(
      (l) => l.points.length >= 2
    );
    const badgeEdge = layouts[0];
    if (badgeEdge === undefined) continue;

    const direction = transition.direction ?? 'source-to-destination';
    const keyPoints = direction === 'destination-to-source' ? '1;0' : '0;1';

    for (const edge of layouts) {
      const pathId = `flow-path-${edge.id}`;

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
    }

    // One sequence badge per transition. Transitions sharing a relationship
    // spread along the first edge's path (k-th of n sits at (k+1)/(n+1)) so
    // request/response pairs never stack invisibly on the midpoint.
    const relId = transition['relationship-unique-id'];
    const seen = perRelationshipSeen.get(relId) ?? 0;
    perRelationshipSeen.set(relId, seen + 1);
    const count = perRelationshipCount.get(relId) ?? 1;
    const fraction = (seen + 1) / (count + 1);
    const badgePoint = pointAtFraction(badgeEdge.points, fraction);
    if (badgePoint === undefined) continue;
    // Reverse (response) badges shift perpendicular to the path — a "return
    // lane" beside the edge — so request/response pairs stay separated even
    // on edges shorter than a badge diameter.
    const isReverse = direction === 'destination-to-source';
    const normal = pathNormalAt(badgeEdge.points, fraction);
    const laneOffset = isReverse && normal !== undefined ? 22 : 0;
    const midX = badgePoint.x + (normal?.x ?? 0) * laneOffset;
    const midY = badgePoint.y + (normal?.y ?? 0) * laneOffset;

    // The flow schema defines `description` on transitions; `summary` was a
    // legacy CalmStudio field. Prefer the schema field, fall back for older files.
    const transitionLabel =
      transition.description ?? (transition as { summary?: string }).summary ?? '';
    // Static-render convention: forward (request) badges are solid; reverse
    // destination-to-source (response) badges render hollow, so direction is
    // legible without the animation.
    const badgeClass = isReverse ? 'flow-badge flow-badge-reverse' : 'flow-badge';
    const circleFill = isReverse ? '#ffffff' : '#3b82f6';
    const circleExtra = isReverse ? ' stroke="#3b82f6" stroke-width="2"' : '';
    const numberFill = isReverse ? '#3b82f6' : 'white';
    parts.push(
      `<g class="${badgeClass}" data-summary="${escapeAttr(transitionLabel)}">`,
      `  <circle cx="${midX}" cy="${midY}" r="10" fill="${circleFill}"${circleExtra}/>`,
      `  <text x="${midX}" y="${midY}" fill="${numberFill}" font-size="9" font-weight="bold" text-anchor="middle" dominant-baseline="central">${transition['sequence-number']}</text>`,
      `  <title>${escapeAttr(transitionLabel)}</title>`,
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
  for (const rel of arch.relationships ?? []) {
    if (flowEdgeIds.has(rel['unique-id'])) {
      for (const nodeId of getReferencedNodeIdsWithFlatFallback(rel)) {
        nodeIds.add(nodeId);
      }
    }
  }
  return nodeIds;
}

/**
 * Resolve the node ids referenced by a relationship, supporting both the
 * canonical nested `relationship-type` object and the legacy flat
 * CalmStudio shape (`relationship-type` as a string plus sibling
 * `source`/`destination` strings) as a fallback.
 */
function getReferencedNodeIdsWithFlatFallback(rel: CalmRelationship): string[] {
  const raw = rel as unknown as Record<string, unknown>;
  if (typeof raw['relationship-type'] === 'string') {
    const out: string[] = [];
    if (typeof raw.source === 'string') out.push(raw.source);
    if (typeof raw.destination === 'string') out.push(raw.destination);
    return out;
  }
  return getReferencedNodeIds(rel);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Point at a given fraction (0..1) of a polyline's total length. */
function pointAtFraction(
  points: Array<{ x: number; y: number }>,
  fraction: number
): { x: number; y: number } | undefined {
  if (points.length === 0) return undefined;
  const first = points[0];
  if (points.length === 1 || first === undefined) return first;
  let total = 0;
  const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; len: number }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len });
    total += len;
  }
  if (total === 0) return first;
  let target = Math.min(Math.max(fraction, 0), 1) * total;
  for (const seg of segments) {
    if (target <= seg.len) {
      const t = seg.len === 0 ? 0 : target / seg.len;
      return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
    }
    target -= seg.len;
  }
  const last = points[points.length - 1];
  return last;
}

/** Unit normal (perpendicular) of the polyline segment containing the fraction point. */
function pathNormalAt(
  points: Array<{ x: number; y: number }>,
  fraction: number
): { x: number; y: number } | undefined {
  if (points.length < 2) return undefined;
  // Locate the segment the fraction falls in (same walk as pointAtFraction).
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = a !== undefined && b !== undefined ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    lens.push(len);
    total += len;
  }
  if (total === 0) return undefined;
  let target = Math.min(Math.max(fraction, 0), 1) * total;
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i] ?? 0;
    if (target <= len) {
      const a = points[i];
      const b = points[i + 1];
      if (a === undefined || b === undefined || len === 0) return undefined;
      const tx = (b.x - a.x) / len;
      const ty = (b.y - a.y) / len;
      return { x: -ty, y: tx };
    }
    target -= len;
  }
  return undefined;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
