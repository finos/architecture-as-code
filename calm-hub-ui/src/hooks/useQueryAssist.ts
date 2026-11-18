import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { CalmService } from '../service/calm-service.js';
import { suggest, Suggestion } from '../model/search-query.js';

export interface UseQueryAssist {
    inputRef: React.RefObject<HTMLInputElement | null>;
    highlightRef: React.RefObject<HTMLDivElement | null>;
    suggestions: Suggestion[];
    showSuggestions: boolean;
    suggestionIndex: number;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleFocus: () => void;
    /** Call when focus leaves the search bar. */
    handleBlur: () => void;
    syncHighlightScroll: () => void;
    acceptSuggestion: (suggestion: Suggestion) => void;
    /** Handles the keys that work the suggestions. Returns true when it used the key. */
    handleSuggestionKey: (e: KeyboardEvent) => boolean;
}

/**
 * Qualifier autocomplete (`namespace:`, `type:` and their values) for a catalogue search bar.
 * Namespaces load on the first focus.
 */
export function useQueryAssist(
    query: string,
    updateQuery: (value: string) => void,
    onInputChange: (e: ChangeEvent<HTMLInputElement>) => void,
    calmServiceProp?: CalmService
): UseQueryAssist {
    const calmService = useMemo(() => calmServiceProp ?? new CalmService(), [calmServiceProp]);
    const inputRef = useRef<HTMLInputElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    // Set when the user moves through the suggestions, so Enter on a plain word such as `name` still searches.
    const [picked, setPicked] = useState(false);
    const [namespaces, setNamespaces] = useState<string[] | null>(null);

    const suggestions = useMemo(
        () => (focused && !dismissed ? suggest(query, namespaces ?? []) : []),
        [focused, dismissed, query, namespaces]
    );

    const handleFocus = useCallback(() => {
        setFocused(true);
        if (namespaces === null) {
            setNamespaces([]);
            calmService.fetchNamespaces().then(setNamespaces).catch(() => setNamespaces([]));
        }
    }, [calmService, namespaces]);

    const handleBlur = useCallback(() => setFocused(false), []);

    const syncHighlightScroll = useCallback(() => {
        if (highlightRef.current && inputRef.current) {
            highlightRef.current.scrollLeft = inputRef.current.scrollLeft;
        }
    }, []);

    const acceptSuggestion = useCallback(
        (suggestion: Suggestion) => {
            updateQuery(suggestion.apply);
            setSuggestionIndex(0);
            setPicked(false);
            setDismissed(false);
            requestAnimationFrame(() => {
                const input = inputRef.current;
                if (!input) return;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
                input.scrollLeft = input.scrollWidth;
                syncHighlightScroll();
            });
        },
        [updateQuery, syncHighlightScroll]
    );

    const handleChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            onInputChange(e);
            setFocused(true);
            setSuggestionIndex(0);
            setPicked(false);
            setDismissed(false);
        },
        [onInputChange]
    );

    const handleSuggestionKey = useCallback(
        (e: KeyboardEvent) => {
            if (suggestions.length === 0) return false;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                setSuggestionIndex((i) => (i + delta + suggestions.length) % suggestions.length);
                setPicked(true);
                return true;
            }
            const suggestion = suggestions[suggestionIndex] ?? suggestions[0];
            if (e.key === 'Tab' || (e.key === 'Enter' && (picked || suggestion.kind === 'value'))) {
                e.preventDefault();
                acceptSuggestion(suggestion);
                return true;
            }
            if (e.key === 'Escape') {
                setDismissed(true);
                return true;
            }
            return false;
        },
        [suggestions, suggestionIndex, picked, acceptSuggestion]
    );

    return {
        inputRef,
        highlightRef,
        suggestions,
        showSuggestions: suggestions.length > 0,
        suggestionIndex,
        handleChange,
        handleFocus,
        handleBlur,
        syncHighlightScroll,
        acceptSuggestion,
        handleSuggestionKey,
    };
}
