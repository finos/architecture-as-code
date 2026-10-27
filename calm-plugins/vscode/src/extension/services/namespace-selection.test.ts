import { describe, it, expect } from 'vitest';
import { resolveSelectedNamespaces } from './namespace-selection';

describe('resolveSelectedNamespaces', () => {
    const available = ['alpha', 'beta', 'gamma'];

    it('treats an empty selection as "all namespaces"', () => {
        expect(resolveSelectedNamespaces(available, [])).toEqual(available);
    });

    it('treats an unset selection as "all namespaces"', () => {
        expect(resolveSelectedNamespaces(available, undefined)).toEqual(available);
        expect(resolveSelectedNamespaces(available, null)).toEqual(available);
    });

    it('keeps only the selected namespaces', () => {
        expect(resolveSelectedNamespaces(available, ['gamma', 'alpha'])).toEqual(['alpha', 'gamma']);
    });

    it('drops names that the hub no longer lists', () => {
        expect(resolveSelectedNamespaces(available, ['alpha', 'gone'])).toEqual(['alpha']);
    });

    it('returns nothing when the hub lists no namespaces', () => {
        expect(resolveSelectedNamespaces([], [])).toEqual([]);
    });
});
