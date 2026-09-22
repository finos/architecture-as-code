import { describe, expect, it } from 'vitest';
import { ancestorPathsOf, buildNamespaceTree, filterNamespaceTree, flattenNamespaceTree, splitOnMatch, type NamespaceTreeNode, INDENT_STEP, indentFor, isNamespace } from './namespace-tree.js';
import type { NamespaceCounts } from '../../../model/counts.js';

function nc(namespace: string, total: number): NamespaceCounts {
    return { namespace, architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total };
}

describe('buildNamespaceTree', () => {
    it('gives every dot segment its own row — no path compression', () => {
        const tree = buildNamespaceTree([nc('platform.payments.ledger', 3)]);
        expect(tree).toHaveLength(1);

        const platform = tree[0];
        expect(platform.segment).toBe('platform');
        expect(platform.path).toBe('platform');
        expect(platform.total).toBeNull();
        expect(platform.children).toHaveLength(1);

        const payments = platform.children[0];
        expect(payments.segment).toBe('payments');
        expect(payments.path).toBe('platform.payments');
        expect(payments.total).toBeNull();
        expect(payments.children).toHaveLength(1);

        const ledger = payments.children[0];
        expect(ledger.segment).toBe('ledger');
        expect(ledger.path).toBe('platform.payments.ledger');
        expect(ledger.total).toBe(3);
        expect(ledger.children).toHaveLength(0);
    });

    it('treats traderx and finos.traderx as unrelated roots', () => {
        const tree = buildNamespaceTree([nc('traderx', 9), nc('finos.traderx', 4)]);
        expect(tree.map((n) => n.path)).toEqual(['finos', 'traderx']);

        const finos = tree.find((n) => n.path === 'finos')!;
        expect(finos.total).toBeNull();
        expect(finos.children).toHaveLength(1);
        expect(finos.children[0].path).toBe('finos.traderx');
        expect(finos.children[0].total).toBe(4);

        const traderx = tree.find((n) => n.path === 'traderx')!;
        expect(traderx.total).toBe(9);
        expect(traderx.children).toHaveLength(0);
    });

    it('does not collapse a namespace node even when it has a single child', () => {
        const tree = buildNamespaceTree([nc('finos', 10), nc('finos.calm', 5)]);
        expect(tree).toHaveLength(1);
        expect(tree[0].path).toBe('finos');
        expect(tree[0].total).toBe(10);
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].path).toBe('finos.calm');
    });

    it('sorts children by segment and gives an identical shape for shuffled input', () => {
        const ordered = buildNamespaceTree([nc('finos.wave', 1), nc('finos.calm', 5), nc('finos.axel', 2)]);
        const shuffled = buildNamespaceTree([nc('finos.calm', 5), nc('finos.axel', 2), nc('finos.wave', 1)]);

        expect(ordered[0].children.map((c) => c.segment)).toEqual(['axel', 'calm', 'wave']);
        expect(shuffled).toEqual(ordered);
    });

    it('skips malformed entries (blank or all-dot namespaces)', () => {
        const tree = buildNamespaceTree([nc('', 1), nc('..', 2), nc('finos', 10)]);
        expect(tree).toHaveLength(1);
        expect(tree[0].path).toBe('finos');
    });

    it('handles an empty namespace list', () => {
        expect(buildNamespaceTree([])).toEqual([]);
    });
});

describe('ancestorPathsOf', () => {
    it('returns strict ancestors, nearest root first', () => {
        expect(ancestorPathsOf('finos.calm.payments')).toEqual(['finos', 'finos.calm']);
    });

    it('returns an empty array for a root path', () => {
        expect(ancestorPathsOf('finos')).toEqual([]);
    });
});

describe('filterNamespaceTree', () => {
    const tree = buildNamespaceTree([nc('finos', 10), nc('finos.calm', 5), nc('finos.wave', 3), nc('traderx', 9)]);

    it('matches at any depth and marks strict ancestors visible', () => {
        const visible = filterNamespaceTree(tree, 'wave');
        expect(visible).toEqual(new Set(['finos.wave', 'finos']));
    });

    it('brings a matching parent’s subtree along for free', () => {
        const visible = filterNamespaceTree(tree, 'finos');
        expect(visible.has('finos')).toBe(true);
        expect(visible.has('finos.calm')).toBe(true);
        expect(visible.has('finos.wave')).toBe(true);
        expect(visible.has('traderx')).toBe(false);
    });

    it('returns an empty set for an empty needle', () => {
        expect(filterNamespaceTree(tree, '')).toEqual(new Set());
    });
});

describe('flattenNamespaceTree', () => {
    const tree = buildNamespaceTree([nc('finos', 10), nc('finos.calm', 5), nc('finos.wave', 3), nc('traderx', 9)]);

    it('excludes the node’s own total from descendantTotal', () => {
        const rows = flattenNamespaceTree(tree, { collapsed: new Set(), filtering: false, visible: new Set() });
        const finos = rows.find((r) => r.node.path === 'finos')!;
        expect(finos.node.total).toBe(10);
        expect(finos.descendantTotal).toBe(8);
    });

    it('browse mode hides children of a collapsed node', () => {
        const rows = flattenNamespaceTree(tree, { collapsed: new Set(['finos']), filtering: false, visible: new Set() });
        expect(rows.map((r) => r.node.path)).toEqual(['finos', 'traderx']);
        expect(rows[0].collapsed).toBe(true);
    });

    it('filter mode ignores the collapsed set and emits every visible node', () => {
        const visible = new Set(['finos', 'finos.wave']);
        const rows = flattenNamespaceTree(tree, { collapsed: new Set(['finos']), filtering: true, visible });
        expect(rows.map((r) => r.node.path)).toEqual(['finos', 'finos.wave']);
        expect(rows.every((r) => r.collapsed === false)).toBe(true);
    });
});

describe('splitOnMatch', () => {
    it('splits around the first case-insensitive occurrence', () => {
        expect(splitOnMatch('finos.traderx', 'trade')).toEqual({ prefix: 'finos.', match: 'trade', suffix: 'rx' });
    });

    it('returns null when there is no match', () => {
        expect(splitOnMatch('finos', 'zzz')).toBeNull();
    });

    it('returns null for an empty needle', () => {
        expect(splitOnMatch('finos', '')).toBeNull();
    });
});

describe('no path compression', () => {
    it('keeps a single-child non-namespace intermediate as its own row', () => {
        const tree: NamespaceTreeNode[] = buildNamespaceTree([nc('org.finos', 2), nc('org.finos.calm', 1)]);
        expect(tree).toHaveLength(1);
        expect(tree[0].path).toBe('org');
        expect(tree[0].total).toBeNull();
        expect(tree[0].children).toHaveLength(1);
        expect(tree[0].children[0].path).toBe('org.finos');
    });

    describe('shared row helpers', () => {
        it('indents by a fixed step per level, with no cap, so no two depths collide', () => {
            const widths = [0, 1, 2, 5, 12].map(indentFor);
            expect(widths).toEqual([0, INDENT_STEP, 2 * INDENT_STEP, 5 * INDENT_STEP, 12 * INDENT_STEP]);
            expect(new Set(widths).size).toBe(widths.length);
        });

        it('separates a real namespace from a grouping-only ancestor', () => {
            const [platform] = buildNamespaceTree([nc('platform.payments', 4)]);
            expect(isNamespace(platform)).toBe(false);
            expect(isNamespace(platform.children[0])).toBe(true);
        });
    });
});
