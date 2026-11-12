import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const measuredSize = vi.hoisted(() => ({ width: 200, height: 80 }));

vi.mock('reactflow', () => ({
    useStore: (selector: (state: unknown) => unknown) => selector({
        nodeInternals: new Map([['service-1', { width: measuredSize.width, height: measuredSize.height }]]),
    }),
    Handle: ({ type }: { type: string }) => React.createElement('mock-handle', { 'data-type': type }),
    NodeResizer: ({ minWidth, minHeight }: { minWidth: number; minHeight: number }) => React.createElement('mock-resizer', {
        'data-min-width': String(minWidth),
        'data-min-height': String(minHeight),
    }),
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));
vi.mock('../../canvas/nodes/CanvasNodeIcon', () => ({
    CanvasNodeIcon: ({ size }: { size: number }) => React.createElement('mock-icon', { 'data-size': String(size) }),
}));

import { ResponsiveNode } from './ResponsiveNode';

const nodeProps = {
    id: 'service-1',
    selected: true,
    dragging: false,
    zIndex: 0,
    type: 'service',
    isConnectable: true,
    data: {
        calmType: 'service',
        label: 'Payment API',
        description: 'Handles payments',
        controls: {
            application_id: {
                requirements: [{ 'requirement-url': 'controls:application_id', config: { value: 'APP-42' } }],
            },
        },
    },
};

describe('ResponsiveNode', () => {
    it('uses the measured node size, enforces 40x40, and shows the configured app ID', () => {
        measuredSize.width = 200;
        measuredSize.height = 80;
        const html = renderToStaticMarkup(<ResponsiveNode {...(nodeProps as any)} />);

        expect(html).toContain('data-min-width="40"');
        expect(html).toContain('data-min-height="40"');
        expect(html).toContain('APP-42');
        expect(html).toContain('Payment API');
    });

    it('renders only the icon when resized to 40x40', () => {
        measuredSize.width = 40;
        measuredSize.height = 40;
        const html = renderToStaticMarkup(<ResponsiveNode {...(nodeProps as any)} />);

        expect(html).toContain('data-size="22"');
        expect(html).not.toContain('APP-42');
        expect(html).not.toContain('Payment API');
    });
});
