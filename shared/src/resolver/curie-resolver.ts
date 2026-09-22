import { CalmReferenceResolver } from './calm-reference-resolver.js';
import { expandCurie, isCurie } from '../hub/curie.js';

export class CurieReferenceResolver implements CalmReferenceResolver {
    constructor(
        private hubBaseUrl: string,
        private delegate: CalmReferenceResolver
    ) {}

    canResolve(ref: string): boolean {
        if (!isCurie(ref)) return false;
        const expanded = expandCurie(ref, this.hubBaseUrl);
        return this.delegate.canResolve(expanded);
    }

    async resolve(ref: string): Promise<unknown> {
        const expanded = expandCurie(ref, this.hubBaseUrl);
        return this.delegate.resolve(expanded);
    }
}
