import { describe, expect, it } from 'vitest';
import { buildPaletteDragPayload, createPaletteNodeFromDrop, resolveFlowNodeType } from './node-drop';

describe('palette node drag/drop', () => {
    it('builds the palette drag payload used by drag-and-drop', () => {
        expect(buildPaletteDragPayload({ nodeType: 'service', nodeLabel: 'Service' })).toEqual({
            'application/calm-node-type': 'service',
            'application/calm-node-label': 'Service',
            'application/calm-container': 'false',
        });

        expect(buildPaletteDragPayload({ nodeType: 'system', nodeLabel: 'Container', isContainer: true })).toEqual({
            'application/calm-node-type': 'system',
            'application/calm-node-label': 'Container',
            'application/calm-container': 'true',
        });
    });

    it('creates a non-container node from a palette drop without explicit size', () => {
        const node = createPaletteNodeFromDrop({
            id: 'service-1',
            nodeType: 'service',
            nodeLabel: 'Service',
            position: { x: 10, y: 20 },
        });

        expect(node).toMatchObject({
            id: 'service-1',
            type: 'service',
            position: { x: 10, y: 20 },
            data: {
                label: 'Service',
                calmId: 'service-1',
                calmType: 'service',
                description: '',
                interfaces: [],
                metadata: {},
            },
        });
        expect(node.width).toBe(200);
        expect(node.height).toBe(80);
    });

    it('creates a container node with fixed initial size', () => {
        const node = createPaletteNodeFromDrop({
            id: 'container-1',
            nodeType: 'system',
            nodeLabel: 'Container',
            isContainer: true,
            position: { x: 50, y: 60 },
        });

        expect(node).toMatchObject({
            id: 'container-1',
            type: 'container',
            position: { x: 50, y: 60 },
            width: 400,
            height: 300,
            data: {
                label: 'Container',
                calmId: 'container-1',
                calmType: 'system',
                description: '',
                containerRole: 'default',
                containmentType: 'deployed-in',
            },
        });
    });

    it('maps non-core node types to extension nodes', () => {
        expect(resolveFlowNodeType('service')).toBe('service');
        expect(resolveFlowNodeType('aws:lambda')).toBe('extension');
    });
});