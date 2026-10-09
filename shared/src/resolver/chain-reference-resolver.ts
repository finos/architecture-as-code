import { CalmReferenceResolver } from './calm-reference-resolver.js';

/**
 * Tries a list of resolvers in order, returning the first successful result.
 * More flexible than CompositeReferenceResolver — accepts any resolver chain.
 *
 * Resolution chain for CURIEs (as designed):
 * 1. SHA cache (~/.calm/cache) — permanent, offline-first
 * 2. Local path (--assets-path) — if configured, resolve from filesystem
 * 3. CalmHub (--hub-url) — if configured, expand CURIE to Hub URL
 * 4. HTTP — absolute URLs resolve directly
 */
export class ChainReferenceResolver implements CalmReferenceResolver {
    constructor(private resolvers: CalmReferenceResolver[]) {}

    canResolve(ref: string): boolean {
        return this.resolvers.some((r) => r.canResolve(ref));
    }

    async resolve(ref: string): Promise<unknown> {
        let lastError: unknown;
        for (const resolver of this.resolvers) {
            if (resolver.canResolve(ref)) {
                try {
                    return await resolver.resolve(ref);
                } catch (error) {
                    lastError = error;
                }
            }
        }
        const reason = lastError instanceof Error ? `: ${lastError.message}` : '';
        const error = new Error(`No resolver in chain could resolve: ${ref}${reason}`);
        if (lastError) {
            (error as unknown as Record<string, unknown>).cause = lastError;
        }
        throw error;
    }
}
