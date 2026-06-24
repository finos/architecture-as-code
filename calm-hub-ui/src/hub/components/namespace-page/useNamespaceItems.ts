import { useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../../service/calm-service.js';
import { InterfaceService } from '../../../service/interface-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { ResourceSummary } from '../../../model/calm.js';
import { type TypeInUI } from '../tree-navigation/navigation-loaders.js';

export interface NamespaceItem {
    id: string;
    name: string;
}

export interface NamespaceItemGroup {
    type: TypeInUI;
    items: NamespaceItem[];
}

const summaryToItem = (s: ResourceSummary): NamespaceItem => ({
    id: s.customId ?? s.id.toString(),
    name: s.name,
});

/**
 * Loads every resource type's items for a namespace and returns them grouped by
 * type, in display order. Reuses the existing summary services. This backs the
 * Phase-1 placeholder namespace body (a grouped list); Phase 2 replaces the body
 * with a card grid + segmented tabs but can keep this data source.
 */
export function useNamespaceItems(namespace: string): { groups: NamespaceItemGroup[]; loading: boolean } {
    const calmService = useMemo(() => new CalmService(), []);
    const interfaceService = useMemo(() => new InterfaceService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    const [groups, setGroups] = useState<NamespaceItemGroup[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setGroups([]);

        Promise.all([
            calmService.fetchArchitectureSummaries(namespace).catch(() => []),
            calmService.fetchPatternSummaries(namespace).catch(() => []),
            calmService.fetchFlowSummaries(namespace).catch(() => []),
            calmService.fetchStandardSummaries(namespace).catch(() => []),
            adrService.fetchAdrSummaries(namespace).catch(() => []),
            interfaceService.fetchInterfacesForNamespace(namespace).catch(() => []),
        ]).then(([architectures, patterns, flows, standards, adrs, interfaces]) => {
            if (cancelled) return;
            setGroups([
                { type: 'Architectures', items: architectures.map(summaryToItem) },
                { type: 'Patterns', items: patterns.map(summaryToItem) },
                { type: 'Flows', items: flows.map(summaryToItem) },
                { type: 'Standards', items: standards.map(summaryToItem) },
                {
                    type: 'ADRs',
                    items: adrs.map((a) => ({ id: a.id.toString(), name: `${a.title} (${a.status})` })),
                },
                {
                    type: 'Interfaces',
                    items: interfaces.map((i) => ({ id: i.id.toString(), name: i.name })),
                },
            ]);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [namespace, calmService, interfaceService, adrService]);

    return { groups, loading };
}
