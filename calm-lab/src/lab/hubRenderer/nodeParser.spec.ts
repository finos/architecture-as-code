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
        expect(parentMap.get('child')).toEqual(['system']);
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
        expect(parentMap.get('b')).toEqual(['a']);
        expect(parentMap.has('a')).toBe(false);
    });

    it('keeps every container of a node', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('a', ['x']), composedOf('b', ['x']), composedOf('a', ['x'])],
            [node('a'), node('b'), node('x')],
        );
        expect(parentMap.get('x')).toEqual(['a', 'b']);
    });

    it('breaks a cycle through any parent of a node', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('env', ['cluster-a', 'cluster-b']), composedOf('cluster-b', ['ns']), composedOf('ns', ['env'])],
            [node('env'), node('cluster-a'), node('cluster-b'), node('ns')],
        );
        expect(parentMap.has('env')).toBe(false);
    });

    it('breaks a longer containment cycle (A→B→C→A)', () => {
        const { parentMap } = identifyContainerNodes(
            [composedOf('a', ['b']), composedOf('b', ['c']), composedOf('c', ['a'])],
            [node('a'), node('b'), node('c')],
        );
        expect(parentMap.has('a')).toBe(false);
        expect([...parentMap.entries()]).toEqual([['b', ['a']], ['c', ['b']]]);
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

describe('parseCALMData with nodes in several containers', () => {
    const connects = (id: string, source: string, destination: string) => ({
        'unique-id': id,
        'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
    });
    const sharedNamespace = () => parseCALMData({
        nodes: ['cluster-a', 'cluster-b', 'ns', 'svc', 'db'].map((id) => node(id)),
        relationships: [
            composedOf('cluster-a', ['ns']),
            { ...composedOf('cluster-b', ['ns']), 'unique-id': 'cluster-b-ns' },
            composedOf('ns', ['svc', 'db']),
            connects('c1', 'svc', 'db'),
        ],
    });
    const drawings = (calmId: string) =>
        sharedNamespace().nodes.filter((n) => n.data['unique-id'] === calmId).map((n) => [n.id, n.parentId]);

    it('draws the node and everything in it once in each container', () => {
        expect(drawings('ns')).toEqual([['ns', 'cluster-a'], ['ns__in__cluster-b', 'cluster-b']]);
        expect(drawings('svc')).toEqual([['svc', 'ns'], ['svc__in__ns__in__cluster-b', 'ns__in__cluster-b']]);
    });

    it('connects the copies in the same container', () => {
        const { edges } = sharedNamespace();
        expect(edges.map((e) => [e.source, e.target])).toEqual([
            ['svc', 'db'],
            ['svc__in__ns__in__cluster-b', 'db__in__ns__in__cluster-b'],
        ]);
        expect(new Set(edges.map((e) => e.id)).size).toBe(2);
    });

    it('gives every parent a node that exists', () => {
        const { nodes } = sharedNamespace();
        const ids = new Set(nodes.map((n) => n.id));
        expect(ids.size).toBe(nodes.length);
        for (const n of nodes) {
            if (n.parentId) expect(ids.has(n.parentId)).toBe(true);
        }
    });
});

describe('parseCALMData with deeply shared containers', () => {
    it('draws each node once when copies would exceed the limit', () => {
        const levels = 12;
        const ids = Array.from({ length: levels }, (_, k) => [`l${k}a`, `l${k}b`]);
        const relationships = ids.slice(1).flatMap(([a, b], k) => [
            { ...composedOf(ids[k][0], [a, b]), 'unique-id': `r${k}a` },
            { ...composedOf(ids[k][1], [a, b]), 'unique-id': `r${k}b` },
        ]);
        const parsed = parseCALMData({ nodes: ids.flat().map((id) => node(id)), relationships });
        expect(parsed.nodes).toHaveLength(levels * 2);
    });
});

