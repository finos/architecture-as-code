import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';

/**
 * Tests for the liveSelectedNode derivation logic used in App.tsx.
 *
 * The derivation: given a stale `selectedNode` snapshot and the current
 * `nodes` array, resolve the live version by ID. Falls back to the stale
 * snapshot if the node is no longer in the array (deleted mid-render).
 */
function resolveLiveSelectedNode(
    selectedNode: Node | null,
    nodes: Node[]
): Node | null {
    if (!selectedNode) return null;
    return nodes.find((n) => n.id === selectedNode.id) ?? selectedNode;
}

function makeNode(id: string, overrides?: Partial<Node>): Node {
    return {
        id,
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: id, calmType: 'service', description: '' },
        ...overrides,
    };
}

describe('liveSelectedNode derivation', () => {
    it('returns null when no node is selected', () => {
        const nodes = [makeNode('a'), makeNode('b')];
        expect(resolveLiveSelectedNode(null, nodes)).toBeNull();
    });

    it('returns the live node from the array when the ID matches', () => {
        const stale = makeNode('a', { data: { label: 'old-label', calmType: 'service', description: '' } });
        const live = makeNode('a', { data: { label: 'new-label', calmType: 'service', description: 'updated' } });
        const nodes = [live, makeNode('b')];

        const result = resolveLiveSelectedNode(stale, nodes);

        expect(result).toBe(live);
        expect((result!.data as Record<string, unknown>).label).toBe('new-label');
    });

    it('falls back to stale snapshot when the node was deleted from the array', () => {
        const stale = makeNode('deleted-node');
        const nodes = [makeNode('a'), makeNode('b')];

        const result = resolveLiveSelectedNode(stale, nodes);

        expect(result).toBe(stale);
        expect(result!.id).toBe('deleted-node');
    });

    it('returns the live node with updated controls after async resolution', () => {
        const stale = makeNode('svc-1', {
            data: { label: 'Payment', calmType: 'service', description: '', controls: {} },
        });
        const live = makeNode('svc-1', {
            data: {
                label: 'Payment',
                calmType: 'service',
                description: '',
                controls: { 'api-gw': { description: 'API Gateway control' } },
            },
        });
        const nodes = [live];

        const result = resolveLiveSelectedNode(stale, nodes);

        expect(result).toBe(live);
        const controls = (result!.data as Record<string, unknown>).controls as Record<string, unknown>;
        expect(controls['api-gw']).toBeDefined();
    });

    it('returns the live node with updated position after drag', () => {
        const stale = makeNode('a', { position: { x: 0, y: 0 } });
        const live = makeNode('a', { position: { x: 200, y: 300 } });
        const nodes = [live];

        const result = resolveLiveSelectedNode(stale, nodes);

        expect(result!.position).toEqual({ x: 200, y: 300 });
    });

    it('returns the live node when parentId changes (containment)', () => {
        const stale = makeNode('child');
        const live = makeNode('child', { parentId: 'container-1' } as Partial<Node>);
        const nodes = [makeNode('container-1'), live];

        const result = resolveLiveSelectedNode(stale, nodes);

        expect(result).toBe(live);
        expect(result!.parentId).toBe('container-1');
    });

    it('works with an empty nodes array (all deleted)', () => {
        const stale = makeNode('a');

        const result = resolveLiveSelectedNode(stale, []);

        expect(result).toBe(stale);
    });
});
