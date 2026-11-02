import { CachingTrackingResolver } from './caching-tracking-resolver';
import { CalmReferenceResolver } from './calm-reference-resolver';

function fakeResolver(overrides: Partial<CalmReferenceResolver> = {}): CalmReferenceResolver {
    return {
        canResolve: overrides.canResolve ?? vi.fn().mockReturnValue(true),
        resolve: overrides.resolve ?? vi.fn().mockResolvedValue({})
    };
}

describe('CachingTrackingResolver', () => {
    it('loads a reference once and caches the result', async () => {
        const resolve = vi.fn().mockResolvedValue({ doc: 1 });
        const resolver = new CachingTrackingResolver(fakeResolver({ resolve }));

        const first = await resolver.resolve('a');
        const second = await resolver.resolve('a');

        expect(first).toEqual({ doc: 1 });
        expect(second).toBe(first);
        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('delegates canResolve to the inner resolver', () => {
        const canResolve = vi.fn().mockReturnValue(false);
        const resolver = new CachingTrackingResolver(fakeResolver({ canResolve }));

        expect(resolver.canResolve('a')).toBe(false);
        expect(canResolve).toHaveBeenCalledWith('a');
    });

    it('tracks resolved references via has() and resolvedReferences', async () => {
        const resolver = new CachingTrackingResolver(fakeResolver());

        expect(resolver.has('a')).toBe(false);
        await resolver.resolve('a');

        expect(resolver.has('a')).toBe(true);
        expect([...resolver.resolvedReferences]).toEqual(['a']);
    });

    it('exposes the cached raw document via get()', async () => {
        const resolver = new CachingTrackingResolver(fakeResolver({ resolve: vi.fn().mockResolvedValue({ raw: true }) }));

        await resolver.resolve('a');

        expect(resolver.get('a')).toEqual({ raw: true });
        expect(resolver.get('missing')).toBeUndefined();
    });

    it('marks a reference as seen even when the load fails (no retry for siblings)', async () => {
        const resolve = vi.fn().mockRejectedValue(new Error('boom'));
        const resolver = new CachingTrackingResolver(fakeResolver({ resolve }));

        await expect(resolver.resolve('a')).rejects.toThrow('boom');

        expect(resolver.has('a')).toBe(true);
        expect(resolver.get('a')).toBeUndefined();
    });

    // Covers rocketstack-matt's review comment on PR #2805:
    // https://github.com/finos/architecture-as-code/pull/2805#discussion_r3576885163
    // A failed load is cached, so a second resolve() re-throws the cached error without re-hitting
    // the delegate.
    it('does not retry the delegate for a reference whose first load failed', async () => {
        const resolve = vi.fn().mockRejectedValue(new Error('boom'));
        const resolver = new CachingTrackingResolver(fakeResolver({ resolve }));

        await expect(resolver.resolve('a')).rejects.toThrow('boom');
        await expect(resolver.resolve('a')).rejects.toThrow('boom');

        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('supports pre-seeding seen references via markSeen()', () => {
        const resolver = new CachingTrackingResolver(fakeResolver());

        resolver.markSeen('a');

        expect(resolver.has('a')).toBe(true);
    });

    it('tracks active traversal ancestry and cleans up via withAncestry()', async () => {
        const resolver = new CachingTrackingResolver(fakeResolver());

        expect(resolver.ancestry).toEqual([]);
        expect(resolver.isInAncestry('a')).toBe(false);

        await resolver.withAncestry('a', async () => {
            expect(resolver.ancestry).toEqual(['a']);
            expect(resolver.isInAncestry('a')).toBe(true);
            expect(resolver.isInAncestry('b')).toBe(false);

            await resolver.withAncestry('b', async () => {
                expect(resolver.ancestry).toEqual(['a', 'b']);
                expect(resolver.isInAncestry('b')).toBe(true);
                expect(resolver.formatCycle('a')).toBe('a -> b -> a');
                expect(resolver.formatCycle('b')).toBe('b -> b');
            });

            expect(resolver.ancestry).toEqual(['a']);
            expect(resolver.isInAncestry('b')).toBe(false);
        });

        expect(resolver.ancestry).toEqual([]);
        expect(resolver.isInAncestry('a')).toBe(false);
    });

    it('pops ancestry even when the callback throws', async () => {
        const resolver = new CachingTrackingResolver(fakeResolver());

        await expect(
            resolver.withAncestry('a', async () => {
                throw new Error('fail');
            })
        ).rejects.toThrow('fail');

        expect(resolver.ancestry).toEqual([]);
        expect(resolver.isInAncestry('a')).toBe(false);
    });

    it('handles leave() for a reference not in ancestry as a no-op', () => {
        const resolver = new CachingTrackingResolver(fakeResolver());
        resolver.enter('a');
        resolver.leave('missing');
        expect(resolver.ancestry).toEqual(['a']);
        expect(resolver.formatCycle('c')).toBe('a -> c');
    });
});
