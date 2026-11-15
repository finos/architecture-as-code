import { NamespaceCounts } from './counts.js';

/**
 * The caller's personal namespace, from `GET /api/calm/me/namespace`.
 * `unavailable` covers both "feature off" (404) and a failed request.
 */
export type PersonalNamespaceState =
    | { status: 'loading' }
    | { status: 'unavailable' }
    | { status: 'unsupported' }
    | { status: 'available'; name: string }
    | { status: 'owned'; name: string }
    | { status: 'taken'; name: string };

export function personalNamespaceRoot(state: PersonalNamespaceState): string | undefined {
    if (!('name' in state)) return undefined;
    const dot = state.name.lastIndexOf('.');
    return dot > 0 ? state.name.substring(0, dot) : undefined;
}

/**
 * Hides the personal namespace root when it holds no content and the caller can see none of
 * its children, so users without a personal namespace do not see an empty `users` card.
 */
export function hideEmptyPersonalRoot(counts: NamespaceCounts[], state: PersonalNamespaceState): NamespaceCounts[] {
    const root = personalNamespaceRoot(state);
    if (!root) return counts;
    const hasVisibleChild = counts.some((c) => c.namespace.startsWith(`${root}.`));
    if (hasVisibleChild) return counts;
    return counts.filter((c) => c.namespace !== root || c.total > 0);
}
