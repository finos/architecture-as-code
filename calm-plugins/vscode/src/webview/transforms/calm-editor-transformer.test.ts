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
                    'definition-id': 'finos:standard-nodes:microservice@abc123',
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'finos:standard-nodes:microservice@abc123'
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
                    metadata: { team: 'payments' },
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
            team: 'payments',
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
                    'definition-id': 'acme:standard-nodes:api-gateway@sha256',
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
                    metadata: { engine: 'postgres' },
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
            'acme:standard-nodes:api-gateway@sha256'
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
            engine: 'postgres',
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
                    'definition-id': 'org:standard-nodes:platform@v1',
                    details: { 'detailed-architecture': 'sub-arch.calm.json' },
                },
            },
        ];

        const arch = flowToCalm(nodes, []);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'org:standard-nodes:platform@v1'
        );
        expect(calmNode.details).toEqual({
            'detailed-architecture': 'sub-arch.calm.json',
        });
    });

    it('stripResolvedNoise preserves description and config-url on controls', () => {
        const nodes: Node[] = [{
            id: 'svc-hub',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-hub',
                calmType: 'service',
                label: 'Hub Service',
                description: 'From Hub',
                'definition-id': 'finos:standard-nodes:svc@abc',
                controls: {
                    'platform--encryption': {
                        description: 'Data at rest encryption',
                        requirements: [{
                            'requirement-url': 'platform:controls:encryption@1.0.0',
                            'config-url': 'https://hub/config.json',
                        }],
                        metadata: { validation: { identity: { controlId: 'encryption' }, properties: {} } },
                    },
                },
            },
        }];

        const arch = flowToCalm(nodes, []);
        const ctrl = arch.nodes[0].controls as Record<string, any>;
        expect(ctrl['platform--encryption'].description).toBe('Data at rest encryption');
        expect(ctrl['platform--encryption'].requirements[0]['config-url']).toBe('https://hub/config.json');
        expect(ctrl['platform--encryption'].requirements[0]['requirement-url']).toBe('platform:controls:encryption@1.0.0');
        expect(ctrl['platform--encryption'].metadata).toBeUndefined();
    });

    it('preserves metadata on definition-id nodes', () => {
        const nodes: Node[] = [{
            id: 'svc-meta',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-meta',
                calmType: 'service',
                label: 'Styled Hub Node',
                description: '',
                'definition-id': 'finos:standard-nodes:svc@abc',
                metadata: { 'standard-node-style': { background: '#1c4587' } },
            },
        }];

        const arch = flowToCalm(nodes, []);
        expect(arch.nodes[0].metadata).toEqual({ 'standard-node-style': { background: '#1c4587' } });
    });
});

