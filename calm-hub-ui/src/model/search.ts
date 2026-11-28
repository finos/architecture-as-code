import type { Destination } from './extensions.js';

/** Optional GitHub identity parts used to disambiguate resources with the same stem. */
export interface ResourceTags {
    path?: string;
    variant?: string;
}

/**
 * Query string that pins a resource's GitHub identity. An absent tag is sent as an empty value:
 * a missing parameter means "any" on the backend, while an empty one means "none". Omitting it
 * would match every file that shares the id.
 */
export function resourceIdentityQuery(tags?: ResourceTags): string {
    const params = new URLSearchParams();
    params.set('path', tags?.path ?? '');
    params.set('variant', tags?.variant ?? '');
    return params.toString();
}

export interface SearchResult {
    namespace: string;
    id: string;
    name: string;
    description: string;
    tags?: ResourceTags;
}

/** Stable React key for a search result, including its GitHub identity. */
export function searchResultKey(type: string, result: SearchResult): string {
    return `${type}-${result.namespace}-${result.id}-${result.tags?.path ?? ''}-${result.tags?.variant ?? ''}`;
}

export interface GroupedSearchResults {
    architectures: SearchResult[];
    patterns: SearchResult[];
    flows: SearchResult[];
    standards: SearchResult[];
    interfaces: SearchResult[];
    controls: SearchResult[];
    adrs: SearchResult[];
}

/**
 * One result from an extension search provider. Hub checked it and left out each result that names a namespace the
 * caller cannot read. The title is the text of the link.
 */
export interface ExtensionSearchResult {
    id: string;
    title: string;
    summary?: string;
    namespace?: string;
    link?: Destination;
}

/** One page from a search provider. `next` is the cursor of the next page. */
export interface ExtensionSearchPage {
    results: ExtensionSearchResult[];
    next?: string;
}
