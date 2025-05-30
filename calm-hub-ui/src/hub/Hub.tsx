import { useEffect, useState } from 'react';
import { ValueTable } from './components/value-table/ValueTable.js';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import {
    Namespace,
    PatternID,
    FlowID,
    ArchitectureID,
    Version,
    Data,
    CalmType,
} from '../model/calm.js';
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
} from '../service/calm-service.js';
import { Navbar } from '../components/navbar/Navbar.js';

function Hub() {
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [currentNamespace, setCurrentNamespace] = useState<Namespace | undefined>();
    const [patternIDs, setPatternIDs] = useState<PatternID[]>([]);
    const [flowIDs, setFlowIDs] = useState<FlowID[]>([]);
    const [architectureIDs, setArchitectureIDs] = useState<ArchitectureID[]>([]);
    const [currentPatternOrFlowID, setCurrentPatternOrFlowID] = useState<string | undefined>();
    const [currentVersion, setCurrentVersion] = useState<Version | undefined>();
    const [currentCalmType, setCurrentCalmType] = useState<string | undefined>();

    const [data, setData] = useState<Data | undefined>();
    const [versions, setVersions] = useState<Version[]>([]);

    useEffect(() => {
        fetchNamespaces(setNamespaces);
    }, []);

    const handleNamespaceSelection = (namespace: Namespace) => {
        setPatternIDs([]);
        setFlowIDs([]);
        setArchitectureIDs([]);
        setVersions([]);
        setCurrentCalmType(undefined);
        setData(undefined);
        setCurrentNamespace(namespace);
        fetchPatternIDs(namespace, setPatternIDs);
    };

    const handleCalmTypeSelection = (calmType: string) => {
        setCurrentCalmType(calmType);

        if (calmType === CalmType.Pattern) {
            fetchPatternIDs(currentNamespace!, setPatternIDs);
            setFlowIDs([]);
            setArchitectureIDs([]);
        } else if (calmType === CalmType.Flow) {
            fetchFlowIDs(currentNamespace!, setFlowIDs);
            setPatternIDs([]);
            setArchitectureIDs([]);
        } else if (calmType === CalmType.Architecture) {
            fetchArchitectureIDs(currentNamespace!, setArchitectureIDs);
            setPatternIDs([]);
            setFlowIDs([]);
        }
        setVersions([]);
        setData(undefined);
    };

    const handlePatternOrFlowSelection = (selectedID: string) => {
        setCurrentPatternOrFlowID(selectedID);

        if (currentCalmType === CalmType.Pattern) {
            fetchPatternVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === CalmType.Flow) {
            fetchFlowVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === CalmType.Architecture) {
            fetchArchitectureVersions(currentNamespace!, selectedID, setVersions);
        }
    };

    const handleVersionSelection = (version: Version) => {
        setCurrentVersion(version);

        if (currentCalmType === CalmType.Pattern) {
            fetchPattern(currentNamespace || '', currentPatternOrFlowID || '', version, setData);
        } else if (currentCalmType === CalmType.Flow) {
            fetchFlow(currentNamespace || '', currentPatternOrFlowID || '', version, setData);
        } else if (currentCalmType === CalmType.Architecture) {
            fetchArchitecture(
                currentNamespace || '',
                currentPatternOrFlowID || '',
                version,
                setData
            );
        }
    };

    return (
        <>
            <Navbar />
            <div className="flex flex-row h-[90%]">
                <div className="flex flex-row w-1/3">
                    <ValueTable
                        header="Namespaces"
                        values={namespaces}
                        callback={handleNamespaceSelection}
                        currentValue={currentNamespace}
                    />
                    {currentNamespace && (
                        <ValueTable
                            header="Calm Type"
                            values={Object.values(CalmType) as string[]}
                            callback={handleCalmTypeSelection}
                            currentValue={currentCalmType}
                        />
                    )}

                    {currentNamespace && currentCalmType && (
                        <ValueTable
                            header={
                                currentCalmType === CalmType.Pattern
                                    ? CalmType.Pattern
                                    : currentCalmType === CalmType.Flow
                                      ? CalmType.Flow
                                      : CalmType.Architecture
                            }
                            values={
                                currentCalmType === CalmType.Pattern
                                    ? patternIDs
                                    : currentCalmType === CalmType.Flow
                                      ? flowIDs
                                      : architectureIDs
                            }
                            callback={handlePatternOrFlowSelection}
                            currentValue={currentPatternOrFlowID}
                        />
                    )}

                    {currentNamespace && currentCalmType && (
                        <ValueTable
                            header="Versions"
                            values={versions}
                            callback={handleVersionSelection}
                            currentValue={currentVersion}
                        />
                    )}
                </div>
                <JsonRenderer json={data} />
            </div>
        </>
    );
}

export default Hub;
