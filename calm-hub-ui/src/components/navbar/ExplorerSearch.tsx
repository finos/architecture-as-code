import { useEffect, useCallback, useId, useMemo, useRef } from 'react';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { SearchService } from '../../service/search-service.js';
import { CalmService } from '../../service/calm-service.js';
import { AdrService } from '../../service/adr-service/adr-service.js';
import { SearchResult } from '../../model/search.js';
import { FlatResult, TYPE_LABELS, useSearchNavigation } from '../../hooks/useSearchNavigation.js';
import { useCatalogueSearch } from '../../hooks/useCatalogueSearch.js';

interface ExplorerSearchProps {
    searchService?: SearchService;
    calmService?: CalmService;
    adrService?: AdrService;
    /** Notifies the parent explorer when a search is active so it can hide its nav. */
    onSearchingChange?: (active: boolean) => void;
}

/**
 * Always-visible search bar for the explorer. While a query is present the
 * results render inline and take over the explorer body (the parent hides its
 * tree / drill-down). Selecting a result navigates to the resource.
 */
export function ExplorerSearch({
    searchService,
    calmService: calmServiceProp,
    adrService: adrServiceProp,
    onSearchingChange,
}: ExplorerSearchProps) {
    const {
        query,
        results,
        loading,
        error,
        selectedIndex,
        flatResults,
        handleInputChange,
        moveSelection,
        clear,
    } = useCatalogueSearch(searchService);

    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const calmService = useMemo(() => calmServiceProp ?? new CalmService(), [calmServiceProp]);
    const adrService = useMemo(() => adrServiceProp ?? new AdrService(), [adrServiceProp]);
    const { navigateToResult: goToResult } = useSearchNavigation({ calmService, adrService });

    // Results render inline while a query is present, so this keys off the query
    // rather than the hook's `open` (dropdown) flag.
    const active = query.trim().length > 0;
    const optionId = (index: number) => `${listboxId}-option-${index}`;
    const activeDescendant = active && flatResults[selectedIndex] ? optionId(selectedIndex) : undefined;

    useEffect(() => {
        onSearchingChange?.(active);
    }, [active, onSearchingChange]);

    const navigateToResult = useCallback(
        (flatResult: FlatResult) => {
            clear();
            goToResult(flatResult);
        },
        [clear, goToResult]
    );

    const handleClear = useCallback(() => {
        clear();
        inputRef.current?.focus();
    }, [clear]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!active || flatResults.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSelection(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSelection(-1);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                navigateToResult(flatResults[selectedIndex]);
            } else if (e.key === 'Escape') {
                handleClear();
            }
        },
        [active, flatResults, selectedIndex, moveSelection, navigateToResult, handleClear]
    );

    const renderGroupedResults = () => {
        if (error) {
            return <div className="p-3 text-sm text-error">Search failed, please try again</div>;
        }

        if (!results) return null;

        const groups = Object.entries(results).filter(([, items]) => (items as SearchResult[]).length > 0);

        if (groups.length === 0) {
            return <div className="p-3 text-sm text-base-content/60">No results found</div>;
        }

        let globalIndex = 0;

        return groups.map(([type, items]) => (
            <div key={type} role="group" aria-labelledby={`${listboxId}-group-${type}`}>
                <div
                    id={`${listboxId}-group-${type}`}
                    className="px-3 py-1 text-xs font-semibold text-base-content/50 uppercase tracking-wide bg-base-200"
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
                            <div className="font-medium text-base-content">{item.name}</div>
                            {item.description && (
                                <div className="text-xs text-base-content/60 truncate">{item.description}</div>
                            )}
                        </button>
                    );
                })}
            </div>
        ));
    };

    return (
        <>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-100">
                <IoSearchOutline className="text-base-content/50 h-4 w-4 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search CALM Hub..."
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-base-content placeholder:text-base-content/40"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    aria-label="Search"
                    role="combobox"
                    aria-expanded={active}
                    aria-haspopup="listbox"
                    aria-controls={active ? listboxId : undefined}
                    aria-activedescendant={activeDescendant}
                />
                {loading && <span className="loading loading-spinner loading-xs text-base-content/50" />}
                {query && (
                    <button
                        onClick={handleClear}
                        className="text-base-content/50 hover:text-base-content cursor-pointer"
                        aria-label="Clear search"
                    >
                        <IoCloseOutline className="h-4 w-4" />
                    </button>
                )}
            </div>
            {active && (
                <div id={listboxId} className="flex-1 min-h-0 overflow-y-auto" role="listbox">
                    {renderGroupedResults()}
                </div>
            )}
        </>
    );
}
