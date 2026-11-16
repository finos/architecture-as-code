import { describe, expect, it } from 'vitest';
import type { DiagramLensContribution } from '../../model/lens.js';
import { isParamsLinkAllowed, lensParams, parseLensReply } from './reply.js';

const lens: DiagramLensContribution = {
    id: 'c4', title: 'C4', route: 'lens', notation: 'notation.json',
    params: { level: { values: ['context', 'container'], default: 'context' }, scope: { pattern: '^[a-z-]{1,20}$' } },
};
const reply = (graph: object, fields: object = {}) => ({ hubApi: 0, kind: 'graph', graph, ...fields });
const problem = (value: unknown) => parseLensReply(value, 0, lens).problem;

describe('parseLensReply', () => {
    it('accepts a graph, and an edge id that is also a node id', () => {
        const parsed = parseLensReply(reply({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ id: 'a', source: 'a', target: 'b' }] }), 0, lens);
        expect(parsed.reply?.graph).toMatchObject({ groups: [], edges: [{ id: 'a' }] });
        expect(parsed.reply?.controls).toEqual([]);
    });

    it('refuses a graph over the node limit', () => {
        const nodes = Array.from({ length: 501 }, (_, index) => ({ id: `n${index}`, label: 'N' }));
        expect(problem(reply({ nodes }))).toContain('at most 500');
    });

    it('refuses a node, an edge or a panel over a bound of the lens schema', () => {
        const node = (fields: object) => reply({ nodes: [{ id: 'a', label: 'A', ...fields }] });
        expect(problem(node({ badges: Array.from({ length: 50_000 }, () => ({ text: 'x' })) }))).toContain('wrong type');
        expect(problem(node({ badges: [{ text: 'x'.repeat(41) }] }))).toContain('wrong type');
        expect(problem(node({ sections: { rows: Array.from({ length: 51 }, () => 'r') } }))).toContain('wrong type');
        expect(problem(node({ description: 'd'.repeat(501) }))).toContain('wrong type');
        expect(problem(node({ tags: Array.from({ length: 17 }, (_, i) => `t${i}`) }))).toContain('wrong type');
        expect(problem(node({ badges: Array.from({ length: 4 }, () => ({ text: 'x' })), description: 'd'.repeat(500) }))).toBeUndefined();
        expect(problem(reply({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
            edges: [{ id: 'e', source: 'a', target: 'b', label: 'l'.repeat(501) }] }))).toContain('wrong type');
        expect(problem(reply({ nodes: [] }, { panels: Array.from({ length: 5 }, () => ({ title: 'P', blocks: [] })) }))).toContain('panel');
    });

    it('refuses an edge to an unknown node or to another edge', () => {
        const nodes = [{ id: 'a', label: 'A' }];
        expect(problem(reply({ nodes, edges: [{ id: 'e', source: 'a', target: 'x' }] }))).toBe("Edge 'e' has an unknown target 'x'.");
        expect(problem(reply({ nodes, edges: [{ id: 'e', source: 'a', target: 'a' }, { id: 'f', source: 'e', target: 'a' }] }))).toContain("unknown source 'e'");
    });

    it('refuses a group that is inside itself', () => {
        const groups = [{ id: 'g', parent: 'h' }, { id: 'h', parent: 'g' }];
        expect(problem(reply({ nodes: [], groups }))).toContain('inside itself');
    });

    it('refuses a control for a parameter that the lens does not declare', () => {
        const controls = [{ type: 'select', param: 'colour', items: [{ value: 'red', label: 'Red' }] }];
        expect(problem(reply({ nodes: [] }, { controls }))).toContain('does not declare');
    });

    it('refuses a control whose value is not one of its items, or is empty', () => {
        const controls = [{ type: 'segmented', param: 'level', value: 'component', items: [{ value: 'context', label: 'Context' }] }];
        expect(problem(reply({ nodes: [] }, { controls }))).toContain('A control is not valid');
        const empty = [{ type: 'select', param: 'level', value: '', items: [{ value: '', label: 'Empty' }] }];
        expect(problem(reply({ nodes: [] }, { controls: empty }))).toContain('A control is not valid');
    });

    it('refuses a link that is not https, and a reply of another contract', () => {
        expect(problem(reply({ nodes: [{ id: 'a', label: 'A', link: { href: 'javascript:alert(1)' } }] }))).toContain("Node 'a'");
        expect(problem({ ...reply({ nodes: [] }), hubApi: 1 })).toContain('hubApi 0');
    });
});

describe('lensParams', () => {
    it('sends each declared parameter with an allowed value, else its default, and nothing else', () => {
        expect(lensParams(lens, { level: 'container', scope: 'shop', tab: 'json' })).toEqual({ level: 'container', scope: 'shop' });
        expect(lensParams(lens, { level: 'component', scope: '../x' })).toEqual({ level: 'context' });
    });

    it('lets a link set only declared parameters with allowed values', () => {
        expect(isParamsLinkAllowed(lens, { level: 'container', scope: 'api' })).toBe(true);
        expect(isParamsLinkAllowed(lens, { level: 'deployment' })).toBe(false);
        expect(isParamsLinkAllowed(lens, { tab: 'json' })).toBe(false);
    });
});
