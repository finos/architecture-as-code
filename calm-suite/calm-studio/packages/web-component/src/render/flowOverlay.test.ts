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
    {
      id: 'rel-1',
      points: [
        { x: 10, y: 20 },
        { x: 100, y: 20 },
        { x: 200, y: 80 },
      ],
    },
  ],
  [
    'rel-2',
    {
      id: 'rel-2',
      points: [
        { x: 200, y: 80 },
        { x: 300, y: 80 },
      ],
    },
  ],
  [
    'rel-3',
    {
      id: 'rel-3',
      points: [
        { x: 300, y: 80 },
        { x: 350, y: 150 },
        { x: 400, y: 200 },
      ],
    },
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

  it('Test 4: renders sequence badge with correct number for each transition', () => {
    const svg = renderFlowOverlay(sampleFlow, twoEdgeLayouts);
    // Sequence numbers 1 and 2 should appear in badge text elements
    expect(svg).toContain('>1<');
    expect(svg).toContain('>2<');
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
