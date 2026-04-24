import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IoCompassOutline, IoChevronBackOutline, IoListOutline, IoGitBranchOutline } from 'react-icons/io5';
import { CalmService } from '../../../service/calm-service.js';
import { ControlService } from '../../../service/control-service.js';
import { InterfaceService } from '../../../service/interface-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { Data, Adr, ResourceSummary, AdrSummary, ResourceMapping, isSlug } from '../../../model/calm.js';

function mapCalmTypeToResourceType(type: string): string {
    switch (type) {
        case 'Architectures': return 'ARCHITECTURE';
        case 'Patterns': return 'PATTERN';
        case 'Standards': return 'STANDARD';
        default: return '';
    }
}
import { ControlDetail, ControlData } from '../../../model/control.js';
import { InterfaceDetail, InterfaceData } from '../../../model/interface.js';
import { useNavigate, useParams } from 'react-router-dom';
import { DomainItem } from './DomainItem.js';
import { InterfaceItem } from './InterfaceItem.js';

type TypeInUrl = 'architectures' | 'patterns' | 'adrs' | 'standards' | 'interfaces' | 'controls';
type TypeInUI = 'Architectures' | 'Patterns' | 'ADRs' | 'Standards' | 'Interfaces' | 'Controls';
type HubParams = {
    namespace: string;
    type: TypeInUrl;
    id: string;
    version: string;
};

interface LoadResourceIdsOptions {
    type: string;
    namespace: string;
    calmService: CalmService;
    setArchitectureSummaries: (summaries: ResourceSummary[]) => void;
    setPatternSummaries: (summaries: ResourceSummary[]) => void;
    setStandardSummaries: (summaries: ResourceSummary[]) => void;
    adrService: AdrService;
    setAdrSummaries: (summaries: AdrSummary[]) => void;
}

interface LoadVersionsOptions {
    resourceID: string;
    type: string;
    namespace: string;
    calmService: CalmService;
    setArchitectureVersions: (versions: string[]) => void;
    setPatternVersions: (versions: string[]) => void;
    setStandardVersions: (versions: string[]) => void;
    adrService: AdrService;
    setAdrRevisions: (revisions: string[]) => void;
}

interface LoadResourceOptions {
    version: string;
    type: string;
    namespace: string;
    resourceID: string;
    calmService: CalmService;
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    adrService: AdrService;
}

const basePath = '';
const EMPTY_STR_VALUE = '';

interface TreeNavigationProps {
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    onControlLoad: (control: ControlData) => void;
    onInterfaceLoad: (iface: InterfaceData) => void;
    onCollapse?: () => void;
}

interface VersionItemProps {
    version: string;
    isSelected: boolean;
    onVersionClick: (version: string) => void;
}

interface ResourceItemProps {
    resourceID: string;
    displayName?: string;
    type: string;
    isSelected: boolean;
    versions: string[];
    selectedVersion: string;
    onResourceClick: (resourceID: string, type: string) => void;
    onVersionClick: (version: string, type: string) => void;
}

interface ResourceTypeProps {
    type: string;
    isSelected: boolean;
    resourceIDs: string[];
    resourceNames?: Record<string, string>;
    selectedResourceID: string;
    versions: string[];
    selectedVersion: string;
    onTypeClick: (type: string) => void;
    onResourceClick: (resourceID: string, type: string) => void;
    onVersionClick: (version: string, type: string) => void;
}

interface NamespaceItemProps {
    node: NamespaceNode;
    selectedNamespace: string;
    selectedType: string;
    selectedResourceID: string;
    selectedVersion: string;
    getResourceIDs: (type: string) => string[];
    getResourceNames: (type: string) => Record<string, string>;
    getVersions: (type: string) => string[];
    namespaceInterfaces: InterfaceDetail[];
    selectedInterfaceId: number | null;
    onNamespaceClick: (namespace: string) => void;
    onTypeClick: (type: string) => void;
    onResourceClick: (resourceID: string, type: string) => void;
    onVersionClick: (version: string, type: string) => void;
    onInterfaceClick: (iface: InterfaceDetail) => void;
}

export interface NamespaceNode {
    /** Full dot-separated path used as the display label (e.g. "org.finos") */
    label: string;
    /** The actual namespace string when this node IS a real namespace; null for grouping-only nodes */
    namespace: string | null;
    children: NamespaceNode[];
}

