import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GenericNode } from './GenericNode';

vi.mock('reactflow', () => ({
    useStore: (selector: (state: unknown) => unknown) => selector({
        nodeInternals: new Map([['actor-1', { width: 40, height: 40 }]]),
    }),
    Handle: ({ type, position, id }: { type: string; position: string; id?: string }) => (
        React.createElement('mock-handle', { 'data-type': type, 'data-position': position, 'data-id': id ?? '' })
    ),
    NodeResizer: ({ isVisible, minWidth, minHeight }: { isVisible: boolean; minWidth: number; minHeight: number }) => (
        React.createElement('mock-node-resizer', {
            'data-visible': String(isVisible),
            'data-min-width': String(minWidth),
            'data-min-height': String(minHeight),
        })
    ),
    Position: {
        Top: 'top',
        Bottom: 'bottom',
        Left: 'left',
        Right: 'right',
    },
}));

describe('GenericNode', () => {
    it('preserves the current generic node resize bounds', () => {
        const html = renderToStaticMarkup(
            <GenericNode
                {...({
                    id: 'actor-1',
                    selected: false,
                    dragging: false,
                    zIndex: 0,
                    data: { calmType: 'actor', label: 'Actor', description: 'User-facing actor' },
                    type: 'actor',
                    isConnectable: true,
                } as any)}
            />
        );

        expect(html).toContain('data-visible="false"');
        expect(html).toContain('data-min-width="40"');
        expect(html).toContain('data-min-height="40"');
        expect(html).not.toContain('>Actor</span>');
    });
});