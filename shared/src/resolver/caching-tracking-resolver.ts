import { CalmReferenceResolver } from './calm-reference-resolver.js';

/**
 * A caching, tracking {@link CalmReferenceResolver} decorator.
 *
 * The CALM model is lazily dereferenced — callers choose which references to resolve. This resolver
 * wraps any inner {@link CalmReferenceResolver} and centralises the two concerns that would
 * otherwise be re-implemented per caller:
 *  - **caching**: a reference is fetched at most once; repeat requests return the cached document;
 *  - **tracking**: every attempted reference is recorded, so callers can dedupe work
 *    (e.g. "validate each detailed-architecture once") and detect cycles without their own set.
 *
 * A reference is marked as *seen* before the underlying load is awaited, so a failed load still
 * counts as seen (a sibling referencing the same failing URL is not retried) — matching the
 * historical `visitedUrls` semantics. Only successful loads populate the value cache.
 */
export class CachingTrackingResolver implements CalmReferenceResolver {
    private readonly cache = new Map<string, unknown>();
    private readonly seen = new Set<string>();

    constructor(private readonly delegate: CalmReferenceResolver) {}

    /** Delegates to the wrapped resolver. */
    canResolve(reference: string): boolean {
        return this.delegate.canResolve(reference);
    }

    /** Whether the reference has been resolved or attempted (used for dedupe / cycle checks). */
    has(reference: string): boolean {
        return this.seen.has(reference);
    }

    /** The cached raw document for a reference, or undefined if never successfully loaded. */
    get(reference: string): unknown {
        return this.cache.get(reference);
    }

    /** Mark a reference as already seen without loading it (e.g. to seed cycle state). */
    markSeen(reference: string): void {
        this.seen.add(reference);
    }

    /** All references that have been resolved or attempted. */
    get resolvedReferences(): ReadonlySet<string> {
        return this.seen;
    }

    /** Resolve a reference, returning the cached document if already loaded. */
    async resolve(reference: string): Promise<unknown> {
        if (this.cache.has(reference)) {
            return this.cache.get(reference);
        }
        this.seen.add(reference);
        const document = await this.delegate.resolve(reference);
        this.cache.set(reference, document);
        return document;
    }
}
