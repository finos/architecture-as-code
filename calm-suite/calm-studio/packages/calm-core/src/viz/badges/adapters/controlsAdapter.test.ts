// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { controlsAdapter } from './controlsAdapter.js';
import type { CalmArchitecture, CalmNode } from '../../../types.js';

describe('controlsAdapter', () => {
  const emptyArch: CalmArchitecture = { nodes: [], relationships: [] } as unknown as CalmArchitecture;

  it('emits no badge for node with no controls', () => {
    const node = { 'unique-id': 'n1', 'node-type': 'service' } as unknown as CalmNode;
    expect(controlsAdapter.forNode(node, emptyArch)).toEqual([]);
  });

  it('emits a single count badge for node with controls', () => {
    const node = {
      'unique-id': 'n1',
      'node-type': 'service',
      controls: {
        C1: {
          description: 'x',
          requirements: [{ config: { 'control-id': 'C1', mitigates: ['T1'] } }],
        },
        C2: {
          description: 'y',
          requirements: [{ config: { 'control-id': 'C2', mitigates: ['T2', 'T3'] } }],
        },
      },
    } as unknown as CalmNode;
    const badges = controlsAdapter.forNode(node, emptyArch);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({ source: 'controls', kind: 'count' });
    expect(badges[0].data?.count).toBe(2);
    expect(badges[0].data?.mitigations).toBe(3);
  });

  it('severity scales with control count', () => {
    const mkNode = (ctrlCount: number, mitsEach: number): CalmNode =>
      ({
        'unique-id': 'n',
        'node-type': 'service',
        controls: Object.fromEntries(
          Array.from({ length: ctrlCount }, (_, i) => [
            `C${i}`,
            {
              description: '',
              requirements: [{ config: { 'control-id': `C${i}`, mitigates: Array(mitsEach).fill('T') } }],
            },
          ]),
        ),
      }) as unknown as CalmNode;

    expect(controlsAdapter.forNode(mkNode(1, 1), emptyArch)[0].severity).toBe('low');
    expect(controlsAdapter.forNode(mkNode(2, 1), emptyArch)[0].severity).toBe('low');
    expect(controlsAdapter.forNode(mkNode(3, 1), emptyArch)[0].severity).toBe('medium');
    expect(controlsAdapter.forNode(mkNode(6, 1), emptyArch)[0].severity).toBe('high');
  });

  it('emits nothing for edges (controls live on nodes in CALM 1.2)', () => {
    const edge = {
      'unique-id': 'r1',
      'relationship-type': { connects: {} },
    } as unknown as Parameters<typeof controlsAdapter.forEdge>[0];
    expect(controlsAdapter.forEdge(edge, emptyArch)).toEqual([]);
  });

  it('produces a stable badge id derived from node id', () => {
    const node = {
      'unique-id': 'service-a',
      'node-type': 'service',
      controls: {
        C1: { description: '', requirements: [{ config: { 'control-id': 'C1', mitigates: [] } }] },
      },
    } as unknown as CalmNode;
    expect(controlsAdapter.forNode(node, emptyArch)[0].id).toBe('controls-service-a');
  });
});
