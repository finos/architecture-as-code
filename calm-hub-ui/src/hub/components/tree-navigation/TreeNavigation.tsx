import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoCompassOutline, IoChevronBackOutline } from 'react-icons/io5';
import { CalmService } from '../../../service/calm-service.js';
import {
    fetchDomains,
    fetchControlsForDomain,
} from '../../../service/control-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { Data, Adr } from '../../../model/calm.js';
import { ControlDetail, ControlData } from '../../../model/control.js';
import { useNavigate, useParams } from 'react-router-dom';

type TypeInUrl = 'architectures' | 'patterns' | 'flows' | 'adrs';
type TypeInUI = 'Architectures' | 'Patterns' | 'Flows' | 'ADRs';
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
    setArchitectureIDs: (ids: string[]) => void;
    setPatternIDs: (ids: string[]) => void;
    setFlowIDs: (ids: string[]) => void;
    adrService: AdrService;
    setAdrIDs: (ids: string[]) => void;
}

interface LoadVersionsOptions {
    resourceID: string;
    type: string;
    namespace: string;
    calmService: CalmService;
    setArchitectureVersions: (versions: string[]) => void;
    setPatternVersions: (versions: string[]) => void;
    setFlowVersions: (versions: string[]) => void;
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
    onCollapse?: () => void;
}

interface VersionItemProps {
    version: string;
    isSelected: boolean;
    onVersionClick: (version: string) => void;
}

interface ResourceItemProps {
    resourceID: string;
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
    selectedResourceID: string;
    versions: string[];
    selectedVersion: string;
    onTypeClick: (type: string) => void;
    onResourceClick: (resourceID: string, type: string) => void;
    onVersionClick: (version: string, type: string) => void;
}

interface NamespaceItemProps {
    namespace: string;
    isSelected: boolean;
    selectedType: string;
    selectedResourceID: string;
    selectedVersion: string;
    getResourceIDs: (type: string) => string[];
    getVersions: (type: string) => string[];
    onNamespaceClick: (namespace: string) => void;
    onTypeClick: (type: string) => void;
    onResourceClick: (resourceID: string, type: string) => void;
    onVersionClick: (version: string, type: string) => void;
}

