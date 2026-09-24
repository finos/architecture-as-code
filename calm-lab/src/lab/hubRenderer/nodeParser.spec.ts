import { describe, it, expect } from 'vitest';
import { identifyContainerNodes, parseNodes } from './nodeParser';
import { parseCALMData } from './calmTransformer';

const node = (id: string, extra: Record<string, unknown> = {}) => ({ 'unique-id': id, 'node-type': 'service', name: id, ...extra });

const composedOf = (container: string, nodes: string[]) => ({
    'unique-id': `${container}-contains`,
    'relationship-type': { 'composed-of': { container, nodes } },
});

describe('identifyContainerNodes', () => {
    it('parents a child on a container that is in the node list', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('system', ['child'])],
            [node('system'), node('child')],
        );
        expect(parentMap.get('child')).toBe('system');
    });

    it('drops a parent whose container is not in the node list', () => {
        // ReactFlow throws on a parentId with no matching node.
        const { parentMap } = identifyContainerNodes(
            [composedOf('not-yet-typed', ['child'])],
            [node('child')],
        );
        expect(parentMap.has('child')).toBe(false);
    });

    it('refuses to make a node its own parent', () => {
        const { parentMap } = identifyContainerNodes([composedOf('x', ['x'])], [node('x')]);
        expect(parentMap.has('x')).toBe(false);
    });

    it('keeps only one edge of an A-in-B, B-in-A cycle', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('a', ['b']), composedOf('b', ['a'])],
            [node('a'), node('b')],
        );
        expect(parentMap.get('b')).toBe('a');
        expect(parentMap.has('a')).toBe(false);
    });

    it('breaks a longer containment cycle (A→B→C→A)', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('a', ['b']), composedOf('b', ['c']), composedOf('c', ['a'])],
            [node('a'), node('b'), node('c')],
        );
        expect(parentMap.has('a')).toBe(false);
        expect([...parentMap.entries()]).toEqual([['b', 'a'], ['c', 'b']]);
    });
});

describe('parseNodes', () => {
    it('coerces a non-string name into a renderable label', () => {
        const containerInfo = identifyContainerNodes([], []);
        const { regularNodes } = parseNodes([node('n', { name: { first: 'x' } })], containerInfo);
        expect(typeof regularNodes[0].data.label).toBe('string');
    });

    it('does not let a literal `label` property override the coerced one', () => {
        const containerInfo = identifyContainerNodes([], []);
        const { regularNodes } = parseNodes([node('n', { label: {} })], containerInfo);
        expect(regularNodes[0].data.label).toBe('n');
    });

    it('coerces the label on container nodes too', () => {
        const nodes = [node('system', { name: 42 }), node('child')];
        const containerInfo = identifyContainerNodes([composedOf('system', ['child'])], nodes);
        const { systemNodes } = parseNodes(nodes, containerInfo);
        expect(systemNodes[0].data.label).toBe('42');
    });
});

describe('parseCALMData with invalid input', () => {
    it('produces string labels and no dangling parents for a half-typed document', () => {
        const parsed = parseCALMData({
            nodes: [node('a', { name: { oops: true }, 'node-type': 7 }), node('b')],
            relationships: [
                composedOf('missing-container', ['a']),
                {
                    'unique-id': 'a-b',
                    description: { still: 'typing' },
                    protocol: 5,
                    'relationship-type': {
                        connects: { source: { node: 'a' }, destination: { node: 'b' } },
                    },
                },
            ],
        });
        const ids = new Set(parsed.nodes.map((n) => n.id));
        for (const flowNode of parsed.nodes) {
            expect(typeof flowNode.data.label).toBe('string');
            if (flowNode.parentId) {
                expect(ids.has(flowNode.parentId)).toBe(true);
            }
        }
        expect(typeof parsed.edges[0].data.description).toBe('string');
        expect(parsed.edges[0].data.protocol).toBe('5');
    });
});
