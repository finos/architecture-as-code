import { describe, expect, it } from 'vitest';
import { hasQualifiers, hasUnfinishedQualifier, segmentQuery, suggest } from './search-query.js';

describe('segmentQuery', () => {
    it('marks qualifier keys and values', () => {
        expect(segmentQuery('namespace: finos type:pattern trade')).toEqual([
            { text: 'namespace: ', kind: 'key' },
            { text: 'finos', kind: 'value' },
            { text: ' ', kind: 'text' },
            { text: 'type:', kind: 'key' },
            { text: 'pattern', kind: 'value' },
            { text: ' trade', kind: 'text' },
        ]);
    });

    it('marks an unknown type as invalid', () => {
        expect(segmentQuery('type:decorator')).toEqual([
            { text: 'type:', kind: 'key' },
            { text: 'decorator', kind: 'invalid' },
        ]);
    });

    it('accepts plural types and the ns alias', () => {
        expect(segmentQuery('ns:x type:flows').map((s) => s.kind)).toEqual(['key', 'value', 'text', 'key', 'value']);
    });

    it('keeps a key without a value', () => {
        expect(segmentQuery('namespace:')).toEqual([{ text: 'namespace:', kind: 'key' }]);
    });

    it('returns plain text unchanged', () => {
        expect(segmentQuery('trade')).toEqual([{ text: 'trade', kind: 'text' }]);
    });
});

describe('suggest', () => {
    const namespaces = ['finos', 'payments', 'payments.cards', 'card-services'];

    it('suggests qualifier keys for a partial key', () => {
        expect(suggest('na', namespaces).map((s) => s.apply)).toEqual(['namespace:']);
        expect(suggest('trade ty', namespaces).map((s) => s.apply)).toEqual(['trade type:']);
        expect(suggest('ns', namespaces).map((s) => s.apply)).toEqual(['namespace:']);
    });

    it('suggests nothing for other words, or for one letter', () => {
        expect(suggest('trade', namespaces)).toEqual([]);
        expect(suggest('n', namespaces)).toEqual([]);
        expect(suggest('', namespaces)).toEqual([]);
    });

    it('suggests namespaces, prefix matches first, and adds a space', () => {
        expect(suggest('namespace:card', namespaces).map((s) => s.apply)).toEqual([
            'namespace:card-services ',
            'namespace:payments.cards ',
        ]);
    });

    it('suggests at most 12 values', () => {
        const many = Array.from({ length: 20 }, (_, i) => `ns${i}`);
        expect(suggest('ns:ns', many)).toHaveLength(12);
    });

    it('puts an exact namespace match first', () => {
        expect(suggest('ns:payments', namespaces).map((s) => s.label)).toEqual(['payments', 'payments.cards']);
        expect(suggest('ns:payments', ['payments.cards', 'payments']).map((s) => s.label)).toEqual([
            'payments',
            'payments.cards',
        ]);
    });

    it('suggests types with descriptions', () => {
        const suggestions = suggest('type: pat', namespaces);
        expect(suggestions).toEqual([{ label: 'pattern', description: 'Patterns', apply: 'type: pattern ' }]);
    });

    it('suggests nothing after a value is complete', () => {
        expect(suggest('namespace:payments ', namespaces)).toEqual([]);
    });
});

describe('hasQualifiers', () => {
    it('finds a qualifier with a value', () => {
        expect(hasQualifiers('trade type:pattern')).toBe(true);
        expect(hasQualifiers('ns: finos')).toBe(true);
    });

    it('ignores a key without a value and plain text', () => {
        expect(hasQualifiers('type:')).toBe(false);
        expect(hasQualifiers('trade types')).toBe(false);
    });
});

describe('hasUnfinishedQualifier', () => {
    it('is true while the last qualifier has no value', () => {
        expect(hasUnfinishedQualifier('trade namespace:')).toBe(true);
        expect(hasUnfinishedQualifier('ns: ')).toBe(true);
    });

    it('is false once the qualifier has a value', () => {
        expect(hasUnfinishedQualifier('type:flow')).toBe(false);
        expect(hasUnfinishedQualifier('trade')).toBe(false);
    });
});
