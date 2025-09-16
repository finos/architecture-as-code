import { describe, it, expect, afterEach } from 'vitest';
import { VMFactoryProvider } from './factory-provider';
import { VMNodeFactory, VMEdgeFactory } from './vm-factory-interfaces';
import { CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { VMLeafNode, VMAttach } from '../../types';

class FakeNodeFactory implements VMNodeFactory {
    public calls: Array<{ node: CalmNodeCanonicalModel; renderInterfaces: boolean }> = [];

    createLeafNode(node: CalmNodeCanonicalModel, renderInterfaces: boolean): { node: VMLeafNode; attachments: VMAttach[] } {
        this.calls.push({ node, renderInterfaces });
        return {
            node: { id: 'X', label: 'X' },
            attachments: []
        };
    }
}

class ProxyEdgeFactory implements VMEdgeFactory {
    constructor(private readonly inner: VMEdgeFactory) {}
    // Preserve the exact signature by referencing the interface type directly
    createEdge(...args: Parameters<VMEdgeFactory['createEdge']>): ReturnType<VMEdgeFactory['createEdge']> {
        return this.inner.createEdge(...args);
    }
}

describe('VMFactoryProvider', () => {
    afterEach(() => VMFactoryProvider.resetToDefaults());

    it('returns singletons by default', () => {
        const n1 = VMFactoryProvider.getNodeFactory();
        const n2 = VMFactoryProvider.getNodeFactory();
        const e1 = VMFactoryProvider.getEdgeFactory();
        const e2 = VMFactoryProvider.getEdgeFactory();

        expect(n1).toBe(n2);
        expect(e1).toBe(e2);
    });

    it('allows injecting only the node factory (edge remains unchanged)', () => {
        const defaultEdge = VMFactoryProvider.getEdgeFactory();

        const fakeNode = new FakeNodeFactory();
        VMFactoryProvider.setFactories(fakeNode, undefined);

        expect(VMFactoryProvider.getNodeFactory()).toBe(fakeNode);
        expect(VMFactoryProvider.getEdgeFactory()).toBe(defaultEdge);
    });

    it('allows injecting only the edge factory (node remains unchanged)', () => {
        const defaultNode = VMFactoryProvider.getNodeFactory();
        const proxyEdge = new ProxyEdgeFactory(VMFactoryProvider.getEdgeFactory());

        VMFactoryProvider.setFactories(undefined, proxyEdge);

        expect(VMFactoryProvider.getNodeFactory()).toBe(defaultNode);
        expect(VMFactoryProvider.getEdgeFactory()).toBe(proxyEdge);
    });

    it('allows injecting both factories and resetToDefaults restores originals', () => {
        const fakeNode = new FakeNodeFactory();
        const proxyEdge = new ProxyEdgeFactory(VMFactoryProvider.getEdgeFactory());

        VMFactoryProvider.setFactories(fakeNode, proxyEdge);
        expect(VMFactoryProvider.getNodeFactory()).toBe(fakeNode);
        expect(VMFactoryProvider.getEdgeFactory()).toBe(proxyEdge);

        VMFactoryProvider.resetToDefaults();
        expect(VMFactoryProvider.getNodeFactory()).not.toBe(fakeNode);
        expect(VMFactoryProvider.getEdgeFactory()).not.toBe(proxyEdge);
    });

    it('uses the injected node factory implementation when invoked', () => {
        const fakeNode = new FakeNodeFactory();
        VMFactoryProvider.setFactories(fakeNode, undefined);

        const factory = VMFactoryProvider.getNodeFactory();
        const model: CalmNodeCanonicalModel = {
            'unique-id': 'n1',
            'node-type': 'service',
            name: 'N1',
            description: ''
        };

        const result = factory.createLeafNode(model, true);

        expect(result.node.id).toBe('X');
        expect(result.node.label).toBe('X');
        expect(fakeNode.calls).toHaveLength(1);
        expect(fakeNode.calls[0].node['unique-id']).toBe('n1');
        expect(fakeNode.calls[0].renderInterfaces).toBe(true);
    });

    it('subsequent injections replace previous injections (idempotent setFactories)', () => {
        const fakeNode1 = new FakeNodeFactory();
        const fakeNode2 = new FakeNodeFactory();

        VMFactoryProvider.setFactories(fakeNode1, undefined);
        expect(VMFactoryProvider.getNodeFactory()).toBe(fakeNode1);

        VMFactoryProvider.setFactories(fakeNode2, undefined);
        expect(VMFactoryProvider.getNodeFactory()).toBe(fakeNode2);
    });
});
