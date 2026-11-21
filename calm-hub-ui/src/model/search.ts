import type { Destination } from './extensions.js';

/** Optional GitHub identity parts used to disambiguate resources with the same stem. */
export interface ResourceTags {
    path?: string;
    variant?: string;
}

export interface SearchResult {
    namespace: string;
    id: string;
    name: string;
    description: string;
    tags?: ResourceTags;
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
