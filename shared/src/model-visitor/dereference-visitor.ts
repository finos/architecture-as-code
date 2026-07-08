import { CalmReferenceResolver } from '../resolver/calm-reference-resolver';
import { CalmModelVisitor } from './calm-model-visitor';
import { ModelWalker } from './model-walker.js';
import { initLogger, Logger } from '../logger.js';

/**
 * Dereferences every unresolved `Resolvable`/`ResolvableAndAdaptable` in the model.
 *
 * Traversal, dereferencing, cycle safety and error collection are all owned by the shared
 * {@link ModelWalker}, which drives dereferencing through the injected {@link CalmReferenceResolver}.
 * The visitor is agnostic to the resolver's behaviour — if caching or reference-tracking is wanted,
 * the caller composes a {@link import('../resolver/caching-tracking-resolver').CachingTrackingResolver}
 * (or any other decorator) around the resolver it passes in.
 */
export class DereferencingVisitor implements CalmModelVisitor {
    private static _logger: Logger | undefined;

    constructor(private readonly resolver: CalmReferenceResolver) {}

    private static get logger(): Logger {
        if (!this._logger) {
            this._logger = initLogger(process.env.DEBUG === 'true', DereferencingVisitor.name);
        }
        return this._logger;
    }

    async visit(obj: unknown): Promise<void> {
        const walker = new ModelWalker(this.resolver);

        await walker.walk(obj);

        for (const error of walker.errors) {
            DereferencingVisitor.logger.warn(
                `Failed to dereference Resolvable: ${error.reference} ${error.message}`
            );
        }
    }
}
