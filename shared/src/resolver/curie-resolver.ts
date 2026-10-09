import { CalmReferenceResolver } from './calm-reference-resolver.js';
import { expandCurie, isCurie } from '../hub/curie.js';

export class CurieReferenceResolver implements CalmReferenceResolver {
    constructor(
        private hubBaseUrl: string,
        private delegate: CalmReferenceResolver
    ) {}

    canResolve(ref: string): boolean {
        if (!isCurie(ref)) return false;
        try {
            const expanded = expandCurie(ref, this.hubBaseUrl);
            return this.delegate.canResolve(expanded);
        } catch {
            return false;
        }
    }

    async resolve(ref: string): Promise<unknown> {
        const expanded = expandCurie(ref, this.hubBaseUrl);
        return this.delegate.resolve(expanded);
    }
}
