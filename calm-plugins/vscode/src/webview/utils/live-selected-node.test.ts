import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import { resolveLiveSelectedNode } from './live-selected-node';

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

    it('returns null when the node was deleted', () => {
        const nodes = [makeNode('a'), makeNode('b')];

        expect(resolveLiveSelectedNode(makeNode('deleted-node'), nodes)).toBeNull();
    });

    it('returns another drawing of the same CALM node when a rebuild removed the selected one', () => {
        const stale = makeNode('ns__in__b', { data: { label: 'ns', calmId: 'ns' } });
        const kept = makeNode('ns', { data: { label: 'ns', calmId: 'ns' } });

        expect(resolveLiveSelectedNode(stale, [makeNode('a'), kept])).toBe(kept);
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

    it('returns null with an empty nodes array (all deleted)', () => {
        expect(resolveLiveSelectedNode(makeNode('a'), [])).toBeNull();
    });
});
