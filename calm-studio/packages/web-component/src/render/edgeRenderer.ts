// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

// ---------------------------------------------------------------------------
// Edge stroke styles per CALM relationship type
// ---------------------------------------------------------------------------

const RELATIONSHIP_DASH: Record<string, string> = {
  connects: 'none',
  interacts: '6,3',
  'deployed-in': '2,3',
  'composed-of': '8,2,2,2',
  options: '4,4,1,4',
};

const DEFAULT_DASH = 'none';

/**
 * Returns SVG <defs> containing arrow markers for each relationship type.
 */
export function renderEdgeMarkers(): string {
  return [
    '<defs>',
    // Single reusable arrow marker
    '<marker id="calm-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse">',
    '  <path d="M 0 0 L 10 5 L 0 10 z" fill="#555"/>',
    '</marker>',
    // Dashed edge marker (same shape, different color for interacts)
    '<marker id="calm-arrow-dashed" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse">',
    '  <path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/>',
    '</marker>',
    '</defs>',
  ].join('\n');
}

export interface EdgePoint {
  x: number;
  y: number;
}

export interface RenderEdgeInput {
  id: string;
  points: EdgePoint[];
  relationshipType?: string;
}

/**
 * Build SVG for a single edge: polyline with arrow marker.
 * Stroke style varies by relationship type.
 */
export function renderEdgeSvg(edge: RenderEdgeInput): string {
  if (edge.points.length < 2) return '';

  const relType = edge.relationshipType ?? 'connects';
  const dashArray = RELATIONSHIP_DASH[relType] ?? DEFAULT_DASH;
  const strokeColor = relType === 'interacts' ? '#888' : '#555';
  const markerId = relType === 'interacts' ? 'calm-arrow-dashed' : 'calm-arrow';

  const pointsStr = edge.points.map((p) => `${p.x},${p.y}`).join(' ');
  const dashAttr = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';

  return `<polyline points="${pointsStr}" fill="none" stroke="${strokeColor}" stroke-width="1.5"${dashAttr} marker-end="url(#${markerId})"/>`;
}
