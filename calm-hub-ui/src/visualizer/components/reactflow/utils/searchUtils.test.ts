import { describe, it, expect } from 'vitest';
import { Node, Edge } from 'reactflow';
import { isNodeMatch, getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './searchUtils';

function makeNode(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        position: { x: 0, y: 0 },
        type: 'custom',
        data: {
            label: id,
            'unique-id': id,
            nodeType: 'service',
            ...overrides.data,
        },
        ...overrides,
    };
}

function makeEdge(id: string, source: string, target: string): Edge {
    return { id, source, target };
}

describe('isNodeMatch', () => {
    it('matches by label', () => {
        const node = makeNode('n1', { data: { label: 'My Service', nodeType: 'service' } });
        expect(isNodeMatch(node, 'service', '')).toBe(true);
        expect(isNodeMatch(node, 'unknown', '')).toBe(false);
    });

    it('matches by unique-id', () => {
        const node = makeNode('attendees-service', { data: { label: 'Attendees', 'unique-id': 'attendees-service', nodeType: 'service' } });
        expect(isNodeMatch(node, 'attendees-service', '')).toBe(true);
    });

    it('does not match by description', () => {
        const node = makeNode('n1', { data: { label: 'Svc', description: 'Handles payments', nodeType: 'service' } });
        expect(isNodeMatch(node, 'payment', '')).toBe(false);
    });

    it('matches by node type', () => {
        const node = makeNode('n1', { data: { label: 'DB', nodeType: 'database' } });
        expect(isNodeMatch(node, 'database', '')).toBe(true);
    });

    it('is case insensitive', () => {
        const node = makeNode('n1', { data: { label: 'Service A', nodeType: 'service' } });
        expect(isNodeMatch(node, 'SERVICE', '')).toBe(true);
    });

    it('always matches group nodes', () => {
        const node = makeNode('g1', { type: 'group', data: { label: 'System', nodeType: 'system' } });
        expect(isNodeMatch(node, 'nonexistent', '')).toBe(true);
    });

    it('always matches decisionGroup nodes', () => {
        const node = makeNode('d1', { type: 'decisionGroup', data: { label: 'Choice', nodeType: 'system' } });
        expect(isNodeMatch(node, 'nonexistent', '')).toBe(true);
    });

    it('filters by type', () => {
        const node = makeNode('n1', { data: { label: 'My Service', nodeType: 'service' } });
        expect(isNodeMatch(node, '', 'service')).toBe(true);
        expect(isNodeMatch(node, '', 'database')).toBe(false);
    });

    it('combines search term and type filter', () => {
        const node = makeNode('n1', { data: { label: 'My DB', nodeType: 'database' } });
        expect(isNodeMatch(node, 'DB', 'database')).toBe(true);
        expect(isNodeMatch(node, 'DB', 'service')).toBe(false);
    });

    it('returns true for all nodes when search is empty', () => {
        const node = makeNode('n1', { data: { label: 'Any', nodeType: 'service' } });
        expect(isNodeMatch(node, '', '')).toBe(true);
    });
});

describe('getMatchingNodeIds', () => {
    it('returns all IDs when search is empty', () => {
        const nodes = [makeNode('n1'), makeNode('n2')];
        const ids = getMatchingNodeIds(nodes, '', '');
        expect(ids.size).toBe(2);
        expect(ids.has('n1')).toBe(true);
        expect(ids.has('n2')).toBe(true);
    });

    it('returns only matching IDs', () => {
        const nodes = [
            makeNode('svc-1', { data: { label: 'Service A', nodeType: 'service' } }),
            makeNode('db-1', { data: { label: 'Database B', nodeType: 'database' } }),
        ];
        const ids = getMatchingNodeIds(nodes, 'Service', '');
        expect(ids.has('svc-1')).toBe(true);
        expect(ids.has('db-1')).toBe(false);
    });
});

describe('isEdgeVisible', () => {
    it('is visible when source matches', () => {
        const edge = makeEdge('e1', 'n1', 'n2');
        expect(isEdgeVisible(edge, new Set(['n1']))).toBe(true);
    });

    it('is visible when target matches', () => {
        const edge = makeEdge('e1', 'n1', 'n2');
        expect(isEdgeVisible(edge, new Set(['n2']))).toBe(true);
    });

    it('is not visible when neither endpoint matches', () => {
        const edge = makeEdge('e1', 'n1', 'n2');
        expect(isEdgeVisible(edge, new Set(['n3']))).toBe(false);
    });
});

describe('getUniqueNodeTypes', () => {
    it('returns sorted unique types', () => {
        const nodes = [
            makeNode('n1', { data: { nodeType: 'service' } }),
            makeNode('n2', { data: { nodeType: 'database' } }),
            makeNode('n3', { data: { nodeType: 'service' } }),
            makeNode('n4', { data: { nodeType: 'actor' } }),
        ];
        expect(getUniqueNodeTypes(nodes)).toEqual(['actor', 'database', 'service']);
    });

    it('excludes group and decisionGroup nodes', () => {
        const nodes = [
            makeNode('n1', { data: { nodeType: 'service' } }),
            makeNode('g1', { type: 'group', data: { nodeType: 'system' } }),
            makeNode('d1', { type: 'decisionGroup', data: { nodeType: 'system' } }),
        ];
        expect(getUniqueNodeTypes(nodes)).toEqual(['service']);
    });

    it('returns empty array for no nodes', () => {
        expect(getUniqueNodeTypes([])).toEqual([]);
    });
});
