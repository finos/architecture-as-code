import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoCompassOutline } from 'react-icons/io5';
import {
    fetchNamespaces,
    fetchPatternIDs,
    fetchFlowIDs,
    fetchArchitectureIDs,
    fetchPatternVersions,
    fetchFlowVersions,
    fetchArchitectureVersions,
    fetchPattern,
    fetchFlow,
    fetchArchitecture,
} from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { Data, Adr } from '../../../model/calm.js';
import { useNavigate, useParams } from 'react-router-dom';

type HubParams = {
    namespace?: string;
    type?: 'Architectures' | 'Patterns' | 'Flows' | 'ADRs';
    id?: string;
    version?: string;
};

const basePath = '/artifacts';

interface TreeNavigationProps {
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
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

function isNotNullOrEmptyString(value: string | null | undefined): value is string {
    return value !== null && value !== undefined && value !== '';
}

function loadResourceIds(type: string, namespace: string, setArchitectureIDs: (ids: string[]) => void, setPatternIDs: (ids: string[]) => void, setFlowIDs: (ids: string[]) => void, adrService: AdrService, setAdrIDs: (ids: string[]) => void) {
    if (type === 'Architectures') {
            fetchArchitectureIDs(namespace, setArchitectureIDs);
        } else if (type === 'Patterns') {
            fetchPatternIDs(namespace, setPatternIDs);
        } else if (type === 'Flows') {
            fetchFlowIDs(namespace, setFlowIDs);
        } else if (type === 'ADRs') {
            adrService
                .fetchAdrIDs(namespace)
                .then((ids) => setAdrIDs(ids.map((id) => id.toString())));
        }
}

function loadVersions(resourceID: string, type: string, namespace: string, setArchitectureVersions: (versions: string[]) => void, setPatternVersions: (versions: string[]) => void, setFlowVersions: (versions: string[]) => void, adrService: AdrService, setAdrRevisions: (revisions: string[]) => void) {
    if (type === 'Architectures') {
        fetchArchitectureVersions(namespace, resourceID, setArchitectureVersions);
    } else if (type === 'Patterns') {
        fetchPatternVersions(namespace, resourceID, setPatternVersions);
    } else if (type === 'Flows') {
        fetchFlowVersions(namespace, resourceID, setFlowVersions);
    } else if (type === 'ADRs') {
        adrService
            .fetchAdrRevisions(namespace, resourceID)
            .then((revisions) => setAdrRevisions(revisions.map((rev) => rev.toString())));
    }
}

function loadResource(version: string, type: string, namespace: string, resourceID: string, onDataLoad: (data: Data) => void, onAdrLoad: (adr: Adr) => void, adrService: AdrService) {
    if (type === 'Architectures') {
        fetchArchitecture(namespace, resourceID, version, onDataLoad);
    } else if (type === 'Patterns') {
        fetchPattern(namespace, resourceID, version, onDataLoad);
    } else if (type === 'Flows') {
        fetchFlow(namespace, resourceID, version, onDataLoad);
    } else if (type === 'ADRs') {
        adrService.fetchAdr(namespace, resourceID, version).then(onAdrLoad);
    }
}

export function TreeNavigation({ onDataLoad, onAdrLoad }: TreeNavigationProps) {
    const navigate = useNavigate();
    const params = useParams<HubParams>();
    
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedResourceID, setSelectedResourceID] = useState<string>('');
    const [selectedVersion, setSelectedVersion] = useState<string>('');

    const [architectureIDs, setArchitectureIDs] = useState<string[]>([]);
    const [patternIDs, setPatternIDs] = useState<string[]>([]);
    const [flowIDs, setFlowIDs] = useState<string[]>([]);
    const [adrIDs, setAdrIDs] = useState<string[]>([]);

    const [architectureVersions, setArchitectureVersions] = useState<string[]>([]);
    const [patternVersions, setPatternVersions] = useState<string[]>([]);
    const [flowVersions, setFlowVersions] = useState<string[]>([]);
    const [adrRevisions, setAdrRevisions] = useState<string[]>([]);

    const adrService = useMemo(() => new AdrService(), []);

    useEffect(() => {
        fetchNamespaces(setNamespaces);
        // Check if namespace exists
        if (isNotNullOrEmptyString(params.namespace)) {
            //Set selected namespace based on params
            setSelectedNamespace(params.namespace);
            // Check if resource type exists
            if (isNotNullOrEmptyString(params.type)) {
                //Set selected type based on params
                setSelectedType(params.type);
                //Load resource IDs for the selected type and namespace
                loadResourceIds(params.type, params.namespace, setArchitectureIDs, setPatternIDs, setFlowIDs, adrService, setAdrIDs);
                // Check if resource ID exists
                if (isNotNullOrEmptyString(params.id)) {
                    //Set selected resource ID based on params
                    setSelectedResourceID(params.id);
                    //Load versions for the selected resource ID, type, and namespace
                    loadVersions(params.id, params.type, params.namespace, setArchitectureVersions, setPatternVersions, setFlowVersions, adrService, setAdrRevisions);
                    // Check if version exists
                    if (isNotNullOrEmptyString(params.version)) {
                        //Set selected version based on params
                        setSelectedVersion(params.version);
                        //Load the resource data or ADR based on all params
                        loadResource(params.version, params.type, params.namespace, params.id, onDataLoad, onAdrLoad, adrService);
                    }
                }
            }
        }
        
    }, [params, adrService, onDataLoad, onAdrLoad]);

    const handleNamespaceClick = useCallback((namespace: string) => {
        navigate(`${basePath}/${namespace}`);
    }, [navigate]);

    const handleTypeClick = useCallback((type: string) => {
        navigate(`${basePath}/${selectedNamespace}/${type}`);
    }, [navigate, selectedNamespace]);

    const handleResourceClick = useCallback((resourceID: string, type: string) => {
        navigate(`${basePath}/${selectedNamespace}/${type}/${resourceID}`);
    }, [navigate, selectedNamespace]);

    const handleVersionClick = useCallback((version: string, type: string) => {
        navigate(`${basePath}/${selectedNamespace}/${type}/${selectedResourceID}/${version}`);
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
            <div className="bg-base-200 px-6 py-4 border-b border-base-300">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <IoCompassOutline className="text-accent" />
                    Explore
                </h2>
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
                </ul>
            </div>
        </div>
    );
}
