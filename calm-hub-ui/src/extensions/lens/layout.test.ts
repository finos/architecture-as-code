import { describe, expect, it } from 'vitest';
import type { LensReply, Notation } from '../../model/lens.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { sharedElk } from './elk.js';
import { GROUP_PADDING, layoutLens, type Layout } from './layout.js';

const notation = { own: {}, core: core as Notation };
const reply = (graph: Partial<LensReply['graph']>, fields: Partial<LensReply> = {}): LensReply => ({
    hubApi: 0, kind: 'graph', controls: [], panels: [], ...fields, graph: { groups: [], nodes: [], edges: [], ...graph },
});
const node = (layout: Layout, id: string) => {
    const placed = layout.nodes.find((entry) => entry.node.id === id)!;
    return { x: placed.x, y: placed.y, width: placed.fit.width, height: placed.fit.height };
};
const group = (layout: Layout, id: string) => layout.groups.find((entry) => entry.group.id === id)!;
const inside = (inner: { x: number; y: number; width: number; height: number }, outer: typeof inner) =>
    inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

describe('layoutLens', () => {
    it('puts each node inside its group, and each group inside its parent', async () => {
        const layout = await layoutLens(reply({
            groups: [{ id: 'outer' }, { id: 'inner', parent: 'outer' }],
            nodes: [{ id: 'a', label: 'A', group: 'inner' }, { id: 'b', label: 'B', group: 'outer' }, { id: 'c', label: 'C' }],
            edges: [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }],
        }), notation, 'light', sharedElk);
        expect(inside(node(layout, 'a'), group(layout, 'inner'))).toBe(true);
        expect(inside(group(layout, 'inner'), group(layout, 'outer'))).toBe(true);
        expect(inside(node(layout, 'c'), group(layout, 'outer'))).toBe(false);
        expect(layout.groups.map((entry) => entry.group.id)).toEqual(['outer', 'inner']);
    });

    it('places the label of an edge inside a nested group next to that edge', async () => {
        const layout = await layoutLens(reply({
            groups: [{ id: 'outer' }, { id: 'g', parent: 'outer' }],
            nodes: [{ id: 'a', label: 'A', group: 'g' }, { id: 'b', label: 'B', group: 'g' }],
            edges: [{ id: 'ab', source: 'a', target: 'b', label: 'Reads and writes', technology: 'JDBC' }],
        }), notation, 'light', sharedElk);
        const edge = layout.edges[0];
        const ys = edge.points.map((point) => point.y);
        expect(edge.label).toEqual(['Reads and writes', '[JDBC]']);
        expect(edge.labelAt!.y).toBeGreaterThan(Math.min(...ys));
        expect(edge.labelAt!.y).toBeLessThan(Math.max(...ys));
        expect(Math.abs(edge.labelAt!.x - edge.points[0].x)).toBeLessThan(120);
    });

    it('makes the drawing wide enough for each edge label', async () => {
        const layout = await layoutLens(reply({
            nodes: [{ id: 'cli', label: 'CLI' }, { id: 'user', label: 'User' }, { id: 'hub', label: 'Hub' }],
            edges: [
                { id: 'e1', source: 'cli', target: 'hub', label: 'Publishes and retrieves architectures through the REST endpoint', technology: 'HTTPS' },
                { id: 'e2', source: 'user', target: 'hub', label: 'Interacts with the web user interface through a browser' },
            ],
        }), notation, 'light', sharedElk);
        for (const edge of layout.edges) {
            const width = Math.max(...edge.label.map((line) => line.length)) * 11 * 0.55;
            expect(edge.labelAt!.x - width / 2).toBeGreaterThanOrEqual(0);
            expect(edge.labelAt!.x + width / 2).toBeLessThanOrEqual(layout.width);
        }
    });

    it('draws an edge to a group as a straight line between the outlines', async () => {
        const layout = await layoutLens(reply({
            groups: [{ id: 'g' }],
            nodes: [{ id: 'a', label: 'A', group: 'g' }, { id: 'b', label: 'B' }],
            edges: [{ id: 'bg', source: 'b', target: 'g' }],
        }), notation, 'light', sharedElk);
        const [start, end] = layout.edges[0].points;
        const b = node(layout, 'b'), g = group(layout, 'g');
        expect(layout.edges[0].points).toHaveLength(2);
        expect(start.x === b.x || start.x === b.x + b.width || start.y === b.y || start.y === b.y + b.height).toBe(true);
        expect(end.x === g.x || end.x === g.x + g.width || end.y === g.y || end.y === g.y + g.height).toBe(true);
    });

    it('keeps the positions of the fixed layout, and fits a group around its members', async () => {
        const layout = await layoutLens(reply({
            groups: [{ id: 'lane' }],
            nodes: [{ id: 'a', label: 'A', group: 'lane', position: { x: 100, y: 50 } }, { id: 'b', label: 'B', group: 'lane', position: { x: 400, y: 50 } }],
            edges: [{ id: 'ab', source: 'a', target: 'b' }],
        }, { layout: { algorithm: 'fixed' } }), notation, 'light', sharedElk);
        const a = node(layout, 'a'), b = node(layout, 'b'), lane = group(layout, 'lane');
        expect(b.x - a.x).toBe(300);
        expect([lane.x, lane.y]).toEqual([a.x - GROUP_PADDING.left, a.y - GROUP_PADDING.top]);
        expect(lane.x + lane.width).toBe(b.x + b.width + GROUP_PADDING.right);
        expect(layout.edges[0].points).toEqual([{ x: a.x + a.width, y: a.y + a.height / 2 }, { x: b.x, y: b.y + b.height / 2 }]);
    });
});