interface TrieNode {
    isNamespace: boolean;
    children: Map<string, TrieNode>;
}

function collapseToTree(node: TrieNode, prefix: string): NamespaceNode[] {
    const results: NamespaceNode[] = [];
    for (const [segment, child] of node.children) {
        const fullPath = prefix ? `${prefix}.${segment}` : segment;
        const childNodes = collapseToTree(child, fullPath);
        if (child.isNamespace) {
            results.push({ label: fullPath, namespace: fullPath, children: childNodes });
        } else if (childNodes.length === 1) {
            // Collapse single-child non-namespace intermediates (path compression)
            results.push(childNodes[0]);
        } else if (childNodes.length > 1) {
            // Keep as a grouping node
            results.push({ label: fullPath, namespace: null, children: childNodes });
        }
    }
    return results;
}

export function buildNamespaceTree(namespaces: string[]): NamespaceNode[] {
    const root: TrieNode = { isNamespace: false, children: new Map() };
    for (const ns of namespaces) {
        const segments = ns.split('.');
        let current = root;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (!current.children.has(segment)) {
                current.children.set(segment, { isNamespace: false, children: new Map() });
            }
            current = current.children.get(segment)!;
            if (i === segments.length - 1) {
                current.isNamespace = true;
            }
        }
    }
    return collapseToTree(root, '');
}

function mapTypeInUrlToTypeInUI(urlType: TypeInUrl): TypeInUI {
    switch (urlType) {
        case 'architectures':
            return 'Architectures';
        case 'patterns':
            return 'Patterns';
        case 'adrs':
            return 'ADRs';
        case 'standards':
            return 'Standards';
        case 'interfaces':
            return 'Interfaces';
        case 'controls':
            return 'Controls';
        default:
            throw new Error(`Unhandled type: ${urlType}`);
    }
}

function mapTypeInUIToTypeInUrl(uiType: TypeInUI): TypeInUrl {
    switch (uiType) {
        case 'Architectures':
            return 'architectures';
        case 'Patterns':
            return 'patterns';
        case 'ADRs':
            return 'adrs';
        case 'Standards':
            return 'standards';
        case 'Interfaces':
            return 'interfaces';
        case 'Controls':
            return 'controls';
        default:
            throw new Error(`Unhandled type: ${uiType}`);
    }
}

function VersionItem({ version, isSelected, onVersionClick }: VersionItemProps) {
    return (
        <li>
            <a className={isSelected ? 'active' : ''} onClick={() => onVersionClick(version)}>
                {version}
            </a>
        </li>
    );
}

function ResourceItem({
    resourceID,
    displayName,
    type,
    isSelected,
    versions,
    selectedVersion,
    onResourceClick,
    onVersionClick,
}: ResourceItemProps) {
    const label = displayName ?? resourceID;
    if (isSelected) {
        return (
            <li>
                <details open={true}>
                    <summary className="active">{label}</summary>
                    <ul>
                        {versions.map((version) => (
                            <VersionItem
                                key={version}
                                version={version}
                                isSelected={selectedVersion === version}
                                onVersionClick={(v) => onVersionClick(v, type)}
                            />
                        ))}
                    </ul>
                </details>
            </li>
        );
    }

    return (
        <li>
            <a onClick={() => onResourceClick(resourceID, type)}>{label}</a>
        </li>
    );
}

function ResourceType({
    type,
    isSelected,
    resourceIDs,
    resourceNames,
    selectedResourceID,
    versions,
    selectedVersion,
    onTypeClick,
    onResourceClick,
    onVersionClick,
}: ResourceTypeProps) {
    if (isSelected) {
        return (
            <li>
                <details open={true}>
                    <summary className="active">{type}</summary>
                    <ul>
                        {resourceIDs.map((resourceID) => (
                            <ResourceItem
                                key={resourceID}
                                resourceID={resourceID}
                                displayName={resourceNames?.[resourceID]}
                                type={type}
                                isSelected={selectedResourceID === resourceID}
                                versions={versions}
                                selectedVersion={selectedVersion}
                                onResourceClick={onResourceClick}
                                onVersionClick={onVersionClick}
                            />
                        ))}
                    </ul>
                </details>
            </li>
        );
    }

    return (
        <li>
            <a onClick={() => onTypeClick(type)}>{type}</a>
        </li>
    );
}

