import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { SearchQueryError, SearchService } from '../service/search-service.js';
import { GroupedSearchResults } from '../model/search.js';
import { FlatResult, flattenResults } from './useSearchNavigation.js';
import { hasUnfinishedQualifier } from '../model/search-query.js';

const DEBOUNCE_MS = 300;

export interface UseCatalogueSearch {
    query: string;
    results: GroupedSearchResults | null;
    loading: boolean;
    error: boolean;
    /** A message the user can act on, such as an unknown `type:` qualifier. */
    errorMessage: string | null;
    /** Whether the results dropdown should show (opens once a search resolves). */
    open: boolean;
    selectedIndex: number;
    flatResults: FlatResult[];
    handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
    /** Set the query text, as a typed change would. */
    updateQuery: (value: string) => void;
    /** Move the highlight (wraps around); no-op when there are no results. */
    moveSelection: (delta: 1 | -1) => void;
    setSelectedIndex: (index: number) => void;
    /** Cancel any pending debounce / in-flight request without touching state. */
    cancelPending: () => void;
    /** Cancel pending work and reset every field to empty. */
    clear: () => void;
    /** Hide the dropdown and drop the highlight, keeping the query text. */
    closeDropdown: () => void;
}

/**
 * Shared search-input state behind every catalogue search bar (navbar, intro and
 * mobile explorer): debounced querying, request cancellation, grouped results,
 * keyboard highlight and teardown. Presentation and navigate-on-select stay in each
 * component; centralising the state keeps the three bars from drifting.
 */
export function useCatalogueSearch(searchService?: SearchService): UseCatalogueSearch {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GroupedSearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const service = useMemo(() => searchService ?? new SearchService(), [searchService]);

    const flatResults = useMemo(() => (results ? flattenResults(results) : []), [results]);

    const performSearch = useCallback(
        async (searchQuery: string) => {
            if (!searchQuery.trim()) {
                // Abort any in-flight request so a longer query left unresolved can't
                // resolve later and reopen the dropdown with stale results over an
                // empty input. (Its `finally` then skips setLoading(false), so clear
                // loading here too.)
                abortRef.current?.abort();
                setResults(null);
                setOpen(false);
                setError(false);
                setLoading(false);
                return;
            }

            if (hasUnfinishedQualifier(searchQuery)) return;

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            setError(false);
            setErrorMessage(null);
            try {
                const data = await service.search(searchQuery);
                if (controller.signal.aborted) return;
                setResults(data);
                setOpen(true);
                setSelectedIndex(-1);
            } catch (e) {
                if (controller.signal.aborted) return;
                setResults(null);
                setError(true);
                setErrorMessage(e instanceof SearchQueryError && e.userFacing ? e.message : null);
                setOpen(true);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        },
        [service]
    );

    const updateQuery = useCallback(
        (value: string) => {
            setQuery(value);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => performSearch(value), DEBOUNCE_MS);
        },
        [performSearch]
    );

    const handleInputChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => updateQuery(e.target.value),
        [updateQuery]
    );

    const cancelPending = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        abortRef.current?.abort();
    }, []);

    const clear = useCallback(() => {
        // cancelPending aborts any in-flight request; that request's `finally` then
        // skips setLoading(false), so clear loading here too (no stuck spinner).
        cancelPending();
        setQuery('');
        setResults(null);
        setOpen(false);
        setSelectedIndex(-1);
        setError(false);
        setLoading(false);
    }, [cancelPending]);

    const closeDropdown = useCallback(() => {
        setOpen(false);
        setSelectedIndex(-1);
    }, []);

    const moveSelection = useCallback(
        (delta: 1 | -1) => {
            setSelectedIndex((prev) => {
                const len = flatResults.length;
                if (len === 0) return prev;
                if (delta > 0) return prev < len - 1 ? prev + 1 : 0;
                return prev > 0 ? prev - 1 : len - 1;
            });
        },
        [flatResults.length]
    );

    useEffect(() => () => cancelPending(), [cancelPending]);

    return {
        query,
        results,
        loading,
        error,
        errorMessage,
        open,
        selectedIndex,
        flatResults,
        handleInputChange,
        updateQuery,
        moveSelection,
        setSelectedIndex,
        cancelPending,
        clear,
        closeDropdown,
    };
}
