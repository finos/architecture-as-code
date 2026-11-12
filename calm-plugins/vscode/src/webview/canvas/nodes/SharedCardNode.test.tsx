import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./CanvasNodeIcon', () => ({
    CanvasNodeIcon: ({ size }: { size: number }) =>
        React.createElement('mock-canvas-node-icon', { 'data-size': String(size) }),
}));

import { SharedCardNode } from './SharedCardNode';

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

describe('SharedCardNode', () => {
    it('loads at the expected size and compacts inner content for short cards', () => {
        const html = renderToStaticMarkup(
            <SharedCardNode
                {...({
                    id: 'svc-1',
                    selected: true,
                    dragging: false,
                    zIndex: 0,
                    width: 200,
                    height: 80,
                    data: {
                        calmType: 'service',
                        label: 'Service',
                        description: 'Service node',
                        metadata: { 'application-id': 'APP-123' },
                    },
                    type: 'service',
                    isConnectable: true,
                    defaultBackground: '#e6f4ea',
                    defaultBorder: '#1b7340',
                    defaultIconColor: '#1b7340',
                    iconSize: 48,
                    minWidth: 40,
                    minHeight: 40,
                    applicationId: 'APP-123',
                } as any)}
            />
        );

        expect(html).toContain('data-visible="true"');
        expect(html).toContain('data-min-width="40"');
        expect(html).toContain('data-min-height="40"');
        expect(html).toContain('min-width:40px');
        expect(html).toContain('min-height:40px');
        expect(html).toContain('data-size="28"');
        expect(html).not.toContain('Service node');
        expect(html).toContain('APP-123');
    });

    it('shrinks to the configured minimum resize size', () => {
        const html = renderToStaticMarkup(
            <SharedCardNode
                {...({
                    id: 'svc-0',
                    selected: false,
                    dragging: false,
                    zIndex: 0,
                    width: 40,
                    height: 40,
                    data: {
                        calmType: 'service',
                        label: 'Service',
                        description: 'Service node',
                    },
                    type: 'service',
                    isConnectable: true,
                    defaultBackground: '#e6f4ea',
                    defaultBorder: '#1b7340',
                    defaultIconColor: '#1b7340',
                    iconSize: 48,
                    minWidth: 40,
                    minHeight: 40,
                } as any)}
            />
        );

        expect(html).toContain('data-size="22"');
        expect(html).toContain('min-width:40px');
        expect(html).toContain('min-height:40px');
        expect(html).not.toContain('>Service</span>');
    });

    it('grows beyond the loaded size without forcing compact content', () => {
        const html = renderToStaticMarkup(
            <SharedCardNode
                {...({
                    id: 'svc-2',
                    selected: false,
                    dragging: false,
                    zIndex: 0,
                    width: 320,
                    height: 160,
                    data: {
                        calmType: 'service',
                        label: 'Service',
                        description: 'Service node',
                        metadata: { 'application-id': 'APP-123' },
                    },
                    type: 'service',
                    isConnectable: true,
                    defaultBackground: '#e6f4ea',
                    defaultBorder: '#1b7340',
                    defaultIconColor: '#1b7340',
                    iconSize: 48,
                    minWidth: 40,
                    minHeight: 40,
                    applicationId: 'APP-123',
                } as any)}
            />
        );

        expect(html).toContain('data-size="48"');
        expect(html).toContain('Service node');
        expect(html).toContain('APP-123');
    });
});