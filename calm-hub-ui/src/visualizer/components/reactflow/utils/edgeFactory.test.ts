import { describe, it, expect } from 'vitest';
import { MarkerType } from 'reactflow';
import { createEdge, EdgeConfig } from './edgeFactory';

describe('createEdge', () => {
    const baseConfig: EdgeConfig = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        label: 'connects to',
        color: '#007dff',
        data: { protocol: 'HTTPS' },
    };

    it('creates edge with required properties', () => {
        const edge = createEdge(baseConfig);
        expect(edge.id).toBe('edge-1');
        expect(edge.source).toBe('node-1');
        expect(edge.target).toBe('node-2');
        expect(edge.type).toBe('custom');
    });

    it('sets source and target handles', () => {
        const edge = createEdge(baseConfig);
        expect(edge.sourceHandle).toBe('source');
        expect(edge.targetHandle).toBe('target');
    });

    it('includes label in data', () => {
        const edge = createEdge(baseConfig);
        expect(edge.data.label).toBe('connects to');
        expect(edge.data.description).toBe('connects to');
    });

    it('merges custom data', () => {
        const edge = createEdge(baseConfig);
        expect(edge.data.protocol).toBe('HTTPS');
    });

    it('defaults animated to true', () => {
        const edge = createEdge(baseConfig);
        expect(edge.animated).toBe(true);
    });

    it('respects animated=false', () => {
        const edge = createEdge({ ...baseConfig, animated: false });
        expect(edge.animated).toBe(false);
    });

    it('applies stroke color', () => {
        const edge = createEdge(baseConfig);
        expect(edge.style?.stroke).toBe('#007dff');
    });

    it('uses strokeWidth 2.5 for non-dashed edges', () => {
        const edge = createEdge(baseConfig);
        expect(edge.style?.strokeWidth).toBe(2.5);
    });

    it('uses strokeWidth 2 for dashed edges', () => {
        const edge = createEdge({ ...baseConfig, dashed: true });
        expect(edge.style?.strokeWidth).toBe(2);
    });

    it('adds strokeDasharray for dashed edges', () => {
        const edge = createEdge({ ...baseConfig, dashed: true });
        expect(edge.style?.strokeDasharray).toBe('5,5');
    });

    it('does not add strokeDasharray for non-dashed edges', () => {
        const edge = createEdge(baseConfig);
        expect(edge.style?.strokeDasharray).toBeUndefined();
    });

    it('adds markerEnd by default', () => {
        const edge = createEdge(baseConfig);
        expect(edge.markerEnd).toBeDefined();
        expect(edge.markerEnd).toEqual({
            type: MarkerType.ArrowClosed,
            color: '#007dff',
            width: 25,
            height: 25,
        });
        expect(edge.markerStart).toBeUndefined();
    });

    it('adds markerStart when markerPosition is start', () => {
        const edge = createEdge({ ...baseConfig, markerPosition: 'start' });
        expect(edge.markerStart).toBeDefined();
        expect(edge.markerStart).toMatchObject({
            type: MarkerType.ArrowClosed,
            color: '#007dff',
            width: 25,
            height: 25,
        });
        expect(edge.markerEnd).toBeUndefined();
    });

    it('includes id, source, target in data for reference', () => {
        const edge = createEdge(baseConfig);
        expect(edge.data.id).toBe('edge-1');
        expect(edge.data.source).toBe('node-1');
        expect(edge.data.target).toBe('node-2');
    });
});
