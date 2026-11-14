import { useEffect, useMemo, useState } from 'react';
import { defaultC4Mapping, resolveC4Mapping, type ResolvedC4Mapping } from '@finos/calm-models/c4';
import { C4MappingService, type NamespaceC4Mapping } from '../../../../service/c4-mapping-service.js';

export interface NamespaceC4MappingState {
    /** Undefined when the namespace's mapping did not resolve. The C4 standard forbids the default in its place. */
    mapping?: ResolvedC4Mapping;
    /** Where the mapping comes from. Undefined while it loads and when the built-in default applies. */
    source?: Omit<NamespaceC4Mapping, 'config'>;
    /** Set when the namespace's mapping, or a mapping that it extends, did not load or is not valid. */
    error?: string;
    loading: boolean;
}

const DEFAULT_MAPPING = defaultC4Mapping();

/** The C4 mapping of a namespace: its `c4-mapping` default, else the built-in default of the C4 standard. */
export function useNamespaceC4Mapping(namespace: string, service?: C4MappingService): NamespaceC4MappingState {
    const mappingService = useMemo(() => service ?? new C4MappingService(), [service]);
    const [loaded, setLoaded] = useState<{ namespace: string; state: NamespaceC4MappingState }>();

    useEffect(() => {
        let cancelled = false;
        const done = (state: Omit<NamespaceC4MappingState, 'loading'>) => {
            if (!cancelled) setLoaded({ namespace, state: { ...state, loading: false } });
        };
        mappingService
            .fetchDefaultMapping(namespace)
            .then(async (found) => {
                if (!found) return done({ mapping: DEFAULT_MAPPING });
                const { config, ...source } = found;
                const mapping = await resolveC4Mapping(config, (url) => mappingService.fetchMappingAt(url));
                done({ mapping, source });
            })
            .catch((error: Error) => done({ error: error.message }));
        return () => {
            cancelled = true;
        };
    }, [namespace, mappingService]);

    return loaded?.namespace === namespace ? loaded.state : { mapping: DEFAULT_MAPPING, loading: true };
}
