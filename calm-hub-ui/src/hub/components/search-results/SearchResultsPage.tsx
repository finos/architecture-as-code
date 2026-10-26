import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchService } from '../../../service/search-service.js';
import { GroupedSearchResults, SearchResult } from '../../../model/search.js';
import { TYPE_LABELS, flattenResults, useSearchNavigation } from '../../../hooks/useSearchNavigation.js';
import { colors } from '../../../theme/colors.js';

interface SearchResultsPageProps {
    /** Injected for tests. */
    searchService?: SearchService;
}

/**
 * Full-page catalogue search results at `/search?q=…`, inside Hub's normal chrome.
 * Selecting a result deep-links via the shared {@link useSearchNavigation}.
 */
export function SearchResultsPage({ searchService }: SearchResultsPageProps) {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q')?.trim() ?? '';

    // Kept with its query, so a new query shows "Searching…" at once rather than the
    // previous results or a flash of "No results found".
    const [response, setResponse] = useState<{
        query: string;
        results: GroupedSearchResults | null;
        error: boolean;
    } | null>(null);
    const current = query !== '' && response?.query === query ? response : null;
    const loading = query !== '' && current === null;
    const results = current?.results ?? null;
    const error = current?.error ?? false;

    const service = useMemo(() => searchService ?? new SearchService(), [searchService]);
    const { navigateToResult } = useSearchNavigation();

    useEffect(() => {
        if (!query) return;
        let cancelled = false;
        service
            .search(query)
            .then((data) => {
                if (!cancelled) setResponse({ query, results: data, error: false });
            })
            .catch(() => {
                if (!cancelled) setResponse({ query, results: null, error: true });
            });
        return () => {
            cancelled = true;
        };
    }, [query, service]);

    const groups = results
        ? Object.entries(results).filter(([, items]) => (items as SearchResult[]).length > 0)
        : [];
    const totalCount = results ? flattenResults(results).length : 0;

    return (
        <div className="h-full overflow-auto bg-base-100" style={{ padding: '44px 48px' }}>
            <div className="max-w-[880px] mx-auto flex flex-col gap-8">
                <header>
                    <h1 className="text-[28px] font-bold" style={{ color: colors.redesign.ink }}>
                        {query ? (
                            <>
                                Results for <span style={{ color: colors.redesign.primaryText }}>“{query}”</span>
                            </>
                        ) : (
                            'Search'
                        )}
                    </h1>
                    {query && !loading && !error && (
                        <p className="text-[14px] mt-2" style={{ color: colors.redesign.muted }}>
                            {totalCount} {totalCount === 1 ? 'result' : 'results'}
                        </p>
                    )}
                </header>

                {!query && (
                    <p className="text-sm" style={{ color: colors.redesign.muted }}>
                        Enter a search term to explore the catalogue.
                    </p>
                )}

                {query && loading && (
                    <div className="flex items-center gap-2 py-4">
                        <span className="loading loading-spinner loading-sm text-base-content/40" />
                        <span className="text-sm" style={{ color: colors.redesign.muted }}>
                            Searching…
                        </span>
                    </div>
                )}

                {query && !loading && error && (
                    <div className="text-sm text-error">Search failed, please try again.</div>
                )}

                {query && !loading && !error && results !== null && groups.length === 0 && (
                    <div className="text-sm" style={{ color: colors.redesign.muted }}>
                        No results found for “{query}”.
                    </div>
                )}

                {query && !loading && !error && groups.length > 0 && (
                    <div className="flex flex-col gap-8">
                        {groups.map(([type, items]) => (
                            <section key={type}>
                                <div
                                    className="font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3"
                                    style={{ color: colors.redesign.faintAlt }}
                                >
                                    {TYPE_LABELS[type] ?? type} ({(items as SearchResult[]).length})
                                </div>
                                <div className="flex flex-col gap-2">
                                    {(items as SearchResult[]).map((item) => (
                                        <button
                                            key={`${type}-${item.namespace}-${item.id}`}
                                            className="w-full text-left rounded-xl px-4 py-3 hover:bg-base-200 transition-colors cursor-pointer"
                                            style={{ border: `1px solid ${colors.redesign.border}` }}
                                            onClick={() => navigateToResult({ type, result: item })}
                                        >
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
                                                    className="text-sm mt-1"
                                                    style={{ color: colors.redesign.muted }}
                                                >
                                                    {item.description}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
