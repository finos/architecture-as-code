import { useEffect, useState } from 'react';
import { ValueTable } from './components/value-table/ValueTable.js';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import {
    Namespace,
    PatternID,
    FlowID,
    ArchitectureID,
    Version,
    Data
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
import { useNavigate } from 'react-router-dom';

function Hub() {
    const navigate = useNavigate();

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

    function handleClick(data: Data) {
        navigate('/visualizer', { state: data });
    }

    const handleCalmTypeSelection = (calmType: string) => {
        setCurrentCalmType(calmType);

        if (calmType === 'Patterns') {
            fetchPatternIDs(currentNamespace!, setPatternIDs);
            setFlowIDs([]);
            setArchitectureIDs([]);
        } else if (calmType === 'Flows') {
            fetchFlowIDs(currentNamespace!, setFlowIDs);
            setPatternIDs([]);
            setArchitectureIDs([]);
        } else if (calmType === 'Architectures') {
            fetchArchitectureIDs(currentNamespace!, setArchitectureIDs);
            setPatternIDs([]);
            setFlowIDs([]);
        }
        setVersions([]);
        setData(undefined);
    };

    const handlePatternOrFlowSelection = (selectedID: string) => {
        setCurrentPatternOrFlowID(selectedID);

        if (currentCalmType === 'Patterns') {
            fetchPatternVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === 'Flows') {
            fetchFlowVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === 'Architectures') {
            fetchArchitectureVersions(currentNamespace!, selectedID, setVersions);
        }
    };

    const handleVersionSelection = (version: Version) => {
        setCurrentVersion(version);

        if (currentCalmType === 'Patterns') {
            fetchPattern(currentNamespace || '', currentPatternOrFlowID || '', version, setData);
        } else if (currentCalmType === 'Flows') {
            fetchFlow(currentNamespace || '', currentPatternOrFlowID || '', version, setData);
        } else if (currentCalmType === 'Architectures') {
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
                            values= {['Architectures', 'Patterns', 'Flows']}
                            callback={handleCalmTypeSelection}
                            currentValue={currentCalmType}
                        />
                    )}

                    {currentNamespace && currentCalmType && (
                        <ValueTable
                            header={
                                currentCalmType === 'Patterns'
                                    ? 'Patterns'
                                    : currentCalmType === 'Flows'
                                      ? 'Flows'
                                      : 'Architectures'
                            }
                            values={
                                currentCalmType === 'Patterns'
                                    ? patternIDs
                                    : currentCalmType === 'Flows'
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
                <div className="p-5 flex-1 overflow-auto bg-[#eee]">
                    {data && (
                        <button
                            className="bg-primary hover:bg-blue-500 text-white font-bold py-2 px-4 rounded float-right"
                            onClick={() => handleClick(data)}
                        >
                            Visualize
                        </button>
                    )}
                    <JsonRenderer json={data} />
                </div>
            </div>
        </>
    );
}

export default Hub;
