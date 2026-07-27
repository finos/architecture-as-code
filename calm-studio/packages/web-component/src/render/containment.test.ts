// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { planContainment, isNestedContainment, emptyContainmentPlan } from './containment.js';
import type { CalmRelationship } from '@calmstudio/calm-core';
import { renderELKDiagram } from './elkRender.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

function composedOf(uid: string, container: string, nodes: string[]): CalmRelationship {
  return { 'unique-id': uid, 'relationship-type': { 'composed-of': { container, nodes } } };
}
function deployedIn(uid: string, container: string, nodes: string[]): CalmRelationship {
  return { 'unique-id': uid, 'relationship-type': { 'deployed-in': { container, nodes } } };
}
function connects(uid: string, source: string, destination: string): CalmRelationship {
  return {
    'unique-id': uid,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
  };
}

const KNOWN = new Set(['sys', 'svc-a', 'svc-b', 'cluster', 'db']);

describe('isNestedContainment', () => {
  it('true for nested composed-of and deployed-in', () => {
    expect(isNestedContainment(composedOf('r', 'sys', ['svc-a']))).toBe(true);
    expect(isNestedContainment(deployedIn('r', 'cluster', ['svc-a']))).toBe(true);
  });
  it('false for connects, options, and legacy flat', () => {
    expect(isNestedContainment(connects('r', 'svc-a', 'db'))).toBe(false);
    const flat = {
      'unique-id': 'r-flat',
      'relationship-type': 'composed-of',
      source: 'sys',
      destination: 'svc-a',
    } as unknown as CalmRelationship;
    expect(isNestedContainment(flat)).toBe(false);
  });
});

describe('planContainment', () => {
  it('nests a basic composed-of and consumes the relationship', () => {
    const plan = planContainment([composedOf('r1', 'sys', ['svc-a', 'svc-b'])], KNOWN);
    expect(plan.childrenOf.get('sys')).toEqual(['svc-a', 'svc-b']);
    expect(plan.parentOf.get('svc-a')).toBe('sys');
    expect(plan.fallbackEdges).toEqual([]);
    expect(plan.consumedRelationshipIds.has('r1')).toBe(true);
  });

  it('supports nesting inside nesting (cluster ⊃ sys ⊃ svc-a)', () => {
    const plan = planContainment(
      [composedOf('r1', 'sys', ['svc-a']), deployedIn('r2', 'cluster', ['sys'])],
      KNOWN
    );
    expect(plan.parentOf.get('svc-a')).toBe('sys');
    expect(plan.parentOf.get('sys')).toBe('cluster');
  });

  it('double claim: first wins, second becomes a fallback edge with fan-out id rules', () => {
    const plan = planContainment(
      [composedOf('r1', 'sys', ['svc-a']), deployedIn('r2', 'cluster', ['svc-a'])],
      KNOWN
    );
    expect(plan.parentOf.get('svc-a')).toBe('sys');
    expect(plan.fallbackEdges).toEqual([
      { id: 'r2', relationshipId: 'r2', source: 'cluster', target: 'svc-a', variant: 'deployed-in' },
    ]);
    expect(plan.consumedRelationshipIds.has('r2')).toBe(false);
  });

  it('partial fallback uses __N suffixes when a relationship yields 2+ fallback edges', () => {
    const plan = planContainment(
      [
        composedOf('r1', 'sys', ['svc-a', 'svc-b']),
        deployedIn('r2', 'cluster', ['svc-a', 'svc-b', 'db']),
      ],
      KNOWN
    );
    // svc-a and svc-b already claimed by r1; db nests under cluster
    expect(plan.parentOf.get('db')).toBe('cluster');
    expect(plan.fallbackEdges).toEqual([
      { id: 'r2__0', relationshipId: 'r2', source: 'cluster', target: 'svc-a', variant: 'deployed-in' },
      { id: 'r2__1', relationshipId: 'r2', source: 'cluster', target: 'svc-b', variant: 'deployed-in' },
    ]);
  });

  it('cycle: second claim that would create a cycle falls back to an edge', () => {
    const plan = planContainment(
      [composedOf('r1', 'sys', ['svc-a']), composedOf('r2', 'svc-a', ['sys'])],
      KNOWN
    );
    expect(plan.parentOf.get('svc-a')).toBe('sys');
    expect(plan.fallbackEdges).toEqual([
      { id: 'r2', relationshipId: 'r2', source: 'svc-a', target: 'sys', variant: 'composed-of' },
    ]);
  });

  it('self-claim falls back to an edge', () => {
    const plan = planContainment([composedOf('r1', 'sys', ['sys', 'svc-a'])], KNOWN);
    expect(plan.parentOf.get('svc-a')).toBe('sys');
    expect(plan.fallbackEdges).toEqual([
      { id: 'r1', relationshipId: 'r1', source: 'sys', target: 'sys', variant: 'composed-of' },
    ]);
  });

  it('unknown member id falls back to an edge (a dangling ref later fails the render loudly)', () => {
    const plan = planContainment([composedOf('r1', 'sys', ['ghost'])], KNOWN);
    expect(plan.childrenOf.size).toBe(0);
    expect(plan.fallbackEdges).toEqual([
      { id: 'r1', relationshipId: 'r1', source: 'sys', target: 'ghost', variant: 'composed-of' },
    ]);
  });

  it('unknown container id: all claims fall back', () => {
    const plan = planContainment([composedOf('r1', 'ghost', ['svc-a'])], KNOWN);
    expect(plan.childrenOf.size).toBe(0);
    expect(plan.fallbackEdges).toEqual([
      { id: 'r1', relationshipId: 'r1', source: 'ghost', target: 'svc-a', variant: 'composed-of' },
    ]);
  });

  it('ignores connects and legacy flat relationships entirely', () => {
    const flat = {
      'unique-id': 'r-flat',
      'relationship-type': 'composed-of',
      source: 'sys',
      destination: 'svc-a',
    } as unknown as CalmRelationship;
    const plan = planContainment([connects('rc', 'svc-a', 'db'), flat], KNOWN);
    expect(plan.childrenOf.size).toBe(0);
    expect(plan.fallbackEdges).toEqual([]);
    expect(plan.consumedRelationshipIds.size).toBe(0);
  });

  it('emptyContainmentPlan returns an inert plan', () => {
    const plan = emptyContainmentPlan();
    expect(plan.childrenOf.size).toBe(0);
    expect(plan.parentOf.size).toBe(0);
    expect(plan.fallbackEdges).toEqual([]);
    expect(plan.consumedRelationshipIds.size).toBe(0);
  });
});

