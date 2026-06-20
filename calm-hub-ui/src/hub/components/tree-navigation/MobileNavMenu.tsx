import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoCompassOutline, IoCloseOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { CalmService } from '../../../service/calm-service.js';
import { ControlService } from '../../../service/control-service.js';
import { InterfaceService } from '../../../service/interface-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { Data, Adr, ResourceSummary, isSlug } from '../../../model/calm.js';
import { pickLatestVersion } from '../../../model/version.js';
import { ControlData, ControlDetail } from '../../../model/control.js';
import { InterfaceData } from '../../../model/interface.js';
import {
    type TypeInUrl,
    type TypeInUI,
    mapTypeInUrlToTypeInUI,
    mapTypeInUIToTypeInUrl,
    loadResource,
    loadResourceForId,
    fetchVersionsForResource,
} from './navigation-loaders.js';

const RESOURCE_TYPES: TypeInUI[] = ['Architectures', 'Patterns', 'Flows', 'Standards', 'ADRs', 'Interfaces'];

interface MobileNavMenuProps {
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    onControlLoad: (control: ControlData) => void;
    onInterfaceLoad: (iface: InterfaceData) => void;
    /** Dismiss the menu (e.g. after a resource is chosen). */
    onClose: () => void;
}

type HubParams = {
    namespace: string;
    type: TypeInUrl;
    id: string;
    version: string;
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
 * resource URL; the deep-link effect (below) loads whatever the URL points at,
 * mirroring the desktop {@link TreeNavigation} loading behaviour.
 */
export function MobileNavMenu({ onDataLoad, onAdrLoad, onControlLoad, onInterfaceLoad, onClose }: MobileNavMenuProps) {
    const navigate = useNavigate();
    const params = useParams<HubParams>();

    const calmService = useMemo(() => new CalmService(), []);
    const controlService = useMemo(() => new ControlService(), []);
    const interfaceService = useMemo(() => new InterfaceService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    const onControlLoadRef = useRef(onControlLoad);
    onControlLoadRef.current = onControlLoad;
    const onInterfaceLoadRef = useRef(onInterfaceLoad);
    onInterfaceLoadRef.current = onInterfaceLoad;

    const [view, setView] = useState<View>({ level: 'root' });
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [domains, setDomains] = useState<string[]>([]);
    const [leafItems, setLeafItems] = useState<LeafItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        calmService.fetchNamespaces().then(setNamespaces).catch(() => setNamespaces([]));
        controlService.fetchDomains().then(setDomains).catch(() => setDomains([]));
    }, [calmService, controlService]);

    // Deep-link / external navigation loading. Kept here (not just in the desktop
    // tree) so direct URLs and the global search still load on mobile, where the
    // tree is not rendered.
    useEffect(() => {
        if (!(params.namespace && params.type && params.id && params.version)) return;
        const uiType = mapTypeInUrlToTypeInUI(params.type);
        const namespace = params.namespace;

        if (uiType === 'Interfaces') {
            interfaceService
                .fetchInterfacesForNamespace(namespace)
                .then((interfaces) => {
                    const match = interfaces.find((i) => i.id === Number(params.id));
                    if (match) {
                        onInterfaceLoadRef.current({
                            namespace,
                            interfaceId: match.id,
                            interfaceName: match.name,
                            interfaceDescription: match.description,
                        });
                    }
                })
                .catch(() => undefined);
            return;
        }

        if (uiType === 'Controls') {
            controlService
                .fetchControlsForDomain(namespace)
                .then((controls) => {
                    const match = controls.find((c) => c.id === Number(params.id));
                    if (match) {
                        onControlLoadRef.current({
                            domain: namespace,
                            controlId: match.id,
                            controlName: match.name,
                            controlDescription: match.description,
                        });
                    }
                })
                .catch(() => undefined);
            return;
        }

        if (isSlug(params.id)) {
            loadResourceForId(params.version, uiType, namespace, params.id, calmService, onDataLoad);
        } else {
            loadResource({
                version: params.version,
                type: uiType,
                namespace,
                resourceID: params.id,
                calmService,
                onDataLoad,
                onAdrLoad,
                adrService,
            });
        }
    }, [params, calmService, adrService, interfaceService, controlService, onDataLoad, onAdrLoad]);

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
                    setLeafItems(controls.map((c) => ({ id: c.id.toString(), name: c.name })))
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

    const rows: { key: string; label: string; isLeaf: boolean; onClick: () => void }[] = (() => {
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
                    onClick: () => setView({ level: 'types', namespace: ns }),
                }));
            case 'types':
                return RESOURCE_TYPES.map((t) => ({
                    key: t,
                    label: t,
                    isLeaf: false,
                    onClick: () => openType(view.namespace, t),
                }));
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
                                onClick={row.onClick}
                            >
                                <span className="flex-1 min-w-0 truncate">{row.label}</span>
                                {!row.isLeaf && (
                                    <IoChevronForwardOutline className="text-base-content/40 shrink-0" size={18} />
                                )}
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
