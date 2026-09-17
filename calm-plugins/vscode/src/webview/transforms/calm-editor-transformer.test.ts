import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { flowToCalm, setLastParsedArch } from './calm-editor-transformer';

describe('flowToCalm - definition-id handling', () => {
    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('writes definition-id and omits controls/metadata for Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'svc-1',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'svc-1',
                    calmType: 'service',
                    label: 'Payment Service',
                    description: 'Handles payments',
                    interfaces: [{ id: 'iface-1', protocol: 'https' }],
                    'definition-id': 'finos:building-blocks:microservice@abc123',
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'finos:building-blocks:microservice@abc123'
        );
        expect(calmNode['unique-id']).toBe('svc-1');
        expect(calmNode.name).toBe('Payment Service');
        expect(calmNode.interfaces).toEqual([
            { id: 'iface-1', protocol: 'https' },
        ]);
        // Controls and metadata should NOT be present
        expect(calmNode.controls).toBeUndefined();
        expect(calmNode.metadata).toBeUndefined();
    });

    it('writes controls and metadata for local nodes (no definition-id)', () => {
        const nodes: Node[] = [
            {
                id: 'svc-2',
                type: 'service',
                position: { x: 100, y: 100 },
                data: {
                    calmId: 'svc-2',
                    calmType: 'service',
                    label: 'Local Service',
                    description: 'A locally defined service',
                    interfaces: [],
                    controls: { 'app-id': { description: 'App ID' } },
                    metadata: { 'source-building-block': 'microservice' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBeUndefined();
        expect(calmNode.controls).toEqual({
            'app-id': { description: 'App ID' },
        });
        expect(calmNode.metadata).toEqual({
            'source-building-block': 'microservice',
        });
    });

    it('handles a mix of Hub-sourced and local nodes', () => {
        const nodes: Node[] = [
            {
                id: 'hub-node',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'hub-node',
                    calmType: 'service',
                    label: 'Hub Node',
                    description: '',
                    'definition-id': 'acme:building-blocks:api-gateway@sha256',
                },
            },
            {
                id: 'local-node',
                type: 'database',
                position: { x: 200, y: 0 },
                data: {
                    calmId: 'local-node',
                    calmType: 'database',
                    label: 'Local DB',
                    description: '',
                    controls: { encryption: { description: 'AES256' } },
                    metadata: { 'source-building-block': 'rds' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(2);

        const hubCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'hub-node'
        )!;
        expect(hubCalm['definition-id']).toBe(
            'acme:building-blocks:api-gateway@sha256'
        );
        expect(hubCalm.controls).toBeUndefined();
        expect(hubCalm.metadata).toBeUndefined();

        const localCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'local-node'
        )!;
        expect(localCalm['definition-id']).toBeUndefined();
        expect(localCalm.controls).toEqual({
            encryption: { description: 'AES256' },
        });
        expect(localCalm.metadata).toEqual({
            'source-building-block': 'rds',
        });
    });

    it('preserves details on Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'n1',
                type: 'system',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'n1',
                    calmType: 'system',
                    label: 'System',
                    description: '',
                    'definition-id': 'org:building-blocks:platform@v1',
                    details: { 'detailed-architecture': 'sub-arch.calm.json' },
                },
            },
        ];

        const arch = flowToCalm(nodes, []);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'org:building-blocks:platform@v1'
        );
        expect(calmNode.details).toEqual({
            'detailed-architecture': 'sub-arch.calm.json',
        });
    });
});

describe('parseCurie (via canvas-panel)', () => {
    // Test the CURIE format that the drop handler generates
    it('generates correct CURIE format from namespace:type:slug@sha', () => {
        const namespace = 'finos';
        const id = 'microservice';
        const sha = 'abc123def';
        const curie = `${namespace}:building-blocks:${id}@${sha}`;
        expect(curie).toBe('finos:building-blocks:microservice@abc123def');
    });
});
