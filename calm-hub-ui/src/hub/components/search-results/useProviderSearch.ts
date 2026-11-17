import { useCallback, useEffect, useRef, useState } from 'react';
import { useExtensionService } from '../../../extensions/ExtensionsContext.js';
import { ExtensionSearchError } from '../../../service/extension-service.js';
import type { ExtensionSearchResult } from '../../../model/search.js';

/** The most results that one provider shows for a query, over all its pages. */
export const MAX_PROVIDER_RESULTS = 50;

export type ProviderSearch =
    | { status: 'loading' }
    | { status: 'failed'; timedOut: boolean }
    | { status: 'loaded'; results: ExtensionSearchResult[]; hasMore: boolean; more: 'idle' | 'loading' | 'failed' };

type Loaded = { status: 'loaded'; results: ExtensionSearchResult[]; next?: string; more: 'idle' | 'loading' | 'failed' };
type State = { status: 'loading' } | { status: 'failed'; timedOut: boolean } | Loaded;

// A later page can repeat a result of an earlier one, and the list is keyed by id.
function append(results: ExtensionSearchResult[], page: ExtensionSearchResult[]): ExtensionSearchResult[] {
    const ids = new Set(results.map((result) => result.id));
    return [...results, ...page.filter((result) => !ids.has(result.id))].slice(0, MAX_PROVIDER_RESULTS);
}

/**
 * The results of one search provider for a query. Each provider has its own state, so a slow or failed one does not
 * hold back or replace the others. A reply for an earlier query or attempt is dropped, and its request is cancelled.
 */
export function useProviderSearch(extensionId: string, providerId: string, query: string) {
    const service = useExtensionService();
    const [attempt, setAttempt] = useState(0);
    // Kept with the query and attempt that it is for, so a new query shows loading at once.
    const [entry, setEntry] = useState<{ query: string; attempt: number; state: State }>();
    const generation = useRef(0);
    const more = useRef<AbortController | null>(null);

    useEffect(() => {
        const current = ++generation.current;
        const controller = new AbortController();
        service
            .search(extensionId, providerId, query, undefined, controller.signal)
            .then((page) => {
                if (generation.current !== current) return;
                setEntry({ query, attempt, state: { status: 'loaded', results: append([], page.results), next: page.next, more: 'idle' } });
            })
            .catch((error: unknown) => {
                if (generation.current !== current) return;
                const timedOut = error instanceof ExtensionSearchError && error.timedOut;
                setEntry({ query, attempt, state: { status: 'failed', timedOut } });
            });
        return () => {
            generation.current += 1;
            controller.abort();
            more.current?.abort();
        };
    }, [service, extensionId, providerId, query, attempt]);

    const state: State = entry && entry.query === query && entry.attempt === attempt ? entry.state : { status: 'loading' };

    const loadMore = () => {
        if (state.status !== 'loaded' || !state.next || state.more === 'loading') return;
        const current = generation.current;
        const controller = new AbortController();
        more.current = controller;
        const update = (change: (loaded: Loaded) => Loaded) =>
            setEntry((previous) =>
                previous && previous.state.status === 'loaded' && generation.current === current
                    ? { ...previous, state: change(previous.state) }
                    : previous
            );
        update((loaded) => ({ ...loaded, more: 'loading' }));
        service
            .search(extensionId, providerId, query, state.next, controller.signal)
            .then((page) =>
                update((loaded) => ({ ...loaded, results: append(loaded.results, page.results), next: page.next, more: 'idle' }))
            )
            .catch(() => update((loaded) => ({ ...loaded, more: 'failed' })));
    };

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    const search: ProviderSearch =
        state.status === 'loaded'
            ? {
                  status: 'loaded',
                  results: state.results,
                  hasMore: !!state.next && state.results.length < MAX_PROVIDER_RESULTS,
                  more: state.more,
              }
            : state;
    return { search, loadMore, retry };
}
