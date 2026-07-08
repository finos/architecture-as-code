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

    it('supports pre-seeding seen references via markSeen()', () => {
        const resolver = new CachingTrackingResolver(fakeResolver());

        resolver.markSeen('a');

        expect(resolver.has('a')).toBe(true);
    });
});