function NamespaceItem({
    node,
    selectedNamespace,
    selectedType,
    selectedResourceID,
    selectedVersion,
    getResourceIDs,
    getResourceNames,
    getVersions,
    namespaceInterfaces,
    selectedInterfaceId,
    onNamespaceClick,
    onTypeClick,
    onResourceClick,
    onVersionClick,
    onInterfaceClick,
}: NamespaceItemProps) {
    const resourceTypes = ['Architectures', 'Patterns', 'Standards', 'ADRs', 'Interfaces'];
    const isThisSelected = node.namespace !== null && node.namespace === selectedNamespace;
    const hasSelectedDescendant = selectedNamespace.startsWith(node.label + '.');

    // Grouping nodes (no real namespace) track their own open state so users can toggle them
    const [groupingOpen, setGroupingOpen] = useState(hasSelectedDescendant);
    useEffect(() => {
        if (hasSelectedDescendant) setGroupingOpen(true);
    }, [hasSelectedDescendant]);

    const isOpen = node.namespace !== null
        ? (isThisSelected || hasSelectedDescendant)
        : groupingOpen;

    const handleSummaryClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (node.namespace) {
            onNamespaceClick(node.namespace);
        } else {
            setGroupingOpen((prev) => !prev);
        }
    };

    return (
        <li>
            <details open={isOpen}>
                <summary
                    className={isThisSelected ? 'active' : ''}
                    onClick={handleSummaryClick}
                >
                    {node.label}
                </summary>
                {isOpen && (
                    <ul>
                        {isThisSelected && resourceTypes.map((type) => {
                            if (type === 'Interfaces') {
                                const isInterfacesSelected = selectedType === 'Interfaces';
                                if (isInterfacesSelected) {
                                    return (
                                        <li key={type}>
                                            <details open={true}>
                                                <summary className="active">Interfaces</summary>
                                                <ul>
                                                    {namespaceInterfaces.map((iface) => (
                                                        <InterfaceItem
                                                            key={iface.id}
                                                            iface={iface}
                                                            isSelected={selectedInterfaceId === iface.id}
                                                            onInterfaceClick={onInterfaceClick}
                                                        />
                                                    ))}
                                                </ul>
                                            </details>
                                        </li>
                                    );
                                }
                                return (
                                    <li key={type}>
                                        <a onClick={() => onTypeClick(type)}>{type}</a>
                                    </li>
                                );
                            }
                            return (
                                <ResourceType
                                    key={type}
                                    type={type}
                                    isSelected={selectedType === type}
                                    resourceIDs={getResourceIDs(type)}
                                    resourceNames={getResourceNames(type)}
                                    selectedResourceID={selectedResourceID}
                                    versions={getVersions(type)}
                                    selectedVersion={selectedVersion}
                                    onTypeClick={onTypeClick}
                                    onResourceClick={onResourceClick}
                                    onVersionClick={onVersionClick}
                                />
                            );
                        })}
                        {node.children.map((child) => (
                            <NamespaceItem
                                key={child.label}
                                node={child}
                                selectedNamespace={selectedNamespace}
                                selectedType={selectedType}
                                selectedResourceID={selectedResourceID}
                                selectedVersion={selectedVersion}
                                getResourceIDs={getResourceIDs}
                                getResourceNames={getResourceNames}
                                getVersions={getVersions}
                                namespaceInterfaces={namespaceInterfaces}
                                selectedInterfaceId={selectedInterfaceId}
                                onNamespaceClick={onNamespaceClick}
                                onTypeClick={onTypeClick}
                                onResourceClick={onResourceClick}
                                onVersionClick={onVersionClick}
                                onInterfaceClick={onInterfaceClick}
                            />
                        ))}
                    </ul>
                )}
            </details>
        </li>
    );
}

function loadResourceIds({ 
    type, 
    namespace,
    calmService,
    setArchitectureSummaries, 
    setPatternSummaries, 
    setStandardSummaries,
    adrService, 
    setAdrSummaries 
}: LoadResourceIdsOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitectureSummaries(namespace).then(setArchitectureSummaries);
    } else if (type === 'Patterns') {
        calmService.fetchPatternSummaries(namespace).then(setPatternSummaries);
    } else if (type === 'Standards') {
        calmService.fetchStandardSummaries(namespace).then(setStandardSummaries);
    } else if (type === 'ADRs') {
        adrService.fetchAdrSummaries(namespace).then(setAdrSummaries);
    }
}

