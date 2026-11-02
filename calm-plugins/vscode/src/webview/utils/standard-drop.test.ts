import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { applyStandardToNode } from './standard-drop';
import { flowToCalm, setLastParsedArch } from '../transforms/calm-editor-transformer';

describe('applyStandardToNode', () => {
    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('adds the Standard controls to the target node without adding a node or relationship', () => {
        const initialNodes: Node[] = [
            {
                id: 'svc-1',
                type: 'service',
                position: { x: 100, y: 100 },
                data: {
                    calmId: 'svc-1',
                    calmType: 'service',
                    label: 'Order Service',
                    description: 'Handles orders',
                    interfaces: [],
                },
            },
        ];
        const edges: Edge[] = [];
        const standardControls = {
            'tls-in-transit': {
                description: 'All traffic must use TLS 1.3',
                requirements: [
                    {
                        'requirement-url': 'controls/tls.requirement.json',
                        config: { minVersion: '1.3' },
                    },
                ],
            },
        };

        const updatedNodes = applyStandardToNode(initialNodes, 'svc-1', standardControls);

        expect(updatedNodes).toHaveLength(1);
        expect(updatedNodes.some((n) => (n.data as any)?.calmType === 'standard')).toBe(false);

        const arch = flowToCalm(updatedNodes, edges);
        expect(arch.nodes).toHaveLength(1);
        expect(arch.nodes[0]['unique-id']).toBe('svc-1');
        expect(arch.nodes[0]['node-type']).toBe('service');
        expect(arch.nodes[0].controls).toEqual(standardControls);
        expect((arch.nodes[0].metadata as Record<string, unknown> | undefined)?.['source-standard-node']).toBeUndefined();
        expect(arch.relationships).toEqual([]);
    });

    it('merges Standard controls with existing controls on the target node', () => {
        const initialNodes: Node[] = [
            {
                id: 'svc-1',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'svc-1',
                    calmType: 'service',
                    label: 'Order Service',
                    description: '',
                    controls: {
                        'existing-control': {
                            description: 'Existing control',
                            requirements: [{ 'requirement-url': 'controls/existing.json', config: {} }],
                        },
                    },
                },
            },
        ];

        const updatedNodes = applyStandardToNode(initialNodes, 'svc-1', {
            'new-control': {
                description: 'New control',
                requirements: [{ 'requirement-url': 'controls/new.json', config: {} }],
            },
        });

        expect(updatedNodes).toHaveLength(1);
        expect((updatedNodes[0].data as Record<string, unknown>).controls).toEqual({
            'existing-control': {
                description: 'Existing control',
                requirements: [{ 'requirement-url': 'controls/existing.json', config: {} }],
            },
            'new-control': {
                description: 'New control',
                requirements: [{ 'requirement-url': 'controls/new.json', config: {} }],
            },
        });
    });
});
