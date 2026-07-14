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
    expect(edges).toEqual([{ id: 'rel-flat', source: 'a', target: 'b', variant: 'connects' }]);
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
      { id: 'rel-connects', source: 'web', target: 'api', variant: 'connects' },
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
      { id: 'rel-interacts__0', source: 'user', target: 'svc-a', variant: 'interacts' },
      { id: 'rel-interacts__1', source: 'user', target: 'svc-b', variant: 'interacts' },
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
      { id: 'rel-interacts-single', source: 'user', target: 'svc-a', variant: 'interacts' },
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
      { id: 'rel-composed__0', source: 'system', target: 'svc-a', variant: 'composed-of' },
      { id: 'rel-composed__1', source: 'system', target: 'svc-b', variant: 'composed-of' },
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
      { id: 'rel-deployed', source: 'cluster', target: 'svc-a', variant: 'deployed-in' },
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
});