function loadVersionsForId(
    resourceID: string,
    type: string,
    namespace: string,
    calmService: CalmService,
    setVersions: { setArchitectureVersions: (v: string[]) => void; setPatternVersions: (v: string[]) => void; setStandardVersions: (v: string[]) => void; },
) {
    if (isSlug(resourceID)) {
        const setter = type === 'Architectures' ? setVersions.setArchitectureVersions
            : type === 'Patterns' ? setVersions.setPatternVersions
            : setVersions.setStandardVersions;
        calmService.fetchVersionsByCustomId(namespace, resourceID).then(setter);
    }
}

function loadResourceForId(
    version: string,
    type: string,
    namespace: string,
    resourceID: string,
    calmService: CalmService,
    onDataLoad: (data: Data) => void,
) {
    if (isSlug(resourceID)) {
        calmService.fetchResourceByCustomId(namespace, resourceID, version, type).then(onDataLoad);
    }
}

function loadVersions({ 
    resourceID, 
    type, 
    namespace,
    calmService,
    setArchitectureVersions, 
    setPatternVersions, 
    setStandardVersions,
    adrService, 
    setAdrRevisions 
}: LoadVersionsOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitectureVersions(namespace, resourceID).then(setArchitectureVersions);
    } else if (type === 'Patterns') {
        calmService.fetchPatternVersions(namespace, resourceID).then(setPatternVersions);
    } else if (type === 'Standards') {
        calmService.fetchStandardVersions(namespace, resourceID).then(setStandardVersions);
    } else if (type === 'ADRs') {
        adrService
            .fetchAdrRevisions(namespace, resourceID)
            .then((revisions) => setAdrRevisions(revisions.map((rev) => rev.toString())));
    }
}

