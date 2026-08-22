// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderFlowOverlay, applyFlowDimming, getFlowNodeIds } from './flowOverlay.js';
import type { CalmFlow, CalmArchitecture } from '@calmstudio/calm-core';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const twoEdgeLayouts = new Map([
  [
    'rel-1',
    [{
      id: 'rel-1',
      points: [
        { x: 10, y: 20 },
        { x: 100, y: 20 },
        { x: 200, y: 80 },
      ],
    }],
  ],
  [
    'rel-2',
    [{
      id: 'rel-2',
      points: [
        { x: 200, y: 80 },
        { x: 300, y: 80 },
      ],
    }],
  ],
  [
    'rel-3',
    [{
      id: 'rel-3',
      points: [
        { x: 300, y: 80 },
        { x: 350, y: 150 },
        { x: 400, y: 200 },
      ],
    }],
  ],
]);

const sampleFlow: CalmFlow = {
  'unique-id': 'order-flow',
  name: 'Order Flow',
  description: 'Data flow for order processing',
  transitions: [
    {
      'relationship-unique-id': 'rel-1',
      'sequence-number': 1,
      summary: 'Client sends order request',
      direction: 'source-to-destination',
    },
    {
      'relationship-unique-id': 'rel-2',
      'sequence-number': 2,
      summary: 'Service processes order',
      direction: 'source-to-destination',
    },
  ],
};

const reverseFlow: CalmFlow = {
  'unique-id': 'reverse-flow',
  name: 'Reverse Flow',
  description: 'Response flow going back',
  transitions: [
    {
      'relationship-unique-id': 'rel-1',
      'sequence-number': 1,
      summary: 'Response sent back',
      direction: 'destination-to-source',
    },
  ],
};

const multiEdgeFlow: CalmFlow = {
  'unique-id': 'multi-flow',
  name: 'Multi Edge Flow',
  description: 'Flow across 3 edges',
  transitions: [
    {
      'relationship-unique-id': 'rel-1',
      'sequence-number': 1,
      summary: 'Step one',
      direction: 'source-to-destination',
    },
    {
      'relationship-unique-id': 'rel-2',
      'sequence-number': 2,
      summary: 'Step two',
      direction: 'source-to-destination',
    },
    {
      'relationship-unique-id': 'rel-3',
      'sequence-number': 3,
      summary: 'Step three',
      direction: 'source-to-destination',
    },
  ],
};

