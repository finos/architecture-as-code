import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalmService } from '../service/calm-service.js';
import { AdrService } from '../service/adr-service/adr-service.js';
import { GroupedSearchResults, SearchResult } from '../model/search.js';
import { pickLatestVersion } from '../model/version.js';
import { useLinkState } from '../navigation/returnPoints.js';
import { useOptionalChatSession } from '../extensions/chat/ChatSessionContext.js';

export interface FlatResult {
    type: string;
    result: SearchResult;
}

/** Human-readable group headings, keyed by the {@link GroupedSearchResults} key. */
export const TYPE_LABELS: Record<string, string> = {
    architectures: 'Architectures',
    patterns: 'Patterns',
    flows: 'Flows',
    standards: 'Standards',
    interfaces: 'Interfaces',
    controls: 'Controls',
    adrs: 'ADRs',
};

export const TYPE_ROUTES: Record<string, string> = {
    architectures: 'architectures',
    patterns: 'patterns',
    flows: 'flows',
    standards: 'standards',
    interfaces: 'interfaces',
    controls: 'controls',
    adrs: 'adrs',
};

export function flattenResults(grouped: GroupedSearchResults): FlatResult[] {
    const flat: FlatResult[] = [];
    for (const [type, results] of Object.entries(grouped)) {
        for (const result of results as SearchResult[]) {
            flat.push({ type, result });
        }
    }
    return flat;
}

interface UseSearchNavigationOptions {
    /** Injected for tests. */
    calmService?: CalmService;
    /** Injected for tests. */
    adrService?: AdrService;
}

/**
 * Shared navigation for catalogue search results, so every search surface deep-links
 * identically. Controls and interfaces route by name/id directly; every other type
 * needs its latest version resolved first (an extra fetch), falling back to the
 * type's namespace listing route if that lookup fails.
 */
export function useSearchNavigation({ calmService: calmServiceProp, adrService: adrServiceProp }: UseSearchNavigationOptions = {}) {
    const navigate = useNavigate();
    const startSearch = useOptionalChatSession()?.startSearch;
    const submitSearch = useCallback(
        (query: string) => {
            const text = query.trim();
            if (!text) return;
            // Explicit submission starts afresh even when the query equals the last search.
            startSearch?.(text);
            navigate({ pathname: '/search', search: `?q=${encodeURIComponent(text)}` });
        },
        [startSearch, navigate]
    );
    // On a page with a return point, such as the search results, the opened page links back to it.
    const state = useLinkState();
    const calmService = useMemo(() => calmServiceProp ?? new CalmService(), [calmServiceProp]);
    const adrService = useMemo(() => adrServiceProp ?? new AdrService(), [adrServiceProp]);

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
                case 'flows':
                    versions = await calmService.fetchFlowVersions(namespace, id);
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
            const latest = pickLatestVersion((versions ?? []).map(String));
            if (!latest) throw new Error('No versions found');
            return latest;
        },
        [calmService, adrService]
    );

    const navigateToResult = useCallback(
        (flatResult: FlatResult) => {
            const { type, result } = flatResult;
            const ns = encodeURIComponent(result.namespace);

            if (type === 'controls') {
                navigate(`/${ns}/controls/${encodeURIComponent(result.name)}/detail`, { state });
                return;
            }

            if (type === 'interfaces') {
                navigate(`/${ns}/interfaces/${encodeURIComponent(String(result.id))}/detail`, { state });
                return;
            }

            const route = TYPE_ROUTES[type];
            const id = String(result.id);
            resolveLatestVersion(type, result.namespace, id)
                .then((version) => {
                    navigate(`/${ns}/${route}/${encodeURIComponent(id)}/${encodeURIComponent(version)}`, { state });
                })
                .catch(() => {
                    navigate(`/${ns}/${route}`, { state });
                });
        },
        [navigate, resolveLatestVersion, state]
    );

    return { navigateToResult, submitSearch };
}
