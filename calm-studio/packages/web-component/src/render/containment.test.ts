// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { planContainment, isNestedContainment, emptyContainmentPlan } from './containment.js';
import type { CalmRelationship } from '@calmstudio/calm-core';

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

  it('unknown member id falls back to an edge (renderer would drop it, but identity is preserved)', () => {
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
