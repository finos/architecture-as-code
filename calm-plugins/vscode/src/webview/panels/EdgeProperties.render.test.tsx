import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Edge } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { EdgeProperties, hasSeparateReverseEdge } from './EdgeProperties';

const edge = (id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge =>
    ({ id, source, target, data: { calmVariant: 'connects', calmRelId: id, ...data } });

describe('hasSeparateReverseEdge', () => {
    it('finds a connects edge drawn in the reverse direction', () => {
        const r1 = edge('r1', 'a', 'b');
        expect(hasSeparateReverseEdge(r1, [r1, edge('r2', 'b', 'a')])).toBe(true);
    });

    it('ignores edges in the same direction and edges of another variant', () => {
        const r1 = edge('r1', 'a', 'b');
        expect(hasSeparateReverseEdge(r1, [r1, edge('r2', 'a', 'b'), edge('r3', 'b', 'a', { calmVariant: 'interacts' })])).toBe(false);
    });
});

describe('EdgeProperties', () => {
    const render = (e: Edge, hasReverseEdge: boolean) =>
        renderToStaticMarkup(<EdgeProperties edge={e} hasReverseEdge={hasReverseEdge} />);

    it('offers Bidirectional for an edge without a separate reverse edge', () => {
        expect(render(edge('r1', 'a', 'b'), false)).toContain('value="bidirectional"');
    });

    it('does not offer Bidirectional for an edge with a separate reverse edge', () => {
        expect(render(edge('r1', 'a', 'b'), true)).not.toContain('value="bidirectional"');
    });

    it('offers Bidirectional for a merged pair set to one direction when another edge goes in reverse', () => {
        const merged = edge('r1', 'a', 'b', { calmReverseRelId: 'r2', direction: 'source-to-target' });
        expect(render(merged, true)).toContain('value="bidirectional"');
    });
});
