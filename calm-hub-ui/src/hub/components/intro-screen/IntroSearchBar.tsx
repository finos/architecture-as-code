import { useCallback, useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { SearchService } from '../../../service/search-service.js';
import { SearchResult } from '../../../model/search.js';
import { FlatResult, TYPE_LABELS, useSearchNavigation } from '../../../hooks/useSearchNavigation.js';
import { useCatalogueSearch } from '../../../hooks/useCatalogueSearch.js';
import { colors } from '../../../theme/colors.js';

interface IntroSearchBarProps {
    /** Injected for tests; defaults to a fresh {@link SearchService}. */
    searchService?: SearchService;
}

/**
 * The intro screen's large search entry point. A live dropdown deep-links a chosen
 * match; submitting the query (Enter with nothing highlighted, or the Search button)
 * goes to the full `/search` results page.
 */
export function IntroSearchBar({ searchService }: IntroSearchBarProps) {
    const {
        query,
        results,
        loading,
        error,
        open,
        selectedIndex,
        flatResults,
        handleInputChange,
        moveSelection,
        clear,
        closeDropdown,
    } = useCatalogueSearch(searchService);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();
    const optionId = (index: number) => `${listboxId}-option-${index}`;
    const activeDescendant = open && flatResults[selectedIndex] ? optionId(selectedIndex) : undefined;
    const { navigateToResult: goToResult } = useSearchNavigation();
    const navigate = useNavigate();

    const handleClear = useCallback(() => {
        clear();
        inputRef.current?.focus();
    }, [clear]);

    const navigateToResult = useCallback(
        (flatResult: FlatResult) => {
            clear();
            goToResult(flatResult);
        },
        [clear, goToResult]
    );

    // `clear` also cancels the pending debounce, so no stray fetch fires after nav.
    const submitQuery = useCallback(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        clear();
        navigate({ pathname: '/search', search: `?q=${encodeURIComponent(trimmed)}` });
    }, [query, clear, navigate]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                if (!open || flatResults.length === 0) return;
                e.preventDefault();
                moveSelection(1);
            } else if (e.key === 'ArrowUp') {
                if (!open || flatResults.length === 0) return;
                e.preventDefault();
                moveSelection(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (open && selectedIndex >= 0 && flatResults[selectedIndex]) {
                    navigateToResult(flatResults[selectedIndex]);
                } else {
                    submitQuery();
                }
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        },
        [open, flatResults, selectedIndex, moveSelection, navigateToResult, submitQuery, closeDropdown]
    );

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                closeDropdown();
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [closeDropdown]);

    const renderGroupedResults = () => {
        if (error) {
            return <div className="p-4 text-sm text-error">Search failed, please try again</div>;
        }

        if (!results) return null;

        const groups = Object.entries(results).filter(([, items]) => (items as SearchResult[]).length > 0);

        if (groups.length === 0) {
            return <div className="p-4 text-sm text-base-content/60">No results found</div>;
        }

        let globalIndex = 0;

        return groups.map(([type, items]) => (
            <div key={type} role="group" aria-labelledby={`${listboxId}-group-${type}`}>
                <div
                    id={`${listboxId}-group-${type}`}
                    className="px-4 py-1.5 font-mono-jb text-[10px] uppercase tracking-[0.1em]"
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
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-base-200 cursor-pointer ${
                                currentIndex === selectedIndex ? 'bg-base-200' : ''
                            }`}
                            onMouseDown={() => navigateToResult({ type, result: item })}
                            role="option"
                            aria-selected={currentIndex === selectedIndex}
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-medium truncate min-w-0" style={{ color: colors.redesign.ink }}>
                                    {item.name}
                                </span>
                                <span
                                    data-testid="result-namespace-chip"
                                    className="ml-auto shrink-0 font-mono-jb text-[10px] rounded-[6px] px-1.5 py-0.5"
                                    style={{ backgroundColor: colors.redesign.badgeBg, color: colors.redesign.mutedAlt }}
                                >
                                    {item.namespace}
                                </span>
                            </div>
                            {item.description && (
                                <div className="text-xs truncate mt-0.5" style={{ color: colors.redesign.mutedAlt }}>
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
        <div ref={containerRef} className="relative w-full max-w-[640px]">
            <div
                className="flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-sm focus-within:shadow-md transition-shadow"
                style={{ backgroundColor: colors.redesign.surface, border: `1px solid ${colors.redesign.border}` }}
            >
                <IoSearchOutline className="h-5 w-5 shrink-0" style={{ color: colors.redesign.muted }} />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search the architecture catalogue…"
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-base text-base-content placeholder:text-base-content/40"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    aria-label="Search the architecture catalogue"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-controls={open ? listboxId : undefined}
                    aria-activedescendant={activeDescendant}
                    autoFocus
                />
                {loading && <span className="loading loading-spinner loading-sm text-base-content/50" />}
                {query && (
                    <button
                        onClick={handleClear}
                        className="text-base-content/50 hover:text-base-content cursor-pointer"
                        aria-label="Clear search"
                    >
                        <IoCloseOutline className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={submitQuery}
                    disabled={!query.trim()}
                    className="btn btn-primary btn-sm rounded-xl px-4 disabled:opacity-50"
                    aria-label="Search"
                >
                    Search
                </button>
            </div>
            {open && (
                <div
                    id={listboxId}
                    className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-xl shadow-lg z-50"
                    role="listbox"
                >
                    {renderGroupedResults()}
                </div>
            )}
        </div>
    );
}
