import { describe, it, expect } from 'vitest';
import { hideEmptyPersonalRoot, personalNamespaceRoot } from './personal-namespace.js';
import { NamespaceCounts } from './counts.js';

function counts(namespace: string, total: number): NamespaceCounts {
    return { namespace, total, architectures: total, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0 };
}

describe('personalNamespaceRoot', () => {
    it('returns the parent of the personal namespace', () => {
        expect(personalNamespaceRoot({ status: 'available', name: 'users.alice' })).toBe('users');
        expect(personalNamespaceRoot({ status: 'owned', name: 'org.users.alice' })).toBe('org.users');
    });

    it('returns undefined when the state has no name', () => {
        expect(personalNamespaceRoot({ status: 'loading' })).toBeUndefined();
        expect(personalNamespaceRoot({ status: 'unavailable' })).toBeUndefined();
        expect(personalNamespaceRoot({ status: 'unsupported' })).toBeUndefined();
    });

    it('returns undefined for a name with no parent', () => {
        expect(personalNamespaceRoot({ status: 'taken', name: 'alice' })).toBeUndefined();
    });
});

describe('hideEmptyPersonalRoot', () => {
    const available = { status: 'available', name: 'users.bob' } as const;

    it('hides an empty root with no visible children', () => {
        const input = [counts('finos', 3), counts('users', 0)];
        expect(hideEmptyPersonalRoot(input, available).map((c) => c.namespace)).toEqual(['finos']);
    });

    it('keeps the root when the caller can see a child', () => {
        const input = [counts('finos', 3), counts('users', 0), counts('users.bob', 1)];
        expect(hideEmptyPersonalRoot(input, { status: 'owned', name: 'users.bob' })).toEqual(input);
    });

    it('keeps the root when it has content of its own', () => {
        const input = [counts('users', 2)];
        expect(hideEmptyPersonalRoot(input, available)).toEqual(input);
    });

    it('changes nothing when the root is not known', () => {
        const input = [counts('users', 0)];
        expect(hideEmptyPersonalRoot(input, { status: 'unavailable' })).toEqual(input);
    });
});
