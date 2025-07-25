import { useEffect, useState } from 'react';
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

export function TreeNavigation({ onDataLoad, onAdrLoad }: TreeNavigationProps) {
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

    const adrService = new AdrService();

    useEffect(() => {
        fetchNamespaces(setNamespaces);
    }, []);

    const handleNamespaceClick = (namespace: string) => {
        if (selectedNamespace === namespace) {
            setSelectedNamespace('');
        } else {
            setSelectedNamespace(namespace);
        }
        setSelectedType('');
        setSelectedResourceID('');
        setSelectedVersion('');
    };

    const handleTypeClick = (type: string) => {
        if (selectedType === type) {
            setSelectedType('');
        } else {
            setSelectedType(type);
            if (type === 'Architectures') {
                fetchArchitectureIDs(selectedNamespace, setArchitectureIDs);
            } else if (type === 'Patterns') {
                fetchPatternIDs(selectedNamespace, setPatternIDs);
            } else if (type === 'Flows') {
                fetchFlowIDs(selectedNamespace, setFlowIDs);
            } else if (type === 'ADRs') {
                adrService.fetchAdrIDs(selectedNamespace).then(ids => setAdrIDs(ids.map(id => id.toString())));
            }
        }
        setSelectedResourceID('');
        setSelectedVersion('');
    };

    const handleResourceClick = (resourceID: string, type: string) => {
        setSelectedResourceID(resourceID);
        setSelectedVersion('');

        if (type === 'Architectures') {
            fetchArchitectureVersions(selectedNamespace, resourceID, setArchitectureVersions);
        } else if (type === 'Patterns') {
            fetchPatternVersions(selectedNamespace, resourceID, setPatternVersions);
        } else if (type === 'Flows') {
            fetchFlowVersions(selectedNamespace, resourceID, setFlowVersions);
        } else if (type === 'ADRs') {
            adrService.fetchAdrRevisions(selectedNamespace, resourceID).then(revisions => setAdrRevisions(revisions.map(rev => rev.toString())));
        }
    };

    const handleVersionClick = (version: string, type: string) => {
        setSelectedVersion(version);

        if (type === 'Architectures') {
            fetchArchitecture(selectedNamespace, selectedResourceID, version, onDataLoad);
        } else if (type === 'Patterns') {
            fetchPattern(selectedNamespace, selectedResourceID, version, onDataLoad);
        } else if (type === 'Flows') {
            fetchFlow(selectedNamespace, selectedResourceID, version, onDataLoad);
        } else if (type === 'ADRs') {
            adrService.fetchAdr(selectedNamespace, selectedResourceID, version).then(onAdrLoad);
        }
    };

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
        <div className="border border-gray-300 h-full w-full overflow-auto flex flex-col">
            <div className="flex-1 overflow-auto px-4 pb-4">
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
