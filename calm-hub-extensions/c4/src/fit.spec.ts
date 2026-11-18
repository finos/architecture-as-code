import { describe, expect, it } from 'vitest';
import { fitLensReply } from './fit.js';

const reply = (nodes: { id: string; label: string }[], edges: { id: string; source: string; target: string }[] = [], controls: { value?: string; items: { value: string; label: string }[] }[] = []) =>
    fitLensReply({ title: 't', graph: { groups: [], nodes, edges }, controls });

describe('fitLensReply', () => {
    it('gives a long id a short id that no other id of the reply uses', () => {
        const long = 'x'.repeat(129);
        const taken = `${'x'.repeat(99)}…#4ee8de874a27aad7`;
        const fitted = reply([{ id: long, label: 'L' }, { id: taken, label: 'T' }], [{ id: 'e', source: long, target: taken }]);
        const [a, b] = fitted.graph.nodes.map((node) => node.id);
        expect(b).toBe(taken);
        expect(a).not.toBe(b);
        expect(a.length).toBeLessThanOrEqual(128);
        expect(fitted.graph.edges[0]).toMatchObject({ source: a, target: b });
    });

    it('labels an element with no name by its id, and a control item by its value', () => {
        const fitted = reply([{ id: 'api', label: '' }], [], [{ value: 'a', items: [{ value: 'a', label: '' }] }]);
        expect(fitted.graph.nodes[0].label).toBe('api');
        expect(fitted.controls[0].items[0].label).toBe('a');
    });

    it('keeps at most 200 control items, with the open item among them', () => {
        const items = Array.from({ length: 201 }, (_, i) => ({ value: `s${i}`, label: `S${i}` }));
        const fitted = reply([], [], [{ value: 's200', items }]);
        expect(fitted.controls[0].items).toHaveLength(200);
        expect(fitted.controls[0].items.some((item) => item.value === 's200')).toBe(true);
    });
});
