import { describe, it, expect } from 'vitest';
import {
    getPatternArray,
    readChoiceBlock,
    listCandidates,
    listSelectableCandidates,
    type SchemaNode,
} from './pattern-reader.js';

function nodeWithId(uniqueId: string): SchemaNode {
    return { properties: { 'unique-id': { const: uniqueId } } };
}

describe('getPatternArray', () => {
    it('reads prefixItems and catalog declared directly under properties', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [nodeWithId('a')],
                    items: { oneOf: [nodeWithId('b')] },
                },
            },
        };

        const result = getPatternArray(pattern, 'nodes');
        expect(result.prefixItems).toEqual([nodeWithId('a')]);
        expect(result.catalog).toEqual({ oneOf: [nodeWithId('b')] });
    });

    it('yields an empty prefixItems array and undefined catalog when neither is declared', () => {
        const result = getPatternArray({ properties: {} }, 'nodes');
        expect(result.prefixItems).toEqual([]);
        expect(result.catalog).toBeUndefined();
    });

    it('falls back to the first allOf branch that declares the array', () => {
        const pattern = {
            allOf: [
                { properties: { nodes: { prefixItems: [nodeWithId('first-branch')] } } },
                { properties: { nodes: { prefixItems: [nodeWithId('second-branch')] } } },
            ],
        };

        const result = getPatternArray(pattern, 'nodes');
        // TEMPORARY (first-branch-wins): a later branch declaring the same path is
        // invisible today. Do not "fix" this here — see the reader's allOf note.
        expect(result.prefixItems).toEqual([nodeWithId('first-branch')]);
    });

    it('prefers a direct declaration over an allOf branch', () => {
        const pattern = {
            properties: { nodes: { prefixItems: [nodeWithId('direct')] } },
            allOf: [{ properties: { nodes: { prefixItems: [nodeWithId('branch')] } } }],
        };

        expect(getPatternArray(pattern, 'nodes').prefixItems).toEqual([nodeWithId('direct')]);
    });

    it('treats a falsy keyword value (e.g. items: false closing a tuple) as absent', () => {
        const pattern = { properties: { nodes: { prefixItems: [nodeWithId('a')], items: false } } };
        expect(getPatternArray(pattern, 'nodes').catalog).toBeUndefined();
    });
});

describe('readChoiceBlock', () => {
    it('returns null for an undefined catalog', () => {
        expect(readChoiceBlock(undefined)).toBeNull();
    });

    it('returns null when neither oneOf nor anyOf is an array', () => {
        expect(readChoiceBlock({})).toBeNull();
        expect(readChoiceBlock({ oneOf: 'not-an-array' })).toBeNull();
    });

    it('reads a oneOf-only catalog', () => {
        const alternatives = [nodeWithId('a'), nodeWithId('b')];
        expect(readChoiceBlock({ oneOf: alternatives })).toEqual({ groupType: 'oneOf', alternatives });
    });

    it('reads an anyOf-only catalog', () => {
        const alternatives = [nodeWithId('a')];
        expect(readChoiceBlock({ anyOf: alternatives })).toEqual({ groupType: 'anyOf', alternatives });
    });

    it('prefers oneOf over anyOf when both are present', () => {
        const oneOfAlts = [nodeWithId('one')];
        const anyOfAlts = [nodeWithId('any')];
        expect(readChoiceBlock({ oneOf: oneOfAlts, anyOf: anyOfAlts })).toEqual({
            groupType: 'oneOf',
            alternatives: oneOfAlts,
        });
    });
});