const sampleArch: CalmArchitecture = {
  nodes: [
    { 'unique-id': 'node-a', 'node-type': 'service', name: 'Service A', description: 'A' },
    { 'unique-id': 'node-b', 'node-type': 'service', name: 'Service B', description: 'B' },
    { 'unique-id': 'node-c', 'node-type': 'database', name: 'DB C', description: 'C' },
  ],
  relationships: [
    {
      'unique-id': 'rel-1',
      'relationship-type': 'connects',
      source: 'node-a',
      destination: 'node-b',
    },
    {
      'unique-id': 'rel-2',
      'relationship-type': 'connects',
      source: 'node-b',
      destination: 'node-c',
    },
    {
      'unique-id': 'rel-3',
      'relationship-type': 'connects',
      source: 'node-c',
      destination: 'node-a',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests for renderFlowOverlay
// ---------------------------------------------------------------------------

describe('renderFlowOverlay', () => {
  it('Test 1: returns SVG string containing animateMotion element for each transition', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    expect(svg).toContain('animateMotion');
    // Two transitions => two animateMotion elements
    const count = (svg.match(/animateMotion/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('Test 2: sets keyPoints="1;0" when direction is "destination-to-source"', () => {
    const svg = renderFlowOverlay(reverseFlow, twoEdgeLayouts);
    expect(svg).toContain('keyPoints="1;0"');
  });

  it('Test 3: sets keyPoints="0;1" when direction is "source-to-destination" (default)', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    expect(svg).toContain('keyPoints="0;1"');
  });

  it('renders badges from the schema description field when summary is absent', () => {
    const schemaFlow: CalmFlow = {
      'unique-id': 'schema-flow',
      name: 'Schema Flow',
      description: 'Flow using only schema-defined fields',
      transitions: [
        {
          'relationship-unique-id': 'rel-1',
          'sequence-number': 1,
          description: 'Client sends order request',
          direction: 'source-to-destination',
        },
      ],
    };
    const svg = renderFlowOverlay(schemaFlow, twoEdgeLayouts);
    expect(svg).toContain('Client sends order request');
    expect(svg).not.toContain('undefined');
  });

  it('Test 4: renders sequence badge with correct number for each transition', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    // Sequence numbers 1 and 2 should appear in badge text elements
    expect(svg).toContain('>1<');
    expect(svg).toContain('>2<');
  });

  it('animates along every fan-out edge of a multi-node relationship and renders one badge', () => {
    const fanOutLayouts = new Map([
      [
        'rel-fan',
        [
          {
            id: 'rel-fan__0',
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 50 },
            ],
          },
          {
            id: 'rel-fan__1',
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 100 },
            ],
          },
        ],
      ],
    ]);
    const fanFlow: CalmFlow = {
      'unique-id': 'fan-flow',
      name: 'Fan Flow',
      description: 'Flow over a fan-out relationship',
      transitions: [
        {
          'relationship-unique-id': 'rel-fan',
          'sequence-number': 1,
          summary: 'Actor interacts with both services',
          direction: 'source-to-destination',
        },
      ],
    };
    const svg = renderFlowOverlay(fanFlow, fanOutLayouts);
    const animCount = (svg.match(/<animateMotion/g) ?? []).length;
    expect(animCount).toBe(2);
    expect(svg).toContain('flow-path-rel-fan__0');
    expect(svg).toContain('flow-path-rel-fan__1');
    const badgeCount = (svg.match(/class="flow-badge"/g) ?? []).length;
    expect(badgeCount).toBe(1);
  });

  it('spreads badges when multiple transitions share a relationship, and all remain visible', () => {
    const sharedFlow: CalmFlow = {
      'unique-id': 'shared-flow',
      name: 'Shared',
      description: 'Two transitions over one relationship',
      transitions: [
        {
          'relationship-unique-id': 'rel-1',
          'sequence-number': 1,
          description: 'Request',
          direction: 'source-to-destination',
        },
        {
          'relationship-unique-id': 'rel-1',
          'sequence-number': 2,
          description: 'Response',
          direction: 'destination-to-source',
        },
      ],
    };
    const svg = renderFlowOverlay(sharedFlow, twoEdgeLayouts);
    const badges = (svg.match(/class="flow-badge/g) ?? []).length;
    expect(badges).toBe(2);
    expect(svg).toContain('>1<');
    expect(svg).toContain('>2<');
    // Badge centers must not coincide: collect cx values of badge circles
    const cxs = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="10"/g)].map((m) => m[1] + ',' + m[2]);
    expect(new Set(cxs).size).toBe(cxs.length);
  });

  it('separates request/response badges even on a short edge (return-lane offset)', () => {
    const shortLayouts = new Map([
      ['rel-s', [{ id: 'rel-s', points: [ { x: 100, y: 100 }, { x: 100, y: 140 } ] }]],
    ]);
    const rrFlow: CalmFlow = {
      'unique-id': 'rr',
      name: 'RR',
      description: 'request-response on a 40px edge',
      transitions: [
        { 'relationship-unique-id': 'rel-s', 'sequence-number': 1, description: 'req', direction: 'source-to-destination' },
        { 'relationship-unique-id': 'rel-s', 'sequence-number': 2, description: 'res', direction: 'destination-to-source' },
      ],
    };
    const svg = renderFlowOverlay(rrFlow, shortLayouts);
    const centers = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="10"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(centers.length).toBe(2);
    const [a, b] = centers as [[number, number], [number, number]];
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(dist).toBeGreaterThanOrEqual(18);
  });

  it('renders destination-to-source badges hollow (response convention)', () => {
    const svg = renderFlowOverlay(reverseFlow, twoEdgeLayouts);
    // reverseFlow's single transition is destination-to-source
    expect(svg).toContain('class="flow-badge flow-badge-reverse"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('forward badges stay solid', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    expect(svg).not.toContain('flow-badge-reverse');
  });

  it('labels badges from legacy summary-only transitions (backward compatibility)', () => {
    const legacyFlow = {
      'unique-id': 'legacy-flow',
      name: 'Legacy',
      description: 'summary-only transition',
      transitions: [
        {
          'relationship-unique-id': 'rel-1',
          'sequence-number': 1,
          summary: 'Legacy label text',
          direction: 'source-to-destination',
        },
      ],
    } as unknown as CalmFlow;
    const svg = renderFlowOverlay(legacyFlow, twoEdgeLayouts);
    expect(svg).toContain('Legacy label text');
    expect(svg).not.toContain('undefined');
  });

  it('prefers description over summary when both are present', () => {
    const bothFlow = {
      'unique-id': 'both-flow',
      name: 'Both',
      description: 'both fields',
      transitions: [
        {
          'relationship-unique-id': 'rel-1',
          'sequence-number': 1,
          description: 'Schema label',
          summary: 'Legacy label',
          direction: 'source-to-destination',
        },
      ],
    } as unknown as CalmFlow;
    const svg = renderFlowOverlay(bothFlow, twoEdgeLayouts);
    expect(svg).toContain('Schema label');
    expect(svg).not.toContain('Legacy label');
  });

  it('orders badge spread by sequence-number, not document order', () => {
    const outOfOrder: CalmFlow = {
      'unique-id': 'ooo',
      name: 'OOO',
      description: 'transitions listed out of sequence',
      transitions: [
        { 'relationship-unique-id': 'rel-1', 'sequence-number': 2, description: 'second', direction: 'source-to-destination' },
        { 'relationship-unique-id': 'rel-1', 'sequence-number': 1, description: 'first', direction: 'source-to-destination' },
      ],
    };
    const svg = renderFlowOverlay(outOfOrder, twoEdgeLayouts);
    // rel-1's path starts at (10,20) and heads toward (200,80): earlier along
    // the path = smaller x. Badge "1" must sit earlier than badge "2".
    const badge1 = /<circle cx="([\d.]+)" [^>]*\/>\s*<text[^>]*>1</.exec(svg.replace(/\n/g, ' '));
    const badge2 = /<circle cx="([\d.]+)" [^>]*\/>\s*<text[^>]*>2</.exec(svg.replace(/\n/g, ' '));
    expect(badge1).not.toBeNull();
    expect(badge2).not.toBeNull();
    expect(Number((badge1 as RegExpExecArray)[1])).toBeLessThan(Number((badge2 as RegExpExecArray)[1]));
  });

  it('keeps a lone reverse badge on the path (no lateral offset when uncrowded)', () => {
    const svg = renderFlowOverlay(reverseFlow, twoEdgeLayouts);
    // reverseFlow: single destination-to-source transition on rel-1. Midpoint of
    // rel-1's path by length lies on the segment (10,20)->(100,20)->(200,80);
    // whatever the exact point, an uncrowded badge must sit ON the polyline.
    const m = /<circle cx="([\d.]+)" cy="([\d.]+)" r="10"/.exec(svg);
    expect(m).not.toBeNull();
    const x = Number((m as RegExpExecArray)[1]);
    const y = Number((m as RegExpExecArray)[2]);
    // On-path check: y must be 20 (first segment) or on the second segment line
    const onFirst = Math.abs(y - 20) < 0.01 && x >= 10 && x <= 100;
    const onSecond = x >= 100 && x <= 200 && Math.abs((y - 20) / (x - 100) - 60 / 100) < 0.01;
    expect(onFirst || onSecond).toBe(true);
  });

  it('emits rounded coordinates (max 2 decimal places)', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    expect(/\d\.\d{3,}/.test(svg)).toBe(false);
  });

  it('uses data-description on badges', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    expect(svg).toContain('data-description=');
    expect(svg).not.toContain('data-summary=');
  });

  it('Test 7: handles flow with 3+ transitions (multi-edge flow)', () => {
    const svg = renderFlowOverlay(multiEdgeFlow, twoEdgeLayouts);
    // Three transitions, rel-3 exists in layout
    const animCount = (svg.match(/animateMotion/g) ?? []).length;
    expect(animCount).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('>3<');
  });
});

