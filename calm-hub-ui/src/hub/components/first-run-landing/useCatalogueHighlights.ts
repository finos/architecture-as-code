import { useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../../service/calm-service.js';
import { NamespaceCounts } from '../../../model/counts.js';
import { ResourceSummary } from '../../../model/calm.js';

/** Resource types surfaced in the catalogue strip. */
export type CatalogueHighlightType = 'Architectures' | 'Patterns';

export interface CatalogueHighlight {
    namespace: string;
    id: string;
    name: string;
    description?: string;
    /** Mono slug identifier, shown as meta when present. */
    customId?: string;
    /** The resource type this highlight came from — drives its card badge/colour. */
    type: CatalogueHighlightType;
}

/** Max namespaces probed for highlights — keeps the landing fetch bounded. */
const MAX_NAMESPACES = 2;
/** Max cards rendered in the "Browse the catalogue" strip. */
const MAX_HIGHLIGHTS = 3;

/** Map a namespace's summaries to typed highlights. */
function toHighlights(
    summaries: ResourceSummary[],
    namespace: string,
    type: CatalogueHighlightType
): CatalogueHighlight[] {
    return summaries.map((s) => ({
        namespace,
        id: s.customId ?? s.id.toString(),
        name: s.name,
        description: s.description,
        customId: s.customId,
        type,
    }));
}

/**
 * A small, honest sample of real catalogue items for the first-run landing.
 *
 * There is no recency API — records carry no reliable updated-timestamp we can
 * query cheaply — so this deliberately does NOT claim "recently updated". It
 * fetches architecture AND pattern summaries for the first one or two namespaces
 * that hold either (per the counts Hub already holds) and returns up to three
 * real items — each tagged with its true resource type — under a truthful
 * "Browse the catalogue" heading.
 *
 * The fetch is bounded: at most {@link MAX_NAMESPACES} namespaces are probed (two
 * summary requests each — architectures + patterns — with no N+1, no per-item
 * version resolution).
 */
export function useCatalogueHighlights(
    namespaceCounts: NamespaceCounts[],
    calmService?: CalmService
): { highlights: CatalogueHighlight[]; loading: boolean } {
    const service = useMemo(() => calmService ?? new CalmService(), [calmService]);

    // The namespaces to probe: those with at least one architecture or pattern,
    // capped. Memoised on a stable key so a fresh array identity each render
    // doesn't re-trigger the fetch.
    const targetKey = useMemo(
        () =>
            namespaceCounts
                .filter((c) => c.architectures > 0 || c.patterns > 0)
                .slice(0, MAX_NAMESPACES)
                .map((c) => c.namespace)
                .join(','),
        [namespaceCounts]
    );

    const [highlights, setHighlights] = useState<CatalogueHighlight[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const targets = targetKey ? targetKey.split(',') : [];
        if (targets.length === 0) {
            setHighlights([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        Promise.all(
            targets.map((namespace) =>
                Promise.all([
                    service
                        .fetchArchitectureSummaries(namespace)
                        .then((summaries) => toHighlights(summaries, namespace, 'Architectures'))
                        .catch(() => [] as CatalogueHighlight[]),
                    service
                        .fetchPatternSummaries(namespace)
                        .then((summaries) => toHighlights(summaries, namespace, 'Patterns'))
                        .catch(() => [] as CatalogueHighlight[]),
                ]).then(([architectures, patterns]) => [...architectures, ...patterns])
            )
        ).then((perNamespace) => {
            if (cancelled) return;
            setHighlights(perNamespace.flat().slice(0, MAX_HIGHLIGHTS));
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [targetKey, service]);

    return { highlights, loading };
}
