import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { SearchService } from '../../service/search-service.js';
import { CalmService } from '../../service/calm-service.js';
import { AdrService } from '../../service/adr-service/adr-service.js';
import { GroupedSearchResults, SearchResult } from '../../model/search.js';

interface FlatResult {
    type: string;
    result: SearchResult;
}

const TYPE_LABELS: Record<string, string> = {
    architectures: 'Architectures',
    patterns: 'Patterns',
    standards: 'Standards',
    interfaces: 'Interfaces',
    controls: 'Controls',
    adrs: 'ADRs',
};

const TYPE_ROUTES: Record<string, string> = {
    architectures: 'architectures',
    patterns: 'patterns',
    standards: 'standards',
    interfaces: 'interfaces',
    controls: 'controls',
    adrs: 'adrs',
};

function flattenResults(grouped: GroupedSearchResults): FlatResult[] {
    const flat: FlatResult[] = [];
    for (const [type, results] of Object.entries(grouped)) {
        for (const result of results as SearchResult[]) {
            flat.push({ type, result });
        }
    }
    return flat;
}

interface GlobalSearchBarProps {
    searchService?: SearchService;
    calmService?: CalmService;
    adrService?: AdrService;
}

export function GlobalSearchBar({ searchService, calmService: calmServiceProp, adrService: adrServiceProp }: GlobalSearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GroupedSearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const service = useMemo(() => searchService ?? new SearchService(), [searchService]);
    const calmService = useMemo(() => calmServiceProp ?? new CalmService(), [calmServiceProp]);
    const adrService = useMemo(() => adrServiceProp ?? new AdrService(), [adrServiceProp]);

    const navigate = useNavigate();

    const flatResults = results ? flattenResults(results) : [];

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults(null);
            setShowDropdown(false);
            setError(false);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(false);
        try {
            const data = await service.search(searchQuery);
            if (controller.signal.aborted) return;
            setResults(data);
            setShowDropdown(true);
            setSelectedIndex(-1);
        } catch {
            if (controller.signal.aborted) return;
            setResults(null);
            setError(true);
            setShowDropdown(true);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [service]);

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setQuery(value);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => {
                performSearch(value);
            }, 300);
        },
        [performSearch]
    );

    const resolveLatestVersion = useCallback(
        async (type: string, namespace: string, id: string): Promise<string> => {
            let versions: (string | number)[];
            switch (type) {
                case 'architectures':
                    versions = await calmService.fetchArchitectureVersions(namespace, id);
                    break;
                case 'patterns':
                    versions = await calmService.fetchPatternVersions(namespace, id);
                    break;
                case 'standards':
                    versions = await calmService.fetchStandardVersions(namespace, id);
                    break;
                case 'adrs':
                    versions = await adrService.fetchAdrRevisions(namespace, id);
                    break;
                default:
                    throw new Error(`Unknown type: ${type}`);
            }
            if (!versions || versions.length === 0) throw new Error('No versions found');
            return String(versions[versions.length - 1]);
        },
        [calmService, adrService]
    );

    const navigateToResult = useCallback(
        (flatResult: FlatResult) => {
            const { type, result } = flatResult;
            setShowDropdown(false);
            setQuery('');
            setResults(null);

            if (type === 'controls') {
                navigate(`/${result.namespace}/controls/${result.id}/detail`);
                return;
            }

            if (type === 'interfaces') {
                navigate(`/${result.namespace}/interfaces/${result.id}/detail`);
                return;
            }

            const route = TYPE_ROUTES[type];
            const id = String(result.id);
            resolveLatestVersion(type, result.namespace, id)
                .then((version) => {
                    navigate(`/${result.namespace}/${route}/${id}/${version}`);
                })
                .catch(() => {
                    navigate(`/${result.namespace}/${route}`);
                });
        },
        [navigate, resolveLatestVersion]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!showDropdown || flatResults.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                navigateToResult(flatResults[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowDropdown(false);
                setSelectedIndex(-1);
            }
        },
        [showDropdown, flatResults, selectedIndex, navigateToResult]
    );

    const handleClear = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setQuery('');
        setResults(null);
        setShowDropdown(false);
        setSelectedIndex(-1);
        setError(false);
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
                setSelectedIndex(-1);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const renderGroupedResults = () => {
        if (error) {
            return <div className="p-3 text-sm text-error">Search failed, please try again</div>;
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
            <div key={type}>
                <div className="px-3 py-1 text-xs font-semibold text-base-content/50 uppercase tracking-wide bg-base-200">
                    {TYPE_LABELS[type] ?? type}
                </div>
                {(items as SearchResult[]).map((item) => {
                    const currentIndex = globalIndex++;
                    return (
                        <button
                            key={`${type}-${item.namespace}-${item.id}`}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-base-200 cursor-pointer ${
                                currentIndex === selectedIndex ? 'bg-base-200' : ''
                            }`}
                            onMouseDown={() => navigateToResult({ type, result: item })}
                            role="option"
                            aria-selected={currentIndex === selectedIndex}
                        >
                            <div className="font-medium text-base-content">{item.name}</div>
                            {item.description && (
                                <div className="text-xs text-base-content/60 truncate">
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
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search CALM Hub..."
                    className="bg-transparent border-none outline-none text-sm text-base-content placeholder:text-base-content/40 w-48 lg:w-64"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    aria-label="Search"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-haspopup="listbox"
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
            {showDropdown && (
                <div
                    className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-lg shadow-lg z-50"
                    role="listbox"
                >
                    {renderGroupedResults()}
                </div>
            )}
        </div>
    );
}
