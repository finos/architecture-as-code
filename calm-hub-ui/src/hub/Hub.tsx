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
    Revision,
    AdrID,
    Adr,
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
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { AdrService } from '../service/adr-service/adr-service.js';

function Hub() {
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [currentNamespace, setCurrentNamespace] = useState<Namespace | undefined>();
    const [patternIDs, setPatternIDs] = useState<PatternID[]>([]);
    const [flowIDs, setFlowIDs] = useState<FlowID[]>([]);
    const [architectureIDs, setArchitectureIDs] = useState<ArchitectureID[]>([]);
    const [adrIDs, setAdrIDs] = useState<AdrID[]>([]);
    const [currentPatternOrFlowID, setCurrentPatternOrFlowID] = useState<string | undefined>();
    const [currentVersion, setCurrentVersion] = useState<Version | undefined>();
    const [currentRevision, setCurrentRevision] = useState<Revision | undefined>();
    const [currentCalmType, setCurrentCalmType] = useState<string | undefined>();

    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [versions, setVersions] = useState<Version[]>([]);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const adrService = new AdrService();

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
        setAdrData(undefined);
        setCurrentNamespace(namespace);
        fetchPatternIDs(namespace, setPatternIDs);
    };

    const handleCalmTypeSelection = async (calmType: string) => {
        setCurrentCalmType(calmType);

        if (calmType === 'Patterns') {
            fetchPatternIDs(currentNamespace!, setPatternIDs);
            setFlowIDs([]);
            setArchitectureIDs([]);
            setAdrIDs([]);
        } else if (calmType === 'Flows') {
            fetchFlowIDs(currentNamespace!, setFlowIDs);
            setPatternIDs([]);
            setArchitectureIDs([]);
            setAdrIDs([]);
        } else if (calmType === 'Architectures') {
            fetchArchitectureIDs(currentNamespace!, setArchitectureIDs);
            setPatternIDs([]);
            setFlowIDs([]);
            setAdrIDs([]);
        } else if (calmType === 'ADRs') {
            adrService.fetchAdrIDs(currentNamespace!).then((res) => setAdrIDs(res));
            setRevisions([]);
            setArchitectureIDs([]);
            setPatternIDs([]);
            setFlowIDs([]);
        }
        setVersions([]);
        setData(undefined);
        setAdrData(undefined);
    };

    const handlePatternOrFlowSelection = async (selectedID: string) => {
        setCurrentPatternOrFlowID(selectedID);

        if (currentCalmType === 'Patterns') {
            fetchPatternVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === 'Flows') {
            fetchFlowVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === 'Architectures') {
            fetchArchitectureVersions(currentNamespace!, selectedID, setVersions);
        } else if (currentCalmType === 'ADRs') {
            adrService
                .fetchAdrRevisions(currentNamespace!, selectedID)
                .then((res) => setRevisions(res));
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
        setAdrData(undefined);
    };

    const handleRevisionSelection = async (revision: Revision) => {
        setCurrentRevision(revision);

        if (currentCalmType === 'ADRs') {
            adrService
                .fetchAdr(currentNamespace || '', currentPatternOrFlowID || '', revision)
                .then((res) => setAdrData(res));
            setData(undefined);
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
                            values={['Architectures', 'Patterns', 'Flows', 'ADRs']}
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
                                      : currentCalmType === 'Architectures'
                                        ? 'Architectures'
                                        : 'ADRs'
                            }
                            values={
                                currentCalmType === 'Patterns'
                                    ? patternIDs
                                    : currentCalmType === 'Flows'
                                      ? flowIDs
                                      : currentCalmType === 'Architectures'
                                        ? architectureIDs
                                        : adrIDs
                            }
                            callback={handlePatternOrFlowSelection}
                            currentValue={currentPatternOrFlowID}
                        />
                    )}

                    {currentNamespace &&
                        currentCalmType &&
                        (currentCalmType !== 'ADRs' ? (
                            <ValueTable
                                header="Versions"
                                values={versions}
                                callback={handleVersionSelection}
                                currentValue={currentVersion}
                            />
                        ) : (
                            <ValueTable
                                header="Revisions"
                                values={revisions}
                                callback={handleRevisionSelection}
                                currentValue={currentRevision}
                            />
                        ))}
                </div>
                {currentCalmType !== 'ADRs' ? (
                    <JsonRenderer json={data} />
                ) : adrData ? (
                    <AdrRenderer adrDetails={adrData} />
                ) : (
                    <div className="p-5 flex-1 overflow-auto border-l-2 border-black bg-[#eee] text-center">
                        Please select an ADR to load
                    </div>
                )}
            </div>
        </>
    );
}

export default Hub;
