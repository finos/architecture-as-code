import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActorNode } from './ActorNode';
import { DatabaseNode } from './DatabaseNode';
import { ServiceNode } from './ServiceNode';
import { WebclientNode } from './WebclientNode';

vi.mock('reactflow', () => ({
    Handle: ({ type, position, id }: { type: string; position: string; id?: string }) =>
        React.createElement('mock-handle', {
            'data-type': type,
            'data-position': position,
            'data-id': id ?? '',
        }),
    NodeResizer: ({ isVisible, minWidth, minHeight }: { isVisible: boolean; minWidth: number; minHeight: number }) =>
        React.createElement('mock-node-resizer', {
            'data-visible': String(isVisible),
            'data-min-width': String(minWidth),
            'data-min-height': String(minHeight),
        }),
    Position: {
        Top: 'top',
        Bottom: 'bottom',
        Left: 'left',
        Right: 'right',
    },
}));

describe('current node renderers', () => {
    const renderNode = (component: React.ReactElement) => renderToStaticMarkup(component);

    it.each([
        ['ActorNode', ActorNode, 40, 40],
        ['DatabaseNode', DatabaseNode, 40, 40],
        ['ServiceNode', ServiceNode, 40, 40],
        ['WebclientNode', WebclientNode, 40, 40],
    ] as const)('preserves resize bounds in %s', (_label, Component, minWidth, minHeight) => {
        const html = renderNode(
            <Component
                {...({
                    id: 'node-1',
                    selected: false,
                    dragging: false,
                    zIndex: 0,
                    data: { calmType: 'service', label: 'Node', description: 'Node' },
                    type: 'service',
                    isConnectable: true,
                } as any)}
            />
        );

        expect(html).toContain('data-visible="false"');
        expect(html).toContain(`data-min-width="${minWidth}"`);
        expect(html).toContain(`data-min-height="${minHeight}"`);
    });
});