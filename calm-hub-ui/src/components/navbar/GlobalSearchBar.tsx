import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { SearchService } from '../../service/search-service.js';
import { CalmService } from '../../service/calm-service.js';
import { AdrService } from '../../service/adr-service/adr-service.js';
import { SearchResult } from '../../model/search.js';
import { SEARCH_PLACEHOLDER_HINT } from '../../model/search-query.js';
import { AssistedSearchInput } from './search/AssistedSearchInput.js';
import { useQueryAssist } from '../../hooks/useQueryAssist.js';
import { SearchSuggestionList } from './search/SearchSuggestionList.js';
import { FlatResult, TYPE_LABELS, useSearchNavigation } from '../../hooks/useSearchNavigation.js';
import { useCatalogueSearch } from '../../hooks/useCatalogueSearch.js';
import { useProductName } from '../branding/brand-names.js';
import { colors } from '../../theme/colors.js';
import { SearchChatEntry } from '../../extensions/chat/SearchChatEntry.js';
import { useChatProvider } from '../../extensions/ExtensionsContext.js';

interface GlobalSearchBarProps {
    searchService?: SearchService;
    calmService?: CalmService;
    adrService?: AdrService;
}

export function GlobalSearchBar({ searchService, calmService: calmServiceProp, adrService: adrServiceProp }: GlobalSearchBarProps) {
    const productName = useProductName();
    const chat = useChatProvider();
    const {
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
        clear,
        closeDropdown,
    } = useCatalogueSearch(searchService);

    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();
    const noticeId = useId();
    const [dismissed, setDismissed] = useState(false);
    const resultsOpen = open && !dismissed;
    const optionId = (index: number) => `${listboxId}-option-${index}`;
    const calmService = useMemo(() => calmServiceProp ?? new CalmService(), [calmServiceProp]);
    const {
        inputRef,
        highlightRef,
        suggestions,
        showSuggestions,
        suggestionIndex,
        handleChange,
        handleFocus,
        handleBlur,
        syncHighlightScroll,
        acceptSuggestion,
        handleSuggestionKey,
    } = useQueryAssist(query, updateQuery, handleInputChange, calmService);
    const listboxOpen = resultsOpen || showSuggestions;
    const noticeOpen = !!chat && !!query.trim() && !dismissed && !showSuggestions;
    const activeDescendant = showSuggestions
        ? optionId(suggestionIndex)
        : resultsOpen && flatResults[selectedIndex] ? optionId(selectedIndex) : undefined;
    const adrService = useMemo(() => adrServiceProp ?? new AdrService(), [adrServiceProp]);
    const { navigateToResult: goToResult, submitSearch } = useSearchNavigation({ calmService, adrService });

    const dismiss = useCallback(() => {
        setDismissed(true);
        closeDropdown();
    }, [closeDropdown]);

    const navigateToResult = useCallback(
        (flatResult: FlatResult) => {
            clear();
            goToResult(flatResult);
        },
        [clear, goToResult]
    );

    // `clear` also cancels the pending debounce, so no stray dropdown reopens after nav.
    const submitQuery = useCallback(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        clear();
        submitSearch(trimmed);
    }, [query, clear, submitSearch]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (handleSuggestionKey(e)) return;
            if (e.key === 'ArrowDown') {
                if (!resultsOpen || flatResults.length === 0) return;
                e.preventDefault();
                moveSelection(1);
            } else if (e.key === 'ArrowUp') {
                if (!resultsOpen || flatResults.length === 0) return;
                e.preventDefault();
                moveSelection(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // A highlighted preview result deep-links; otherwise submit the query.
                if (resultsOpen && selectedIndex >= 0 && flatResults[selectedIndex]) {
                    navigateToResult(flatResults[selectedIndex]);
                } else {
                    submitQuery();
                }
            } else if (e.key === 'Escape') {
                dismiss();
            }
        },
        [handleSuggestionKey, resultsOpen, flatResults, selectedIndex, moveSelection, navigateToResult, submitQuery, dismiss]
    );

    const handleClear = useCallback(() => {
        clear();
        inputRef.current?.focus();
    }, [clear, inputRef]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                dismiss();
                handleBlur();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dismiss, handleBlur]);

    const renderGroupedResults = () => {
        if (error) {
            return <div className="p-3 text-sm text-error">{errorMessage ?? 'Search failed, please try again'}</div>;
        }

        if (!results) return null;

        const groups = Object.entries(results).filter(
            ([, items]) => (items as SearchResult[]).length > 0
        );

        if (groups.length === 0) {
            return <div className="p-3 text-sm text-base-content/60">No results found</div>;
        }

        let globalIndex = 0;

        return groups.map(([type, items]) => (
            <div key={type} role="group" aria-labelledby={`${listboxId}-group-${type}`}>
                <div
                    id={`${listboxId}-group-${type}`}
                    className="px-3 py-1 font-mono-jb text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: colors.redesign.faintAlt, backgroundColor: colors.redesign.surface }}
                >
                    {TYPE_LABELS[type] ?? type}
                </div>
                {(items as SearchResult[]).map((item) => {
                    const currentIndex = globalIndex++;
                    return (
                        <button
                            key={`${type}-${item.namespace}-${item.id}`}
                            id={optionId(currentIndex)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-base-200 cursor-pointer ${
                                currentIndex === selectedIndex ? 'bg-base-200' : ''
                            }`}
                            onMouseDown={() => navigateToResult({ type, result: item })}
                            role="option"
                            aria-selected={currentIndex === selectedIndex}
                        >
                            {/* Name + a right-aligned mono namespace chip so duplicate
                                names across namespaces (problem #9) are distinguishable.
                                No version chip: SearchResult carries no version and
                                resolving it per result would be an N+1 — deferred. */}
                            <div className="flex items-center gap-2">
                                <span
                                    className="font-medium truncate min-w-0"
                                    style={{ color: colors.redesign.ink }}
                                >
                                    {item.name}
                                </span>
                                <span
                                    data-testid="result-namespace-chip"
                                    className="ml-auto shrink-0 font-mono-jb text-[10px] rounded-[6px] px-1.5 py-0.5"
                                    style={{
                                        backgroundColor: colors.redesign.badgeBg,
                                        color: colors.redesign.mutedAlt,
                                    }}
                                >
                                    {item.namespace}
                                </span>
                            </div>
                            {item.description && (
                                <div
                                    className="text-xs truncate mt-0.5"
                                    style={{ color: colors.redesign.mutedAlt }}
                                >
                                    {item.description}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        ));
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="flex items-center gap-1 bg-base-200 rounded-lg px-3 py-1.5">
                <IoSearchOutline className="text-base-content/50 h-4 w-4 shrink-0" />
                <AssistedSearchInput
                    query={query}
                    inputRef={inputRef}
                    highlightRef={highlightRef}
                    onChange={(event) => {
                        setDismissed(false);
                        handleChange(event);
                    }}
                    onFocus={handleFocus}
                    onSyncScroll={syncHighlightScroll}
                    wrapperClassName="w-28 sm:w-56 lg:w-80"
                    textClassName="text-sm leading-5"
                    placeholder={`Search ${productName}… e.g. ${SEARCH_PLACEHOLDER_HINT}`}
                    onKeyDown={handleKeyDown}
                    aria-label="Search"
                    role="combobox"
                    aria-expanded={listboxOpen}
                    aria-haspopup="listbox"
                    aria-controls={listboxOpen ? listboxId : undefined}
                    aria-activedescendant={activeDescendant}
                    aria-describedby={noticeOpen ? noticeId : undefined}
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="text-base-content/50 hover:text-base-content cursor-pointer"
                        aria-label="Clear search"
                    >
                        <IoCloseOutline className="h-4 w-4" />
                    </button>
                )}
                {loading && (
                    <span className="loading loading-spinner loading-xs text-base-content/50" />
                )}
            </div>
            {(listboxOpen || noticeOpen) && (
                <div
                    className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-lg shadow-lg z-50"
                >
                    {showSuggestions ? (
                        <SearchSuggestionList
                            listboxId={listboxId}
                            suggestions={suggestions}
                            selectedIndex={suggestionIndex}
                            optionId={optionId}
                            onAccept={acceptSuggestion}
                        />
                    ) : (
                        resultsOpen && <div id={listboxId} role="listbox">{renderGroupedResults()}</div>
                    )}
                    {noticeOpen && <SearchChatEntry id={noticeId} />}
                </div>
            )}
        </div>
    );
}
