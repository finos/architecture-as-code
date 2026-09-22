import { describe, it, expect, vi } from 'vitest';
import { CurieReferenceResolver } from './curie-resolver.js';
import { CalmReferenceResolver } from './calm-reference-resolver.js';

describe('CurieReferenceResolver', () => {
    const hubBaseUrl = 'http://hub.example.com';

    function createMockDelegate(canResolveResult: boolean, resolveResult?: unknown): CalmReferenceResolver {
        return {
            canResolve: vi.fn().mockReturnValue(canResolveResult),
            resolve: vi.fn().mockResolvedValue(resolveResult),
        };
    }

    describe('canResolve', () => {
        it('returns true for a CURIE when delegate can resolve the expanded URL', () => {
            const delegate = createMockDelegate(true);
            const resolver = new CurieReferenceResolver(hubBaseUrl, delegate);

            expect(resolver.canResolve('fae-calm:building-blocks:my-block@a1b2c3d')).toBe(true);
            expect(delegate.canResolve).toHaveBeenCalledWith(
                'http://hub.example.com/calm/namespaces/fae-calm/building-blocks/my-block/versions/a1b2c3d'
            );
        });

        it('returns false for non-CURIE strings', () => {
            const delegate = createMockDelegate(true);
            const resolver = new CurieReferenceResolver(hubBaseUrl, delegate);

            expect(resolver.canResolve('https://example.com/resource')).toBe(false);
            expect(delegate.canResolve).not.toHaveBeenCalled();
        });

        it('returns false when delegate rejects the expanded URL', () => {
            const delegate = createMockDelegate(false);
            const resolver = new CurieReferenceResolver(hubBaseUrl, delegate);

            expect(resolver.canResolve('fae-calm:building-blocks:my-block@a1b2c3d')).toBe(false);
            expect(delegate.canResolve).toHaveBeenCalledWith(
                'http://hub.example.com/calm/namespaces/fae-calm/building-blocks/my-block/versions/a1b2c3d'
            );
        });
    });

    describe('resolve', () => {
        it('expands the CURIE and delegates to the underlying resolver', async () => {
            const expectedData = { nodes: [], relationships: [] };
            const delegate = createMockDelegate(true, expectedData);
            const resolver = new CurieReferenceResolver(hubBaseUrl, delegate);

            const result = await resolver.resolve('fae-calm:building-blocks:my-block@a1b2c3d');

            expect(result).toEqual(expectedData);
            expect(delegate.resolve).toHaveBeenCalledWith(
                'http://hub.example.com/calm/namespaces/fae-calm/building-blocks/my-block/versions/a1b2c3d'
            );
        });

        it('expands CURIE without version correctly', async () => {
            const expectedData = { name: 'latest' };
            const delegate = createMockDelegate(true, expectedData);
            const resolver = new CurieReferenceResolver(hubBaseUrl, delegate);

            const result = await resolver.resolve('fae-calm:patterns:api-gateway');

            expect(result).toEqual(expectedData);
            expect(delegate.resolve).toHaveBeenCalledWith(
                'http://hub.example.com/calm/namespaces/fae-calm/patterns/api-gateway'
            );
        });
    });
});
