// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EdgeProps } from 'reactflow';
import { describe, expect, it, vi } from 'vitest';
import { TooltipEdge } from './TooltipEdge';

vi.mock('reactflow', () => ({
    BaseEdge: ({ id, style, markerEnd, markerStart }: { id: string; style: React.CSSProperties; markerEnd?: string; markerStart?: string }) => <path id={id} style={style} markerEnd={markerEnd} markerStart={markerStart} />,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    getBezierPath: () => ['M0,0 L100,100', 50, 50],
    getSmoothStepPath: () => ['M0,0 L100,100', 50, 50],
    getStraightPath: () => ['M0,0 L100,100', 50, 50],
}));

const props: EdgeProps = {
    id: 'request', source: 'ui', target: 'api', sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
    sourcePosition: 'bottom' as EdgeProps['sourcePosition'], targetPosition: 'top' as EdgeProps['targetPosition'],
    markerEnd: 'url(#arrow)', selected: false,
};

describe('flow edges with current arrow markers', () => {
    it('uses the flow color for the edge and arrowhead', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ _flowColor: '#123456', _flowActive: true }} /></svg>);
        expect(html).toContain('calm-arrow-end-request');
        expect(html).toContain('fill:#123456');
        expect(html).toContain('stroke:#123456');
        expect(html).toContain('stroke-width:3.5');
    });

    it('dims unrelated edges without losing their markers', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ _flowDimmed: true }} /></svg>);
        expect(html).toContain('opacity:0.12');
        expect(html).toContain('calm-arrow-end-request');
    });

    it.each(['bezier', 'smoothstep', 'straight'])('animates along the actual %s path', routing => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ routing, _flowActive: true, _flowDirections: ['forward'] }} /></svg>);
        expect(html).toContain('<animateMotion path="M0,0 L100,100" keyPoints="0;1"');
        expect(html).not.toContain('attributeName="cx"');
    });

    it('uses the start arrowhead and reversed path motion for return transitions', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ _flowActive: true, _flowDirections: ['reverse'] }} /></svg>);
        expect(html).toContain('marker-start="url(#calm-arrow-start-request)"');
        expect(html).not.toContain('calm-arrow-end-request');
        expect(html).toContain('keyPoints="1;0"');
    });

    it('renders simultaneous forward and reverse indicators', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ _flowActive: true, _flowDirections: ['forward', 'reverse'] }} /></svg>);
        expect(html.match(/<animateMotion /g)).toHaveLength(2);
        expect(html).toContain('marker-start="url(#calm-arrow-start-request)"');
        expect(html).toContain('marker-end="url(#calm-arrow-end-request)"');
    });

    it('animates along a self-loop rather than a zero-length straight line', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} target="ui" data={{ _flowActive: true }} /></svg>);
        expect(html).toContain('<animateMotion path="M 0,0 C ');
    });

    it('preserves active playback emphasis on a selected edge', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} selected data={{ _flowActive: true, _flowColor: '#123456' }} /></svg>);
        expect(html).toContain('stroke:#123456');
        expect(html).toContain('stroke-width:4.5');
        expect(html).toContain('drop-shadow');
    });

    it('preserves playback color and glow while hovering, then restores idle markers on stop', async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        try {
            await act(async () => root.render(<svg><TooltipEdge {...props} data={{
                _flowActive: true, _flowColor: '#123456', _flowDirections: ['reverse'],
            }} /></svg>));
            const overlay = container.querySelector('path[stroke="transparent"]')!;
            await act(async () => overlay.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
            const path = container.querySelector<SVGElement>('#request')!;
            expect(['#123456', 'rgb(18, 52, 86)']).toContain(path.style.stroke);
            expect(path.style.strokeWidth).toBe('4.5');
            expect(path.style.filter).toContain('drop-shadow');
            expect(path.getAttribute('marker-start')).toBe('url(#calm-arrow-start-request)');
            await act(async () => root.render(<svg><TooltipEdge {...props} data={{ _flowActive: false }} /></svg>));
            expect(path.getAttribute('marker-start')).toBeNull();
            expect(path.getAttribute('marker-end')).toBe('url(#calm-arrow-end-request)');
            expect(container.querySelector('animateMotion')).toBeNull();
        } finally {
            await act(async () => root.unmount());
            container.remove();
            vi.unstubAllGlobals();
        }
    });

    it('does not render a motion indicator on visited or idle edges', () => {
        const html = renderToStaticMarkup(<svg><TooltipEdge {...props} data={{ _flowVisited: true }} /></svg>);
        expect(html).not.toContain('<animateMotion');
        expect(html).toContain('opacity:0.5');
    });
});
