import { useEffect, useId, useRef } from 'react';
import { ExtensionLogo } from '../../../extensions/ExtensionLogo.js';
import type { ExtensionContribution, ExtensionSummary } from '../../../model/extensions.js';
import { colors } from '../../../theme/colors.js';
import { ProviderResultItem } from './ProviderResultItem.js';
import { useProviderSearch } from './useProviderSearch.js';

interface ProviderResultsProps {
    extension: ExtensionSummary;
    provider: ExtensionContribution;
    query: string;
}

/**
 * The results of one search provider, in its own group with its own state. The count is the number of results shown:
 * Hub left out the results that the caller cannot read, and the provider sends no total.
 */
export function ProviderResults({ extension, provider, query }: ProviderResultsProps) {
    const { search, loadMore, retry } = useProviderSearch(extension.id, provider.id, query);
    const headingId = useId();
    const name = extension.name || extension.id;
    const heading = useRef<HTMLHeadingElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const moreButton = useRef<HTMLButtonElement>(null);
    // The index of the first result of the page that the user asked for, until it arrives.
    const firstNew = useRef<number | null>(null);

    // The Try again and Show more buttons can disappear, so move the focus into the group instead of losing it.
    useEffect(() => {
        if (firstNew.current === null) return;
        if (search.status !== 'loaded') {
            firstNew.current = null;
            return;
        }
        if (search.more === 'loading') return;
        const index = firstNew.current;
        firstNew.current = null;
        const focused = document.activeElement;
        if (search.more === 'failed' || (focused !== document.body && focused !== moreButton.current)) return;
        (list.current?.children[index]?.querySelector('a') ?? heading.current)?.focus();
    }, [search]);

    const tryAgain = () => {
        heading.current?.focus();
        retry();
    };
    const showMore = () => {
        if (search.status === 'loaded') firstNew.current = search.results.length;
        loadMore();
    };

    return (
        <section aria-labelledby={headingId} data-testid="provider-results">
            <h2
                id={headingId}
                ref={heading}
                tabIndex={-1}
                className="flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.1em] mb-3"
                style={{ color: colors.redesign.faintAlt }}
            >
                <ExtensionLogo extension={extension} size={20} />
                <span className="min-w-0 wrap-anywhere">
                    {provider.title}
                    {search.status === 'loaded' && search.results.length > 0 && ` (${search.results.length}${search.hasMore ? '+' : ''})`}
                    {` · ${name}`}
                </span>
            </h2>

            {search.status === 'loading' && (
                <div role="status" className="flex items-center gap-2 py-2">
                    <span className="loading loading-spinner loading-sm text-base-content/40" aria-hidden="true" />
                    <span className="text-sm" style={{ color: colors.redesign.muted }}>
                        Searching {name}…
                    </span>
                </div>
            )}

            {search.status === 'failed' && (
                <div role="alert" className="alert alert-error alert-soft flex flex-wrap items-center gap-3">
                    <span className="min-w-0">
                        {search.timedOut ? `${name} did not reply in time.` : `${name} search failed.`} Results from other sources are still
                        shown.
                    </span>
                    <button type="button" className="btn btn-sm btn-ghost ml-auto" onClick={tryAgain}>
                        Try again
                    </button>
                </div>
            )}

            {search.status === 'loaded' && search.results.length === 0 && (
                <p className="text-sm" style={{ color: colors.redesign.muted }}>
                    No results from {name}.
                </p>
            )}

            {search.status === 'loaded' && search.results.length > 0 && (
                <ul ref={list} className="flex flex-col gap-2">
                    {search.results.map((result) => (
                        <ProviderResultItem key={result.id} result={result} extension={extension} />
                    ))}
                </ul>
            )}

            {search.status === 'loaded' && (search.hasMore || search.more === 'failed') && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button
                        ref={moreButton}
                        type="button"
                        className="btn btn-sm btn-outline rounded-xl"
                        aria-disabled={search.more === 'loading'}
                        onClick={showMore}
                    >
                        {search.more === 'loading' ? 'Loading…' : `Show more from ${provider.title}`}
                    </button>
                    {search.more === 'failed' && (
                        <span role="alert" className="text-sm text-error">
                            More results could not be loaded.
                        </span>
                    )}
                </div>
            )}
        </section>
    );
}
