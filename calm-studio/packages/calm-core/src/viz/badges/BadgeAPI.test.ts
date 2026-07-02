import { describe, it, expect } from 'vitest';
import { createBadgeAPI } from './BadgeAPI';
import type { BadgeAdapter, Badge } from './types';

const stubAdapter = (name: string, badgesByNode: Record<string, Badge[]>): BadgeAdapter => ({
  name,
  forNode: (node) => badgesByNode[node['unique-id']] ?? [],
  forEdge: () => [],
});

const arch = {
  nodes: [{ 'unique-id': 'n1', 'node-type': 'service' }, { 'unique-id': 'n2', 'node-type': 'database' }],
  relationships: [],
} as any;

describe('createBadgeAPI', () => {
  it('merges badges across adapters in registration order', () => {
    const a = stubAdapter('a', {
      n1: [{ id: 'badge-a', source: 'a', kind: 'count', label: 'A' }],
    });
    const b = stubAdapter('b', {
      n1: [{ id: 'badge-b', source: 'b', kind: 'icon', label: 'B' }],
    });
    const api = createBadgeAPI(arch, [a, b]);
    const result = api.forNode('n1');
    expect(result).toHaveLength(2);
    expect(result.map((x) => x.source)).toEqual(['a', 'b']);
  });

  it('dedups by badge id (later wins)', () => {
    const a = stubAdapter('a', { n1: [{ id: 'shared', source: 'a', kind: 'count', label: 'first' }] });
    const b = stubAdapter('b', { n1: [{ id: 'shared', source: 'b', kind: 'count', label: 'second' }] });
    const api = createBadgeAPI(arch, [a, b]);
    expect(api.forNode('n1')).toEqual([{ id: 'shared', source: 'b', kind: 'count', label: 'second' }]);
  });

  it('returns empty array for unknown id', () => {
    const api = createBadgeAPI(arch, [stubAdapter('a', {})]);
    expect(api.forNode('does-not-exist')).toEqual([]);
  });

  it('handles empty adapter list', () => {
    const api = createBadgeAPI(arch, []);
    expect(api.forNode('n1')).toEqual([]);
  });
});