function loadResource({ 
    version, 
    type, 
    namespace, 
    resourceID,
    calmService,
    onDataLoad, 
    onAdrLoad, 
    adrService 
}: LoadResourceOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitecture(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'Patterns') {
        calmService.fetchPattern(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'Standards') {
        calmService.fetchStandard(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'ADRs') {
        adrService.fetchAdr(namespace, resourceID, version).then(onAdrLoad);
    }
}

export function TreeNavigation({ onDataLoad, onAdrLoad, onControlLoad, onInterfaceLoad, onCollapse }: TreeNavigationProps) {
    const navigate = useNavigate();
    const params = useParams<HubParams>();

    // Stable ref for onInterfaceLoad to avoid re-triggering the deep-link useEffect
    const onInterfaceLoadRef = useRef(onInterfaceLoad);
    onInterfaceLoadRef.current = onInterfaceLoad;

    // Stable ref for onControlLoad to avoid re-triggering the deep-link useEffect
    const onControlLoadRef = useRef(onControlLoad);
    onControlLoadRef.current = onControlLoad;

    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>(EMPTY_STR_VALUE);
    const [selectedType, setSelectedType] = useState<string>(EMPTY_STR_VALUE);
    const [selectedResourceID, setSelectedResourceID] = useState<string>(EMPTY_STR_VALUE);
    const [selectedVersion, setSelectedVersion] = useState<string>(EMPTY_STR_VALUE);

    const [architectureSummaries, setArchitectureSummaries] = useState<ResourceSummary[]>([]);
    const [patternSummaries, setPatternSummaries] = useState<ResourceSummary[]>([]);
    const [standardSummaries, setStandardSummaries] = useState<ResourceSummary[]>([]);
    const [adrSummaries, setAdrSummaries] = useState<AdrSummary[]>([]);

    const [architectureVersions, setArchitectureVersions] = useState<string[]>([]);
    const [patternVersions, setPatternVersions] = useState<string[]>([]);
    const [standardVersions, setStandardVersions] = useState<string[]>([]);
    const [adrRevisions, setAdrRevisions] = useState<string[]>([]);

    // Domain / Controls state
    const [domains, setDomains] = useState<string[]>([]);
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [domainControls, setDomainControls] = useState<ControlDetail[]>([]);
    const [selectedControlId, setSelectedControlId] = useState<number | null>(null);

    // Interface state
    const [namespaceInterfaces, setNamespaceInterfaces] = useState<InterfaceDetail[]>([]);
    const [selectedInterfaceId, setSelectedInterfaceId] = useState<number | null>(null);

    const calmService = useMemo(() => new CalmService(), []);
    const controlService = useMemo(() => new ControlService(), []);
    const interfaceService = useMemo(() => new InterfaceService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    // Resource mappings: merge customId into summaries after fetching
    const mergeMappings = useCallback((summaries: ResourceSummary[], mappings: ResourceMapping[]): ResourceSummary[] => {
        const byNumericId = new Map(mappings.map(m => [m.numericId, m.customId]));
        return summaries.map(s => ({
            ...s,
            customId: byNumericId.get(s.id) ?? undefined,
        }));
    }, []);

    const enrichWithMappings = useCallback((type: string, summaries: ResourceSummary[], setter: (s: ResourceSummary[]) => void) => {
        const resourceType = mapCalmTypeToResourceType(type);
        if (!resourceType) { setter(summaries); return; }
        calmService.fetchMappings(selectedNamespace, resourceType).then(mappings => {
            setter(mergeMappings(summaries, mappings));
        }).catch(() => setter(summaries));
    }, [calmService, selectedNamespace, mergeMappings]);
    const [viewMode, setViewMode] = useState<'flat' | 'hierarchical'>('hierarchical');
    const namespaceTree = useMemo(() => {
        if (viewMode === 'hierarchical') return buildNamespaceTree(namespaces);
        return namespaces.map((ns) => ({ label: ns, namespace: ns, children: [] }));
    }, [namespaces, viewMode]);

    useEffect(() => {
        calmService.fetchNamespaces().then(setNamespaces);
        controlService.fetchDomains().then(setDomains);
    }, [calmService, controlService]);

    useEffect(() => {
        if (params.namespace && params.type && params.id && params.version) {
            const uiType = mapTypeInUrlToTypeInUI(params.type);
            setSelectedNamespace(params.namespace);
            setSelectedType(uiType);

            if (uiType === 'Interfaces') {
                const interfaceId = Number(params.id);
                interfaceService.fetchInterfacesForNamespace(params.namespace)
                    .then((interfaces) => {
                        setNamespaceInterfaces(interfaces);
                        const match = interfaces.find((i) => i.id === interfaceId);
                        if (match) {
                            setSelectedInterfaceId(match.id);
                            onInterfaceLoadRef.current({
                                namespace: params.namespace!,
                                interfaceId: match.id,
                                interfaceName: match.name,
                                interfaceDescription: match.description,
                            });
                        }
                    })
                    .catch(() => {
                        setNamespaceInterfaces([]);
                    });
                return;
            }

            if (uiType === 'Controls') {
                const controlId = Number(params.id);
                const domain = params.namespace;
                controlService.fetchControlsForDomain(domain)
                    .then((controls) => {
                        setDomainControls(controls);
                        setSelectedDomain(domain);
                        const match = controls.find((c) => c.id === controlId);
                        if (match) {
                            setSelectedControlId(match.id);
                            onControlLoadRef.current({
                                domain,
                                controlId: match.id,
                                controlName: match.name,
                                controlDescription: match.description,
                            });
                        }
                    })
                    .catch(() => {
                        setDomainControls([]);
                    });
                return;
            }

            loadResourceIds({
                type: uiType,
                namespace: params.namespace,
                calmService,
                setArchitectureSummaries,
                setPatternSummaries,
                setStandardSummaries,
                adrService,
                setAdrSummaries,
            });
            setSelectedResourceID(params.id);
            if (isSlug(params.id)) {
                loadVersionsForId(params.id, uiType, params.namespace, calmService, {
                    setArchitectureVersions, setPatternVersions, setStandardVersions,
                });
            } else {
                loadVersions({
                    resourceID: params.id,
                    type: uiType,
                    namespace: params.namespace,
                    calmService,
                    setArchitectureVersions,
                    setPatternVersions,
                    setStandardVersions,
                    adrService,
                    setAdrRevisions,
                });
            }
            setSelectedVersion(params.version);
            if (isSlug(params.id)) {
                loadResourceForId(params.version, uiType, params.namespace, params.id, calmService, onDataLoad);
            } else {
                loadResource({
                    version: params.version,
                    type: uiType,
                    namespace: params.namespace,
                    resourceID: params.id,
                    calmService,
                    onDataLoad,
                    onAdrLoad,
                    adrService,
                });
            }
        }
    }, [params, calmService, adrService, interfaceService, controlService, onDataLoad, onAdrLoad]);

    const handleNamespaceClick = useCallback((namespace: string) => {
        if (selectedNamespace === namespace) {
            setSelectedNamespace(EMPTY_STR_VALUE);
        } else {
            setSelectedNamespace(namespace);
        }
        setSelectedType(EMPTY_STR_VALUE);
        setSelectedResourceID(EMPTY_STR_VALUE);
        setSelectedVersion(EMPTY_STR_VALUE);
        // Clear domain selection when navigating namespaces
        setSelectedDomain('');
        setSelectedControlId(null);
        // Clear interface selection when navigating namespaces
        setNamespaceInterfaces([]);
        setSelectedInterfaceId(null);
    }, [selectedNamespace]);

    const handleDomainClick = (domain: string) => {
        if (selectedDomain === domain) {
            setSelectedDomain('');
        } else {
            setSelectedDomain(domain);
            controlService.fetchControlsForDomain(domain).then(setDomainControls);
        }
        setSelectedControlId(null);
        // Clear namespace selection when navigating domains
        setSelectedNamespace(EMPTY_STR_VALUE);
        setSelectedType(EMPTY_STR_VALUE);
        setSelectedResourceID(EMPTY_STR_VALUE);
        setSelectedVersion(EMPTY_STR_VALUE);
        // Clear interface selection when navigating domains
        setNamespaceInterfaces([]);
        setSelectedInterfaceId(null);
    };

    const handleControlClick = (control: ControlDetail) => {
        setSelectedControlId(control.id);
        onControlLoad({
            domain: selectedDomain,
            controlId: control.id,
            controlName: control.name,
            controlDescription: control.description,
        });
    };

    const handleInterfaceClick = (iface: InterfaceDetail) => {
        setSelectedInterfaceId(iface.id);
        onInterfaceLoad({
            namespace: selectedNamespace,
            interfaceId: iface.id,
            interfaceName: iface.name,
            interfaceDescription: iface.description,
        });
    };

    const handleTypeClick = useCallback((type: string) => {
        if (selectedType === type) {
            setSelectedType(EMPTY_STR_VALUE);
        } else {
            setSelectedType(type);
            if (type === 'Interfaces') {
                interfaceService.fetchInterfacesForNamespace(selectedNamespace).then(setNamespaceInterfaces).catch((error) => {
                    console.error('Failed to fetch interfaces', error);
                    setNamespaceInterfaces([]);
                });
            } else if (type === 'ADRs') {
                adrService.fetchAdrSummaries(selectedNamespace).then(setAdrSummaries);
            } else {
                const setter = type === 'Architectures' ? setArchitectureSummaries
                    : type === 'Patterns' ? setPatternSummaries
                    : setStandardSummaries;
                const fetcher = type === 'Architectures' ? calmService.fetchArchitectureSummaries.bind(calmService)
                    : type === 'Patterns' ? calmService.fetchPatternSummaries.bind(calmService)
                    : calmService.fetchStandardSummaries.bind(calmService);
                fetcher(selectedNamespace).then((summaries: ResourceSummary[]) => {
                    enrichWithMappings(type, summaries, setter);
                });
            }
        }
        setSelectedResourceID(EMPTY_STR_VALUE);
        setSelectedVersion(EMPTY_STR_VALUE);
        setSelectedInterfaceId(null);
    }, [selectedNamespace, selectedType, calmService, adrService, interfaceService, enrichWithMappings]);

    const handleResourceClick = useCallback((resourceID: string, type: string) => {
        setSelectedResourceID(resourceID);
        setSelectedVersion(EMPTY_STR_VALUE);
        if (isSlug(resourceID)) {
            loadVersionsForId(resourceID, type, selectedNamespace, calmService, {
                setArchitectureVersions, setPatternVersions, setStandardVersions,
            });
        } else {
            loadVersions({
                resourceID,
                type,
                namespace: selectedNamespace,
                calmService,
                setArchitectureVersions,
                setPatternVersions,
                setStandardVersions,
                adrService,
                setAdrRevisions,
            });
        }
    }, [selectedNamespace, calmService, adrService]);

    const handleVersionClick = useCallback((version: string, type: string) => {
        navigate(`${basePath}/${selectedNamespace}/${mapTypeInUIToTypeInUrl(type as TypeInUI)}/${selectedResourceID}/${version}`);
    }, [navigate, selectedNamespace, selectedResourceID]);

    const getResourceIDs = (type: string): string[] => {
        const toId = (s: ResourceSummary) => s.customId ?? s.id.toString();
        switch (type) {
            case 'Architectures':
                return architectureSummaries.map(toId);
            case 'Patterns':
                return patternSummaries.map(toId);
            case 'Standards':
                return standardSummaries.map(toId);
            case 'ADRs':
                return adrSummaries.map((s) => s.id.toString());
            default:
                return [];
        }
    };

    const getResourceNames = (type: string): Record<string, string> => {
        const toEntry = (s: ResourceSummary): [string, string] => [(s.customId ?? s.id.toString()), s.name];
        switch (type) {
            case 'Architectures':
                return Object.fromEntries(architectureSummaries.map(toEntry));
            case 'Patterns':
                return Object.fromEntries(patternSummaries.map(toEntry));
            case 'Standards':
                return Object.fromEntries(standardSummaries.map(toEntry));
            case 'ADRs':
                return Object.fromEntries(
                    adrSummaries.map((s) => [s.id.toString(), s.title + ' (' + s.status + ')'])
                );
            default:
                return {};
        }
    };

    const getVersions = (type: string): string[] => {
        switch (type) {
            case 'Architectures':
                return architectureVersions;
            case 'Patterns':
                return patternVersions;
            case 'Standards':
                return standardVersions;
            case 'ADRs':
                return adrRevisions;
            default:
                return [];
        }
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="bg-base-200 px-6 py-4 border-b border-base-300 flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <IoCompassOutline className="text-accent" />
                    Explore
                </h2>
                <div className="flex items-center gap-1">
                    <div className="join">
                        <button
                            aria-label="Flat view"
                            title="Flat view"
                            className={`join-item btn btn-xs ${viewMode === 'flat' ? 'btn-active' : 'btn-ghost'}`}
                            onClick={() => setViewMode('flat')}
                        >
                            <IoListOutline />
                        </button>
                        <button
                            aria-label="Hierarchical view"
                            title="Hierarchical view"
                            className={`join-item btn btn-xs ${viewMode === 'hierarchical' ? 'btn-active' : 'btn-ghost'}`}
                            onClick={() => setViewMode('hierarchical')}
                        >
                            <IoGitBranchOutline />
                        </button>
                    </div>
                    {onCollapse && (
                        <button
                            aria-label="Collapse sidebar"
                            className="btn btn-ghost btn-xs btn-circle"
                            onClick={onCollapse}
                        >
                            <IoChevronBackOutline />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <ul className="menu w-full">
                    <li>
                        <a>Namespaces</a>
                        <ul>
                            {namespaceTree.map((node) => (
                                <NamespaceItem
                                    key={node.label}
                                    node={node}
                                    selectedNamespace={selectedNamespace}
                                    selectedType={selectedType}
                                    selectedResourceID={selectedResourceID}
                                    selectedVersion={selectedVersion}
                                    getResourceIDs={getResourceIDs}
                                    getResourceNames={getResourceNames}
                                    getVersions={getVersions}
                                    namespaceInterfaces={namespaceInterfaces}
                                    selectedInterfaceId={selectedInterfaceId}
                                    onNamespaceClick={handleNamespaceClick}
                                    onTypeClick={handleTypeClick}
                                    onResourceClick={handleResourceClick}
                                    onVersionClick={handleVersionClick}
                                    onInterfaceClick={handleInterfaceClick}
                                />
                            ))}
                        </ul>
                    </li>
                    <li>
                        <a>Control Domains</a>
                        <ul>
                            {domains.map((domain) => (
                                <DomainItem
                                    key={domain}
                                    domain={domain}
                                    isSelected={selectedDomain === domain}
                                    controls={domainControls}
                                    selectedControlId={selectedControlId}
                                    onDomainClick={handleDomainClick}
                                    onControlClick={handleControlClick}
                                />
                            ))}
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    );
}
