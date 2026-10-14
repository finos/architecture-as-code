import { CalmReferenceResolver } from './calm-reference-resolver.js';

/**
 * Tries a list of resolvers in order, returning the first successful result.
 * More flexible than CompositeReferenceResolver — accepts any resolver chain.
 */
export class ChainReferenceResolver implements CalmReferenceResolver {
    constructor(private resolvers: CalmReferenceResolver[]) {}

    canResolve(ref: string): boolean {
        return this.resolvers.some((r) => r.canResolve(ref));
    }

    async resolve(ref: string): Promise<unknown> {
        const errors: Error[] = [];
        for (const resolver of this.resolvers) {
            if (resolver.canResolve(ref)) {
                try {
                    return await resolver.resolve(ref);
                } catch (error) {
                    if (error instanceof Error) errors.push(error);
                }
            }
        }
        const detail = errors.map(e => e.message).join('; ');
        const message = detail
            ? `No resolver in chain could resolve: ${ref}: ${detail}`
            : `No resolver in chain could resolve: ${ref}`;
        const error = new Error(message);
        if (errors.length > 0) {
            (error as Error & { cause: Error }).cause = errors[0];
        }
        throw error;
    }
}
