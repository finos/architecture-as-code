import { describe, it, expect } from 'vitest';
import {
    getPatternArray,
    readCatalog,
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

describe('readCatalog', () => {
    it('returns null for an undefined catalog', () => {
        expect(readCatalog(undefined)).toBeNull();
    });

    it('returns null when neither oneOf nor anyOf is an array', () => {
        expect(readCatalog({})).toBeNull();
        expect(readCatalog({ oneOf: 'not-an-array' })).toBeNull();
    });

    it('reads a oneOf-only catalog', () => {
        const alternatives = [nodeWithId('a'), nodeWithId('b')];
        expect(readCatalog({ oneOf: alternatives })).toEqual({ groupType: 'oneOf', alternatives });
    });

    it('reads an anyOf-only catalog', () => {
        const alternatives = [nodeWithId('a')];
        expect(readCatalog({ anyOf: alternatives })).toEqual({ groupType: 'anyOf', alternatives });
    });

    it('prefers oneOf over anyOf when both are present', () => {
        const oneOfAlts = [nodeWithId('one')];
        const anyOfAlts = [nodeWithId('any')];
        expect(readCatalog({ oneOf: oneOfAlts, anyOf: anyOfAlts })).toEqual({
            groupType: 'oneOf',
            alternatives: oneOfAlts,
        });
    });
});





