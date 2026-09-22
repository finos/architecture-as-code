import { describe, it, expect, vi } from 'vitest';
import { ChainReferenceResolver } from './chain-reference-resolver';
import { CalmReferenceResolver } from './calm-reference-resolver';

function mockResolver(canResolve: boolean, result?: unknown, shouldThrow = false): CalmReferenceResolver {
    return {
        canResolve: vi.fn().mockReturnValue(canResolve),
        resolve: vi.fn().mockImplementation(async () => {
            if (shouldThrow) throw new Error('resolver failed');
            return result;
        }),
    };
}

describe('ChainReferenceResolver', () => {
    it('returns the first successful resolution', async () => {
        const r1 = mockResolver(true, { first: true });
        const r2 = mockResolver(true, { second: true });
        const chain = new ChainReferenceResolver([r1, r2]);

        const result = await chain.resolve('some:ref');
        expect(result).toEqual({ first: true });
        expect(r2.resolve).not.toHaveBeenCalled();
    });

    it('skips resolvers that cannot resolve', async () => {
        const r1 = mockResolver(false);
        const r2 = mockResolver(true, { data: 42 });
        const chain = new ChainReferenceResolver([r1, r2]);

        const result = await chain.resolve('some:ref');
        expect(result).toEqual({ data: 42 });
        expect(r1.resolve).not.toHaveBeenCalled();
    });

    it('falls through to next resolver on error', async () => {
        const r1 = mockResolver(true, undefined, true);
        const r2 = mockResolver(true, { fallback: true });
        const chain = new ChainReferenceResolver([r1, r2]);

        const result = await chain.resolve('some:ref');
        expect(result).toEqual({ fallback: true });
    });

    it('throws when no resolver can handle the ref', async () => {
        const r1 = mockResolver(false);
        const chain = new ChainReferenceResolver([r1]);

        await expect(chain.resolve('unknown:ref')).rejects.toThrow('No resolver in chain could resolve');
    });

    it('canResolve returns true if any resolver can handle it', () => {
        const r1 = mockResolver(false);
        const r2 = mockResolver(true);
        const chain = new ChainReferenceResolver([r1, r2]);

        expect(chain.canResolve('some:ref')).toBe(true);
    });

    it('canResolve returns false if no resolver can handle it', () => {
        const r1 = mockResolver(false);
        const chain = new ChainReferenceResolver([r1]);

        expect(chain.canResolve('some:ref')).toBe(false);
    });
});