const nestedArch: CalmArchitecture = {
  nodes: [
    { 'unique-id': 'sys', 'node-type': 'system', name: 'Trading System', description: 'The system' },
    { 'unique-id': 'svc-a', 'node-type': 'service', name: 'Service A', description: 'A' },
    { 'unique-id': 'svc-b', 'node-type': 'service', name: 'Service B', description: 'B' },
    { 'unique-id': 'db', 'node-type': 'database', name: 'Main DB', description: 'DB' },
  ],
  relationships: [
    {
      'unique-id': 'sys-contains',
      'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc-a', 'svc-b'] } },
    },
    {
      'unique-id': 'a-to-db',
      'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'db' } } },
    },
  ],
};

describe('renderELKDiagram nested containers (integration)', () => {
  it('renders a container box with data attrs and NO containment arrow (default nested)', async () => {
    const svg = await renderELKDiagram(nestedArch, { theme: 'light' });
    expect(svg).toContain('data-container-id="sys"');
    expect(svg).toContain('Trading System');
    // Containment fully consumed: only the connects edge remains
    const polylines = (svg.match(/<polyline/g) ?? []).length;
    expect(polylines).toBe(1);
  });

  it('positions member nodes inside the container bounds', async () => {
    const svg = await renderELKDiagram(nestedArch, { theme: 'light' });
    const container = /data-container-id="sys"[^>]*data-bounds="([\d.,-]+)"/.exec(svg);
    expect(container).not.toBeNull();
    const boundsRaw = (container as RegExpExecArray)[1] as string;
    const [cx, cy, cw, ch] = boundsRaw.split(',').map(Number) as [number, number, number, number];
    // Each member node's x/y must fall inside the container bounds.
    // NOTE FOR IMPLEMENTER: before finalizing this regex, inspect what
    // renderNodeSvg actually emits (grep the node group markup for 'svc-a' in a
    // console.log of the svg) — it may use a translate() transform OR x/y attrs
    // on the group's <rect>. Adapt ONLY the coordinate-extraction regex to the
    // real markup; keep these numeric containment assertions exactly as written.
    for (const member of ['svc-a', 'svc-b']) {
      const m = new RegExp(`data-node-id="${member}"[\\s\\S]{0,200}?<rect x="([\\d.]+)" y="([\\d.]+)"`).exec(svg);
      expect(m).not.toBeNull();
      const mx = Number((m as RegExpExecArray)[1]);
      const my = Number((m as RegExpExecArray)[2]);
      expect(mx).toBeGreaterThanOrEqual(cx);
      expect(my).toBeGreaterThanOrEqual(cy);
      expect(mx).toBeLessThanOrEqual(cx + cw);
      expect(my).toBeLessThanOrEqual(cy + ch);
    }
  });

  it("containers: 'edges' reproduces the arrow behavior with no container box", async () => {
    const svg = await renderELKDiagram(nestedArch, { theme: 'light', containers: 'edges' });
    expect(svg).not.toContain('data-container-id');
    // composed-of fan-out (2 members) + connects = 3 polylines
    const polylines = (svg.match(/<polyline/g) ?? []).length;
    expect(polylines).toBe(3);
  });

  it('doubly-claimed node: one box plus one fallback arrow', async () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'sys', 'node-type': 'system', name: 'Sys', description: 's' },
        { 'unique-id': 'cluster', 'node-type': 'network', name: 'Cluster', description: 'c' },
        { 'unique-id': 'svc-a', 'node-type': 'service', name: 'Service A', description: 'a' },
      ],
      relationships: [
        { 'unique-id': 'r1', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc-a'] } } },
        { 'unique-id': 'r2', 'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['svc-a'] } } },
      ],
    };
    const svg = await renderELKDiagram(arch, { theme: 'light' });
    expect(svg).toContain('data-container-id="sys"');
    // cluster keeps no members -> renders as a normal leaf node, with the fallback edge to svc-a
    const polylines = (svg.match(/<polyline/g) ?? []).length;
    expect(polylines).toBe(1);
  });

  it('flow referencing a consumed containment relationship renders no dot and does not crash', async () => {
    const arch: CalmArchitecture = {
      ...nestedArch,
      flows: [
        {
          'unique-id': 'f1',
          name: 'F',
          description: 'd',
          transitions: [
            { 'relationship-unique-id': 'sys-contains', 'sequence-number': 1, summary: 's', direction: 'source-to-destination' },
          ],
        },
      ],
    };
    const svg = await renderELKDiagram(arch, { theme: 'light', flow: 'f1' });
    expect((svg.match(/<animateMotion/g) ?? []).length).toBe(0);
    expect(svg).toContain('data-container-id="sys"');
  });

  it('renders 3-level nesting with each box inside its parent bounds', async () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'cluster', 'node-type': 'network', name: 'Cluster', description: 'c' },
        { 'unique-id': 'sys', 'node-type': 'system', name: 'Sys', description: 's' },
        { 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: 'v' },
      ],
      relationships: [
        { 'unique-id': 'r1', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc'] } } },
        { 'unique-id': 'r2', 'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['sys'] } } },
      ],
    };
    const svg = await renderELKDiagram(arch, { theme: 'light', direction: 'RIGHT' });
    const outer = /data-container-id="cluster"[^>]*data-bounds="([\d.,-]+)"/.exec(svg);
    const inner = /data-container-id="sys"[^>]*data-bounds="([\d.,-]+)"/.exec(svg);
    expect(outer).not.toBeNull();
    expect(inner).not.toBeNull();
    const [ox, oy, ow, oh] = (outer as RegExpExecArray)[1]!.split(',').map(Number) as [number, number, number, number];
    const [ix, iy, iw, ih] = (inner as RegExpExecArray)[1]!.split(',').map(Number) as [number, number, number, number];
    expect(ix).toBeGreaterThanOrEqual(ox);
    expect(iy).toBeGreaterThanOrEqual(oy);
    expect(ix + iw).toBeLessThanOrEqual(ox + ow);
    expect(iy + ih).toBeLessThanOrEqual(oy + oh);
  });

  it('a container can be a connects endpoint (edge terminates at the box)', async () => {
    const arch: CalmArchitecture = {
      nodes: [
        { 'unique-id': 'sys', 'node-type': 'system', name: 'Sys', description: 's' },
        { 'unique-id': 'svc', 'node-type': 'service', name: 'Svc', description: 'v' },
        { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: 'd' },
      ],
      relationships: [
        { 'unique-id': 'r1', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc'] } } },
        { 'unique-id': 'r2', 'relationship-type': { connects: { source: { node: 'sys' }, destination: { node: 'db' } } } },
      ],
    };
    const svg = await renderELKDiagram(arch, { theme: 'light' });
    expect(svg).toContain('data-container-id="sys"');
    expect((svg.match(/<polyline/g) ?? []).length).toBe(1);
  });
});
