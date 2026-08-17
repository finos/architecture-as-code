// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { relationshipToEdges } from './relationshipEdges.js';
import { renderELKDiagram } from './elkRender.js';
import type { CalmArchitecture, CalmRelationship } from '@calmstudio/calm-core';

describe('relationshipToEdges', () => {
  it('rule 1: legacy flat form produces one edge with the flat relationship-type as variant', () => {
    const rel = {
      'unique-id': 'rel-flat',
      'relationship-type': 'connects',
      source: 'a',
      destination: 'b',
    } as unknown as CalmRelationship;

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([{ id: 'rel-flat', relationshipId: 'rel-flat', source: 'a', target: 'b', variant: 'connects' }]);
  });

  it('rule 2: nested connects produces one edge via getConnectsEndpoints', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-connects',
      'relationship-type': {
        connects: {
          source: { node: 'web' },
          destination: { node: 'api' },
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-connects', relationshipId: 'rel-connects', source: 'web', target: 'api', variant: 'connects' },
    ]);
  });

  it('rule 3: nested interacts with 2 nodes produces 2 edges with __0/__1 ids', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-interacts',
      'relationship-type': {
        interacts: {
          actor: 'user',
          nodes: ['svc-a', 'svc-b'],
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-interacts__0', relationshipId: 'rel-interacts', source: 'user', target: 'svc-a', variant: 'interacts' },
      { id: 'rel-interacts__1', relationshipId: 'rel-interacts', source: 'user', target: 'svc-b', variant: 'interacts' },
    ]);
  });

  it('rule 3: nested interacts with 1 node produces a single edge with the plain uid', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-interacts-single',
      'relationship-type': {
        interacts: {
          actor: 'user',
          nodes: ['svc-a'],
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-interacts-single', relationshipId: 'rel-interacts-single', source: 'user', target: 'svc-a', variant: 'interacts' },
    ]);
  });

  it('rule 4: nested composed-of produces container->node edges', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-composed',
      'relationship-type': {
        'composed-of': {
          container: 'system',
          nodes: ['svc-a', 'svc-b'],
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-composed__0', relationshipId: 'rel-composed', source: 'system', target: 'svc-a', variant: 'composed-of' },
      { id: 'rel-composed__1', relationshipId: 'rel-composed', source: 'system', target: 'svc-b', variant: 'composed-of' },
    ]);
  });

  it('rule 4: nested deployed-in produces container->node edges', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-deployed',
      'relationship-type': {
        'deployed-in': {
          container: 'cluster',
          nodes: ['svc-a'],
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-deployed', relationshipId: 'rel-deployed', source: 'cluster', target: 'svc-a', variant: 'deployed-in' },
    ]);
  });

  it('rule 5: nested options produces no edges', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-options',
      'relationship-type': {
        options: [
          {
            description: 'option A',
            nodes: ['svc-a'],
            relationships: [],
          },
        ],
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([]);
  });

  it('rule 3b: nested interacts with an empty-string node entry filters it via validNodes', () => {
    const rel: CalmRelationship = {
      'unique-id': 'rel-interacts-blank',
      'relationship-type': {
        interacts: {
          actor: 'user',
          nodes: ['svc-a', '', 'svc-b'],
        },
      },
    };

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([
      { id: 'rel-interacts-blank__0', relationshipId: 'rel-interacts-blank', source: 'user', target: 'svc-a', variant: 'interacts' },
      { id: 'rel-interacts-blank__1', relationshipId: 'rel-interacts-blank', source: 'user', target: 'svc-b', variant: 'interacts' },
    ]);
    expect(edges.every((e) => e.target.length > 0)).toBe(true);
  });

  it('rule 6: nested connects with missing destination is defensively skipped', () => {
    const rel = {
      'unique-id': 'rel-missing-dest',
      'relationship-type': {
        connects: {
          source: { node: 'a' },
          destination: {},
        },
      },
    } as unknown as CalmRelationship;

    const edges = relationshipToEdges(rel);
    expect(edges).toEqual([]);
  });
});

describe('renderELKDiagram with nested relationship-type (integration)', () => {
  it('renders an edge for the canonical nested two-node connects fixture', async () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'web', 'node-type': 'actor', name: 'Web Client', description: 'Browser UI' },
        { 'unique-id': 'api', 'node-type': 'service', name: 'Trade API', description: 'Backend trade service' },
      ],
      relationships: [
        {
          'unique-id': 'web-to-api',
          'relationship-type': {
            connects: {
              source: { node: 'web' },
              destination: { node: 'api' },
            },
          },
          protocol: 'HTTPS',
        },
      ],
    };

    const svg = await renderELKDiagram(arch, { theme: 'light' });
    expect(svg).toContain('<svg');
    // The nested connects relationship must expand into an actual rendered edge.
    expect(svg).toContain('<polyline');
  });

  it('flow over a multi-node interacts relationship animates all fan-out edges undimmed', async () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'user', 'node-type': 'actor', name: 'User', description: 'End user' },
        { 'unique-id': 'svc-a', 'node-type': 'service', name: 'Service A', description: 'A' },
        { 'unique-id': 'svc-b', 'node-type': 'service', name: 'Service B', description: 'B' },
      ],
      relationships: [
        {
          'unique-id': 'user-uses',
          'relationship-type': {
            interacts: {
              actor: 'user',
              nodes: ['svc-a', 'svc-b'],
            },
          },
        },
      ],
      flows: [
        {
          'unique-id': 'usage-flow',
          name: 'Usage Flow',
          description: 'User interacts with both services',
          transitions: [
            {
              'relationship-unique-id': 'user-uses',
              'sequence-number': 1,
              summary: 'User calls both services',
              direction: 'source-to-destination',
            },
          ],
        },
      ],
    };

    const svg = await renderELKDiagram(arch, { theme: 'light', flow: 'usage-flow' });
    // Both fan-out edges (ids user-uses__0 / user-uses__1) must carry the animation...
    const animCount = (svg.match(/<animateMotion/g) ?? []).length;
    expect(animCount).toBe(2);
    // ...and neither may be dimmed: the only relationship present IS the flow.
    expect(svg).not.toContain('opacity="0.3"');
  });
});
