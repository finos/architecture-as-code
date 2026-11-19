export interface SearchResult {
    namespace: string;
    id: string;
    name: string;
    description: string;
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
