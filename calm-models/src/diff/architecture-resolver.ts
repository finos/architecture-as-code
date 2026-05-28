import type { CalmArchitectureSchema } from '../types/index.js';

/**
 * Resolves a `detailed-architecture` string reference (a file path, URL, or
 * CALM Hub reference) to the architecture document it points at.
 *
 * Injecting the resolver keeps {@link resolveMomentArchitecture} pure and
 * environment-agnostic: the CLI can back it with the filesystem, the UI with
 * `fetch`, and the backend with its own document store, without this module
 * depending on `fs` or `fetch`.
 */
export type ArchitectureResolver = (reference: string) => Promise<unknown>;

/**
 * The `details` object hung off a moment, carrying its `detailed-architecture`
 * reference. The reference is either an inline architecture object or a string
 * pointing at one.
 */
export interface MomentDetailsLike {
    'detailed-architecture'?: string | CalmArchitectureSchema | Record<string, unknown>;
}

/**
 * A moment-shaped object exposing the `details` carrying its
 * `detailed-architecture`.
 */
export interface MomentLike {
    'unique-id'?: string;
    details?: MomentDetailsLike;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves a moment's `detailed-architecture` to a concrete architecture
 * document.
 *
 * - When the reference is already an inline object it is returned directly (the
 *   resolver is never called).
 * - When the reference is a string it is passed to the injected
 *   {@link ArchitectureResolver}.
 *
 * Throws when the moment carries no `detailed-architecture`, or when a string
 * reference is supplied without a resolver.
 */
export async function resolveMomentArchitecture(
    moment: MomentLike,
    resolver?: ArchitectureResolver,
): Promise<CalmArchitectureSchema> {
    const reference = moment.details?.['detailed-architecture'];
    const momentId = moment['unique-id'] ?? '<unknown>';

    if (reference === undefined || reference === null) {
        throw new Error(
            `Moment '${momentId}' has no details.detailed-architecture to resolve.`,
        );
    }

    if (isObject(reference)) {
        return reference as CalmArchitectureSchema;
    }

    if (typeof reference === 'string') {
        if (!resolver) {
            throw new Error(
                `Moment '${momentId}' has a string detailed-architecture reference ` +
                    `('${reference}') but no resolver was provided to load it.`,
            );
        }
        const resolved = await resolver(reference);
        return resolved as CalmArchitectureSchema;
    }

    throw new Error(
        `Moment '${momentId}' has an unsupported detailed-architecture reference ` +
            `of type '${typeof reference}'; expected a string or an inline object.`,
    );
}
