import { useCallback, useMemo, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoCompassOutline, IoCloseOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { CalmService } from '../../../service/calm-service.js';
import { ControlService } from '../../../service/control-service.js';
import { InterfaceService } from '../../../service/interface-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { ResourceSummary } from '../../../model/calm.js';
import { pickLatestVersion } from '../../../model/version.js';
import { ControlDetail } from '../../../model/control.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from '../explore-rail/CountBadge.js';
import {
    type TypeInUI,
    mapTypeInUIToTypeInUrl,
    fetchVersionsForResource,
} from './navigation-loaders.js';
import { ExplorerSearch } from '../../../components/navbar/ExplorerSearch.js';

const RESOURCE_TYPES: TypeInUI[] = ['Architectures', 'Patterns', 'Flows', 'Standards', 'ADRs', 'Interfaces'];

interface MobileNavMenuProps {
    /** Per-namespace counts, fetched once by {@link Hub} and passed down. */
    namespaceCounts: NamespaceCounts[];
    /** Per-domain control counts, fetched once by {@link Hub} and passed down. */
    domainCounts: DomainControlCount[];
    /** Dismiss the menu (e.g. after a resource is chosen). */
    onClose: () => void;
}

type HubParams = {
    /** From the item-detail route `/:namespace/...`. */
    namespace: string;
    /** From the namespace browse route `/namespace/:ns`. */
    ns: string;
    /** From the domain route `/domain/:domain`. */
    domain: string;
};

/** A single level in the drill-down stack. */
type View =
    | { level: 'root' }
    | { level: 'namespaces' }
    | { level: 'types'; namespace: string }
    | { level: 'resources'; namespace: string; type: TypeInUI }
    | { level: 'domains' }
    | { level: 'controls'; domain: string };

interface LeafItem {
    id: string;
    name: string;
}

/**
 * Mobile navigation as an iOS-style drill-down: each tap pushes the next level
 * as a flat list rather than expanding an inline tree. Leaf taps navigate to the
 * resource URL; deep-link loading is owned by {@link Hub}'s `useResourceFromRoute`
 * (a single shared owner), so this panel only drives navigation and its own
 * drill-down list state.
 *
 * Phase 1 adds a mono count badge per namespace/domain row and a brand-tint
 * active treatment for the row matching the current URL. Counts are owned by
 * {@link Hub} (fetched once and shared) and passed in as props rather than
 * re-fetched here.
 */
export function MobileNavMenu({ namespaceCounts, domainCounts, onClose }: MobileNavMenuProps) {
    const navigate = useNavigate();
    const params = useParams<HubParams>();

    const calmService = useMemo(() => new CalmService(), []);
    const controlService = useMemo(() => new ControlService(), []);
    const interfaceService = useMemo(() => new InterfaceService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    const [view, setView] = useState<View>({ level: 'root' });
    const [leafItems, setLeafItems] = useState<LeafItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Derive the namespace/domain lists from the counts Hub already fetched, rather than
    // re-fetching them here. Avoids two redundant requests and keeps the row labels in the
    // same snapshot as the count badges.
    const namespaces = useMemo(() => namespaceCounts.map((c) => c.namespace), [namespaceCounts]);
    const domains = useMemo(() => domainCounts.map((c) => c.domain), [domainCounts]);

    const namespaceTotal = useCallback(
        (ns: string) => namespaceCounts.find((c) => c.namespace === ns)?.total,
        [namespaceCounts]
    );
    const domainControlCount = useCallback(
        (d: string) => domainCounts.find((c) => c.domain === d)?.controlCount,
        [domainCounts]
    );
    // Per-type count for a namespace's resource-type drill-down level, mirroring
    // the desktop namespace page's segmented type tabs.
    const typeCount = useCallback(
        (namespace: string, type: TypeInUI): number | undefined => {
            const c = namespaceCounts.find((nc) => nc.namespace === namespace);
            if (!c) return undefined;
            switch (type) {
                case 'Architectures':
                    return c.architectures;
                case 'Patterns':
                    return c.patterns;
                case 'Flows':
                    return c.flows;
                case 'Standards':
                    return c.standards;
                case 'ADRs':
                    return c.adrs;
                case 'Interfaces':
                    return c.interfaces;
                default:
                    return undefined;
            }
        },
        [namespaceCounts]
    );

    const openType = useCallback(
        (namespace: string, type: TypeInUI) => {
            setView({ level: 'resources', namespace, type });
            setLeafItems([]);
            setLoading(true);
            const finish = (items: LeafItem[]) => {
                setLeafItems(items);
                setLoading(false);
            };
            if (type === 'Interfaces') {
                interfaceService
                    .fetchInterfacesForNamespace(namespace)
                    .then((ifaces) => finish(ifaces.map((i) => ({ id: i.id.toString(), name: i.name }))))
                    .catch(() => finish([]));
            } else if (type === 'ADRs') {
                adrService
                    .fetchAdrSummaries(namespace)
                    .then((adrs) => finish(adrs.map((a) => ({ id: a.id.toString(), name: `${a.title} (${a.status})` }))))
                    .catch(() => finish([]));
            } else {
                const fetcher =
                    type === 'Architectures'
                        ? calmService.fetchArchitectureSummaries.bind(calmService)
                        : type === 'Patterns'
                          ? calmService.fetchPatternSummaries.bind(calmService)
                          : type === 'Flows'
                            ? calmService.fetchFlowSummaries.bind(calmService)
                            : calmService.fetchStandardSummaries.bind(calmService);
                fetcher(namespace)
                    .then((sums: ResourceSummary[]) =>
                        finish(sums.map((s) => ({ id: s.customId ?? s.id.toString(), name: s.name })))
                    )
                    .catch(() => finish([]));
            }
        },
        [calmService, interfaceService, adrService]
    );

    const openDomain = useCallback(
        (domain: string) => {
            setView({ level: 'controls', domain });
            setLeafItems([]);
            setLoading(true);
            controlService
                .fetchControlsForDomain(domain)
                .then((controls: ControlDetail[]) =>
                    setLeafItems(controls.map((c) => ({ id: c.id.toString(), name: c.title ?? c.name })))
                )
                .catch(() => setLeafItems([]))
                .finally(() => setLoading(false));
        },
        [controlService]
    );

    const selectResource = useCallback(
        async (id: string, type: TypeInUI, namespace: string) => {
            if (type === 'Interfaces') {
                navigate(`/${namespace}/interfaces/${id}/detail`);
                onClose();
                return;
            }
            const versions = await fetchVersionsForResource(id, type, namespace, calmService, adrService);
            const latest = pickLatestVersion(versions);
            if (!latest) {
                // arg1 is %s to prevent format string injection from `id`.
                console.warn('No versions found for resource %s; nothing to load', id);
                return;
            }
            navigate(`/${namespace}/${mapTypeInUIToTypeInUrl(type)}/${id}/${latest}`);
            onClose();
        },
        [navigate, calmService, adrService, onClose]
    );

    const selectControl = useCallback(
        (id: string, domain: string) => {
            navigate(`/${domain}/controls/${id}/detail`);
            onClose();
        },
        [navigate, onClose]
    );

    const goBack = useCallback(() => {
        setView((current) => {
            switch (current.level) {
                case 'namespaces':
                case 'domains':
                    return { level: 'root' };
                case 'types':
                    return { level: 'namespaces' };
                case 'resources':
                    return { level: 'types', namespace: current.namespace };
                case 'controls':
                    return { level: 'domains' };
                default:
                    return current;
            }
        });
    }, []);

    const title =
        view.level === 'root'
            ? 'Explore'
            : view.level === 'namespaces'
              ? 'Namespaces'
              : view.level === 'types'
                ? view.namespace
                : view.level === 'resources'
                  ? view.type
                  : view.level === 'domains'
                    ? 'Control Domains'
                    : view.domain;

    interface Row {
        key: string;
        label: string;
        isLeaf: boolean;
        onClick: () => void;
        count?: number;
        /** Dim a zero count (empty, not broken) — mirrors the desktop type tabs. */
        dimmed?: boolean;
        active?: boolean;
    }

    const rows: Row[] = (() => {
        switch (view.level) {
            case 'root':
                return [
                    { key: 'namespaces', label: 'Namespaces', isLeaf: false, onClick: () => setView({ level: 'namespaces' }) },
                    { key: 'domains', label: 'Control Domains', isLeaf: false, onClick: () => setView({ level: 'domains' }) },
                ];
            case 'namespaces':
                return namespaces.map((ns) => ({
                    key: ns,
                    label: ns,
                    isLeaf: false,
                    count: namespaceTotal(ns),
                    active: ns === params.ns || ns === params.namespace,
                    onClick: () => setView({ level: 'types', namespace: ns }),
                }));
            case 'types':
                return RESOURCE_TYPES.map((t) => {
                    const count = typeCount(view.namespace, t);
                    return {
                        key: t,
                        label: t,
                        isLeaf: false,
                        count,
                        dimmed: count === 0,
                        onClick: () => openType(view.namespace, t),
                    };
                });
            case 'resources':
                return leafItems.map((item) => ({
                    key: item.id,
                    label: item.name,
                    isLeaf: true,
                    onClick: () => selectResource(item.id, view.type, view.namespace),
                }));
            case 'domains':
                return domains.map((d) => ({
                    key: d,
                    label: d,
                    isLeaf: false,
                    count: domainControlCount(d),
                    active: d === params.domain,
                    onClick: () => openDomain(d),
                }));
            case 'controls':
                return leafItems.map((item) => ({
                    key: item.id,
                    label: item.name,
                    isLeaf: true,
                    onClick: () => selectControl(item.id, view.domain),
                }));
            default:
                return [];
        }
    })();

    const isEmpty = !loading && rows.length === 0;

    return (
        <div className="h-full w-full flex flex-col">
            <div className="bg-base-200 px-3 py-3 border-b border-base-300 flex items-center gap-2">
                {view.level !== 'root' ? (
                    <button aria-label="Back" className="btn btn-ghost btn-sm btn-circle" onClick={goBack}>
                        <IoChevronBackOutline size={20} />
                    </button>
                ) : (
                    <IoCompassOutline className="text-accent ml-2" size={20} />
                )}
                <h2 className="text-lg font-semibold flex-1 min-w-0 truncate">{title}</h2>
                <button aria-label="Close navigation" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                    <IoCloseOutline size={22} />
                </button>
            </div>

            <ExplorerSearch onSearchingChange={setSearching} />

            {!searching && (
                <ul className="flex-1 overflow-auto divide-y divide-base-200">
                    {loading && (
                        <li className="flex items-center justify-center py-8">
                            <span className="loading loading-spinner loading-md text-base-content/50" />
                        </li>
                    )}
                    {isEmpty && (
                        <li className="px-4 py-8 text-center text-base-content/50 text-sm">Nothing here</li>
                    )}
                    {!loading &&
                        rows.map((row) => (
                            <li key={row.key}>
                                <button
                                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-base-200 active:bg-base-200"
                                    style={
                                        row.active
                                            ? {
                                                  backgroundColor: colors.redesign.tintBg,
                                                  boxShadow: redesignTokens.shadow.railAccent,
                                              }
                                            : undefined
                                    }
                                    onClick={row.onClick}
                                >
                                    <span
                                        className={`flex-1 min-w-0 truncate ${row.active ? 'font-semibold' : ''}`}
                                        style={row.active ? { color: colors.redesign.activeText } : undefined}
                                    >
                                        {row.label}
                                    </span>
                                    {row.count !== undefined && (
                                        <CountBadge count={row.count} active={row.active} dimmed={row.dimmed} />
                                    )}
                                    {!row.isLeaf && (
                                        <IoChevronForwardOutline className="text-base-content/40 shrink-0" size={18} />
                                    )}
                                </button>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}