describe('listCandidates', () => {
    it('lists a plain prefixItems entry', () => {
        const pattern = { properties: { nodes: { prefixItems: [nodeWithId('solo')] } } };
        expect(listCandidates(pattern, 'nodes')).toEqual([
            { uniqueId: 'solo', site: 'prefixItem', node: nodeWithId('solo'), path: ['properties', 'nodes', 'prefixItems', 0] },
        ]);
    });

    it('unions oneOf and anyOf on the same slot, unlike readChoiceBlock', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [{ oneOf: [nodeWithId('a')], anyOf: [nodeWithId('b')] }],
                },
            },
        };

        const candidates = listCandidates(pattern, 'nodes');
        expect(candidates.map((c) => c.uniqueId)).toEqual(['a', 'b']);
        expect(candidates.map((c) => c.blockType)).toEqual(['oneOf', 'anyOf']);
        expect(candidates.every((c) => c.site === 'prefixItemAlternative' && c.slotIndex === 0)).toBe(true);
    });

    it('yields both the slot and its alternatives for a hybrid slot', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [{ ...nodeWithId('hybrid'), oneOf: [nodeWithId('alt')] }],
                },
            },
        };

        const candidates = listCandidates(pattern, 'nodes');
        expect(candidates.map((c) => ({ uniqueId: c.uniqueId, site: c.site }))).toEqual([
            { uniqueId: 'hybrid', site: 'prefixItem' },
            { uniqueId: 'alt', site: 'prefixItemAlternative' },
        ]);
    });

    it('lists items.oneOf and items.anyOf catalog members together', () => {
        const pattern = {
            properties: {
                nodes: {
                    items: { oneOf: [nodeWithId('cat-one')], anyOf: [nodeWithId('cat-any')] },
                },
            },
        };

        const candidates = listCandidates(pattern, 'nodes');
        expect(candidates).toEqual([
            { uniqueId: 'cat-one', site: 'catalogMember', node: nodeWithId('cat-one'), path: ['properties', 'nodes', 'items', 'oneOf', 0], blockType: 'oneOf' },
            { uniqueId: 'cat-any', site: 'catalogMember', node: nodeWithId('cat-any'), path: ['properties', 'nodes', 'items', 'anyOf', 0], blockType: 'anyOf' },
        ]);
    });

    it('skips a pure choice-block slot with no unique-id of its own', () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [{ oneOf: [nodeWithId('a'), nodeWithId('b')] }] },
            },
        };

        const candidates = listCandidates(pattern, 'nodes');
        expect(candidates.map((c) => c.uniqueId)).toEqual(['a', 'b']);
        expect(candidates.some((c) => c.uniqueId === undefined)).toBe(false);
    });

    it('skips a catalog member with no const-pinned unique-id', () => {
        const pattern = {
            properties: { nodes: { items: { oneOf: [{ properties: {} }] } } },
        };
        expect(listCandidates(pattern, 'nodes')).toEqual([]);
    });

    it('returns an empty array when the calmType is absent', () => {
        expect(listCandidates({ properties: {} }, 'nodes')).toEqual([]);
    });

    it('does not fall back into an allOf branch, unlike getPatternArray', () => {
        const pattern = {
            allOf: [{ properties: { nodes: { prefixItems: [nodeWithId('in-a-branch')] } } }],
        };
        expect(listCandidates(pattern, 'nodes')).toEqual([]);
    });
});

describe('listSelectableCandidates', () => {
    it('lists a plain prefixItems entry, same as listCandidates', () => {
        const pattern = { properties: { nodes: { prefixItems: [nodeWithId('solo')] } } };
        expect(listSelectableCandidates(pattern, 'nodes')).toEqual([
            { uniqueId: 'solo', site: 'prefixItem', node: nodeWithId('solo'), path: ['properties', 'nodes', 'prefixItems', 0] },
        ]);
    });

    it('resolves only the winning keyword of a dual-keyword block, unlike listCandidates', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [{ oneOf: [nodeWithId('a')], anyOf: [nodeWithId('b')] }],
                },
            },
        };

        const declared = listCandidates(pattern, 'nodes').map((c) => c.uniqueId);
        const selectable = listSelectableCandidates(pattern, 'nodes').map((c) => c.uniqueId);
        expect(declared).toEqual(['a', 'b']);
        expect(selectable).toEqual(['a']);
    });

    it('yields both the slot and its winning alternatives for a hybrid slot', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [{ ...nodeWithId('hybrid'), oneOf: [nodeWithId('alt-a')], anyOf: [nodeWithId('alt-b')] }],
                },
            },
        };

        const candidates = listSelectableCandidates(pattern, 'nodes');
        expect(candidates.map((c) => ({ uniqueId: c.uniqueId, site: c.site }))).toEqual([
            { uniqueId: 'hybrid', site: 'prefixItem' },
            { uniqueId: 'alt-a', site: 'prefixItemAlternative' },
        ]);
    });

    it('resolves only the winning keyword of a dual-keyword items catalog', () => {
        const pattern = {
            properties: {
                nodes: {
                    items: { oneOf: [nodeWithId('cat-one')], anyOf: [nodeWithId('cat-any')] },
                },
            },
        };

        expect(listSelectableCandidates(pattern, 'nodes').map((c) => c.uniqueId)).toEqual(['cat-one']);
    });

    it('lists every alternative when only one keyword is declared, same as listCandidates', () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [{ anyOf: [nodeWithId('a'), nodeWithId('b')] }] },
            },
        };
        expect(listSelectableCandidates(pattern, 'nodes').map((c) => c.uniqueId)).toEqual(['a', 'b']);
    });

    it('skips a catalog member with no const-pinned unique-id', () => {
        const pattern = {
            properties: { nodes: { items: { oneOf: [{ properties: {} }] } } },
        };
        expect(listSelectableCandidates(pattern, 'nodes')).toEqual([]);
    });

    it('returns an empty array when the calmType is absent', () => {
        expect(listSelectableCandidates({ properties: {} }, 'nodes')).toEqual([]);
    });

    it('does not fall back into an allOf branch, unlike getPatternArray', () => {
        const pattern = {
            allOf: [{ properties: { nodes: { prefixItems: [nodeWithId('in-a-branch')] } } }],
        };
        expect(listSelectableCandidates(pattern, 'nodes')).toEqual([]);
    });
});