function mapTypeInUrlToTypeInUI(urlType: TypeInUrl): TypeInUI {
    switch (urlType) {
        case 'architectures':
            return 'Architectures';
        case 'patterns':
            return 'Patterns';
        case 'flows':
            return 'Flows';
        case 'adrs':
            return 'ADRs';
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
        case 'Flows':
            return 'flows';
        case 'ADRs':
            return 'adrs';
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
    type,
    isSelected,
    versions,
    selectedVersion,
    onResourceClick,
    onVersionClick,
}: ResourceItemProps) {
    if (isSelected) {
        return (
            <li>
                <details open={true}>
                    <summary className="active">{resourceID}</summary>
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
            <a onClick={() => onResourceClick(resourceID, type)}>{resourceID}</a>
        </li>
    );
}

function ResourceType({
    type,
    isSelected,
    resourceIDs,
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
    namespace,
    isSelected,
    selectedType,
    selectedResourceID,
    selectedVersion,
    getResourceIDs,
    getVersions,
    onNamespaceClick,
    onTypeClick,
    onResourceClick,
    onVersionClick,
}: NamespaceItemProps) {
    const resourceTypes = ['Architectures', 'Patterns', 'Flows', 'ADRs'];

    return (
        <li>
            <details open={isSelected}>
                <summary
                    className={isSelected ? 'active' : ''}
                    onClick={(e) => {
                        e.preventDefault();
                        onNamespaceClick(namespace);
                    }}
                >
                    {namespace}
                </summary>
                {isSelected && (
                    <ul>
                        {resourceTypes.map((type) => (
                            <ResourceType
                                key={type}
                                type={type}
                                isSelected={selectedType === type}
                                resourceIDs={getResourceIDs(type)}
                                selectedResourceID={selectedResourceID}
                                versions={getVersions(type)}
                                selectedVersion={selectedVersion}
                                onTypeClick={onTypeClick}
                                onResourceClick={onResourceClick}
                                onVersionClick={onVersionClick}
                            />
                        ))}
                    </ul>
                )}
            </details>
        </li>
    );
}

interface ControlItemProps {
    control: ControlDetail;
    isSelected: boolean;
    onControlClick: (control: ControlDetail) => void;
}

function ControlItem({ control, isSelected, onControlClick }: ControlItemProps) {
    return (
        <li>
            <a className={isSelected ? 'active' : ''} onClick={() => onControlClick(control)}>
                {control.name}
            </a>
        </li>
    );
}

interface DomainItemProps {
    domain: string;
    isSelected: boolean;
    controls: ControlDetail[];
    selectedControlId: number | null;
    onDomainClick: (domain: string) => void;
    onControlClick: (control: ControlDetail) => void;
}

function DomainItem({
    domain,
    isSelected,
    controls,
    selectedControlId,
    onDomainClick,
    onControlClick,
}: DomainItemProps) {
    return (
        <li>
            <details open={isSelected}>
                <summary
                    className={isSelected ? 'active' : ''}
                    onClick={(e) => {
                        e.preventDefault();
                        onDomainClick(domain);
                    }}
                >
                    {domain}
                </summary>
                {isSelected && (
                    <ul>
                        <li>
                            <details open={true}>
                                <summary className="active">Controls</summary>
                                <ul>
                                    {controls.map((control) => (
                                        <ControlItem
                                            key={control.id}
                                            control={control}
                                            isSelected={selectedControlId === control.id}
                                            onControlClick={onControlClick}
                                        />
                                    ))}
                                </ul>
                            </details>
                        </li>
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
    setArchitectureIDs, 
    setPatternIDs, 
    setFlowIDs, 
    adrService, 
    setAdrIDs 
}: LoadResourceIdsOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitectureIDs(namespace).then(setArchitectureIDs);
    } else if (type === 'Patterns') {
        calmService.fetchPatternIDs(namespace).then(setPatternIDs);
    } else if (type === 'Flows') {
        calmService.fetchFlowIDs(namespace).then(setFlowIDs);
    } else if (type === 'ADRs') {
        adrService
            .fetchAdrIDs(namespace)
            .then((ids) => setAdrIDs(ids.map((id) => id.toString())));
    }
}

function loadVersions({ 
    resourceID, 
    type, 
    namespace,
    calmService,
    setArchitectureVersions, 
    setPatternVersions, 
    setFlowVersions, 
    adrService, 
    setAdrRevisions 
}: LoadVersionsOptions) {
    if (type === 'Architectures') {
        calmService.fetchArchitectureVersions(namespace, resourceID).then(setArchitectureVersions);
    } else if (type === 'Patterns') {
        calmService.fetchPatternVersions(namespace, resourceID).then(setPatternVersions);
    } else if (type === 'Flows') {
        calmService.fetchFlowVersions(namespace, resourceID).then(setFlowVersions);
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
    } else if (type === 'Flows') {
        calmService.fetchFlow(namespace, resourceID, version).then(onDataLoad);
    } else if (type === 'ADRs') {
        adrService.fetchAdr(namespace, resourceID, version).then(onAdrLoad);
    }
}

export function TreeNavigation({ onDataLoad, onAdrLoad, onControlLoad, onCollapse }: TreeNavigationProps) {
    const navigate = useNavigate();
    const params = useParams<HubParams>();

    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>(EMPTY_STR_VALUE);
    const [selectedType, setSelectedType] = useState<string>(EMPTY_STR_VALUE);
    const [selectedResourceID, setSelectedResourceID] = useState<string>(EMPTY_STR_VALUE);
    const [selectedVersion, setSelectedVersion] = useState<string>(EMPTY_STR_VALUE);

    const [architectureIDs, setArchitectureIDs] = useState<string[]>([]);
    const [patternIDs, setPatternIDs] = useState<string[]>([]);
    const [flowIDs, setFlowIDs] = useState<string[]>([]);
    const [adrIDs, setAdrIDs] = useState<string[]>([]);

    const [architectureVersions, setArchitectureVersions] = useState<string[]>([]);
    const [patternVersions, setPatternVersions] = useState<string[]>([]);
    const [flowVersions, setFlowVersions] = useState<string[]>([]);
    const [adrRevisions, setAdrRevisions] = useState<string[]>([]);

    // Domain / Controls state
    const [domains, setDomains] = useState<string[]>([]);
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [domainControls, setDomainControls] = useState<ControlDetail[]>([]);
    const [selectedControlId, setSelectedControlId] = useState<number | null>(null);

    const calmService = useMemo(() => new CalmService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    useEffect(() => {
        calmService.fetchNamespaces().then(setNamespaces);
        fetchDomains(setDomains);
    }, [calmService]);

    useEffect(() => {
        if (params.namespace && params.type && params.id && params.version) {
            setSelectedNamespace(params.namespace);
            setSelectedType(mapTypeInUrlToTypeInUI(params.type));
            loadResourceIds({
                type: mapTypeInUrlToTypeInUI(params.type),
                namespace: params.namespace,
                calmService,
                setArchitectureIDs,
                setPatternIDs,
                setFlowIDs,
                adrService,
                setAdrIDs,
            });
            setSelectedResourceID(params.id);
            loadVersions({
                resourceID: params.id,
                type: mapTypeInUrlToTypeInUI(params.type),
                namespace: params.namespace,
                calmService,
                setArchitectureVersions,
                setPatternVersions,
                setFlowVersions,
                adrService,
                setAdrRevisions,
            });
            setSelectedVersion(params.version);
            loadResource({
                version: params.version,
                type: mapTypeInUrlToTypeInUI(params.type),
                namespace: params.namespace,
                resourceID: params.id,
                calmService,
                onDataLoad,
                onAdrLoad,
                adrService,
            });
        }
    }, [params, calmService, adrService, onDataLoad, onAdrLoad]);

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
    }, [selectedNamespace]);

    const handleDomainClick = (domain: string) => {
        if (selectedDomain === domain) {
            setSelectedDomain('');
        } else {
            setSelectedDomain(domain);
            fetchControlsForDomain(domain, setDomainControls);
        }
        setSelectedControlId(null);
        // Clear namespace selection when navigating domains
        setSelectedNamespace(EMPTY_STR_VALUE);
        setSelectedType(EMPTY_STR_VALUE);
        setSelectedResourceID(EMPTY_STR_VALUE);
        setSelectedVersion(EMPTY_STR_VALUE);
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

    const handleTypeClick = useCallback((type: string) => {
        if (selectedType === type) {
            setSelectedType(EMPTY_STR_VALUE);
        } else {
            setSelectedType(type);
            loadResourceIds({
                type,
                namespace: selectedNamespace,
                calmService,
                setArchitectureIDs,
                setPatternIDs,
                setFlowIDs,
                adrService,
                setAdrIDs,
            });
        }
        setSelectedResourceID(EMPTY_STR_VALUE);
        setSelectedVersion(EMPTY_STR_VALUE);
    }, [selectedNamespace, selectedType, calmService, adrService]);

    const handleResourceClick = useCallback((resourceID: string, type: string) => {
        setSelectedResourceID(resourceID);
        setSelectedVersion(EMPTY_STR_VALUE);
        loadVersions({
            resourceID,
            type,
            namespace: selectedNamespace,
            calmService,
            setArchitectureVersions,
            setPatternVersions,
            setFlowVersions,
            adrService,
            setAdrRevisions,
        });
    }, [selectedNamespace, calmService, adrService]);

    const handleVersionClick = useCallback((version: string, type: string) => {
        navigate(`${basePath}/${selectedNamespace}/${mapTypeInUIToTypeInUrl(type as TypeInUI)}/${selectedResourceID}/${version}`);
    }, [navigate, selectedNamespace, selectedResourceID]);

    const getResourceIDs = (type: string): string[] => {
        switch (type) {
            case 'Architectures':
                return architectureIDs;
            case 'Patterns':
                return patternIDs;
            case 'Flows':
                return flowIDs;
            case 'ADRs':
                return adrIDs;
            default:
                return [];
        }
    };

    const getVersions = (type: string): string[] => {
        switch (type) {
            case 'Architectures':
                return architectureVersions;
            case 'Patterns':
                return patternVersions;
            case 'Flows':
                return flowVersions;
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

            <div className="flex-1 overflow-auto p-4">
                <ul className="menu w-full">
                    <li>
                        <a>Namespaces</a>
                        <ul>
                            {namespaces.map((namespace) => (
                                <NamespaceItem
                                    key={namespace}
                                    namespace={namespace}
                                    isSelected={selectedNamespace === namespace}
                                    selectedType={selectedType}
                                    selectedResourceID={selectedResourceID}
                                    selectedVersion={selectedVersion}
                                    getResourceIDs={getResourceIDs}
                                    getVersions={getVersions}
                                    onNamespaceClick={handleNamespaceClick}
                                    onTypeClick={handleTypeClick}
                                    onResourceClick={handleResourceClick}
                                    onVersionClick={handleVersionClick}
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