// ---------------------------------------------------------------------------
// Tests for applyFlowDimming
// ---------------------------------------------------------------------------

describe('applyFlowDimming', () => {
  const activeEdgeIds = new Set(['rel-1', 'rel-2']);

  it('Test 5: returns opacity "0.3" for edges not in the active flow', () => {
    const opacity = applyFlowDimming('rel-3', activeEdgeIds, true);
    expect(opacity).toBe('0.3');
  });

  it('Test 6: returns opacity "1" for edges in the active flow', () => {
    const opacity = applyFlowDimming('rel-1', activeEdgeIds, true);
    expect(opacity).toBe('1');
  });

  it('returns "1" when activeFlowEdgeIds is empty (no flow active)', () => {
    const opacity = applyFlowDimming('rel-anything', new Set(), true);
    expect(opacity).toBe('1');
  });

  it('returns "1" for nodes even when a flow is active', () => {
    const opacity = applyFlowDimming('node-x', activeEdgeIds, false);
    expect(opacity).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Tests for getFlowNodeIds
// ---------------------------------------------------------------------------

describe('getFlowNodeIds', () => {
  it('returns correct source/destination node IDs for flow transitions', () => {
    const nodeIds = getFlowNodeIds(sampleArch, sampleFlow);
    // rel-1: node-a -> node-b, rel-2: node-b -> node-c
    expect(nodeIds.has('node-a')).toBe(true);
    expect(nodeIds.has('node-b')).toBe(true);
    expect(nodeIds.has('node-c')).toBe(true);
    // node-c is only in rel-2 which IS in flow
    expect(nodeIds.size).toBe(3);
  });

  it('returns empty set when flow has no transitions', () => {
    const emptyFlow: CalmFlow = {
      'unique-id': 'empty-flow',
      name: 'Empty',
      description: 'No transitions',
      transitions: [],
    };
    const nodeIds = getFlowNodeIds(sampleArch, emptyFlow);
    expect(nodeIds.size).toBe(0);
  });
});
