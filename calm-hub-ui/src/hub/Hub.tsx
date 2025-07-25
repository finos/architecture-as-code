import { useEffect, useState } from 'react';
import { ValueTable } from './components/value-table/ValueTable.js';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import { Namespace, Version, Data, Revision, Adr } from '../model/calm.js';
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
import { useNavigate } from 'react-router-dom';

interface CurrentResources {
    namespace?: string;
    calmType?: string;
    resourceID?: string;
    revision?: string;
    version?: string;
}

function Hub() {
    const navigate = useNavigate();

    const [values, setValues] = useState<string[]>([]);
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const adrService = new AdrService();
    const [currentResources, setCurrentResources] = useState<CurrentResources>({});
    const [breadcrumbInitialised, setBreadcrumbInitialised] = useState<boolean>(false);

    useEffect(() => {
        fetchNamespaces(setValues);
    }, []);

    function handleNamespaceSelection(namespace: Namespace) {
        setCurrentResources({ namespace: namespace });
        setBreadcrumbInitialised(true);
    }

    function handleClick(data: Data) {
        navigate('/visualizer', { state: data });
    }

    async function handleCalmTypeSelection(calmType: string) {
        setCurrentResources({ ...currentResources, calmType: calmType });

        if (calmType === 'Patterns') {
            fetchPatternIDs(currentResources.namespace!, setValues);
        } else if (calmType === 'Flows') {
            fetchFlowIDs(currentResources.namespace!, setValues);
        } else if (calmType === 'Architectures') {
            fetchArchitectureIDs(currentResources.namespace!, setValues);
        } else if (calmType === 'ADRs') {
            adrService.fetchAdrIDs(currentResources.namespace!).then((res) => setValues(res));
        }
        setData(undefined);
        setAdrData(undefined);
    }

    async function handleResourceSelection(selectedID: string) {
        setCurrentResources({ ...currentResources, resourceID: selectedID });

        if (currentResources.calmType === 'Patterns') {
            fetchPatternVersions(currentResources.namespace!, selectedID, setValues);
        } else if (currentResources.calmType === 'Flows') {
            fetchFlowVersions(currentResources.namespace!, selectedID, setValues);
        } else if (currentResources.calmType === 'Architectures') {
            fetchArchitectureVersions(currentResources.namespace!, selectedID, setValues);
        } else if (currentResources.calmType === 'ADRs') {
            adrService
                .fetchAdrRevisions(currentResources.namespace!, selectedID)
                .then((res) => setValues(res));
        }
    }

    function handleVersionSelection(version: Version) {
        setCurrentResources({ ...currentResources, version: version });

        if (currentResources.calmType === 'Patterns') {
            fetchPattern(
                currentResources.namespace || '',
                currentResources.resourceID || '',
                version,
                setData
            );
        } else if (currentResources.calmType === 'Flows') {
            fetchFlow(
                currentResources.namespace || '',
                currentResources.resourceID || '',
                version,
                setData
            );
        } else if (currentResources.calmType === 'Architectures') {
            fetchArchitecture(
                currentResources.namespace || '',
                currentResources.resourceID || '',
                version,
                setData
            );
        }
        setAdrData(undefined);
    }

    async function handleRevisionSelection(revision: Revision) {
        setCurrentResources({ ...currentResources, revision: revision });

        if (currentResources.calmType === 'ADRs') {
            adrService
                .fetchAdr(
                    currentResources.namespace || '',
                    currentResources.resourceID || '',
                    revision
                )
                .then((res) => setAdrData(res));
            setData(undefined);
        }
    }

    function displaySideBar() {
        if (
            currentResources.namespace &&
            currentResources.calmType &&
            currentResources.resourceID
        ) {
            if (currentResources.calmType !== 'ADRs') {
                return (
                    <ValueTable
                        header="Versions"
                        values={values}
                        callback={handleVersionSelection}
                        currentValue={currentResources.version}
                    />
                );
            } else {
                return (
                    <ValueTable
                        header="Revisions"
                        values={values}
                        callback={handleRevisionSelection}
                        currentValue={currentResources.revision}
                    />
                );
            }
        } else if (currentResources.namespace && currentResources.calmType) {
            return (
                <ValueTable
                    header={currentResources.calmType}
                    values={values}
                    callback={handleResourceSelection}
                    currentValue={currentResources.resourceID}
                />
            );
        } else if (currentResources.namespace) {
            return (
                <ValueTable
                    header="Calm Type"
                    values={['Architectures', 'Patterns', 'Flows', 'ADRs']}
                    callback={handleCalmTypeSelection}
                    currentValue={currentResources.calmType}
                />
            );
        } else {
            return (
                <ValueTable
                    header="Namespaces"
                    values={values}
                    callback={handleNamespaceSelection}
                    currentValue={currentResources.namespace}
                />
            );
        }
    }

    function resetBreadcrumbToNamespace() {
        fetchNamespaces(setValues);
        setData(undefined);
        setAdrData(undefined);
        setCurrentResources({});
    }

    function resetBreadcrumbToCalmType() {
        setData(undefined);
        setAdrData(undefined);
        setValues(['Architectures', 'Patterns', 'Flows', 'ADRs']);
        setCurrentResources({ namespace: currentResources.namespace });
    }

    function resetBreadcrumbToResourceIDs() {
        handleCalmTypeSelection(currentResources.calmType!);
        setCurrentResources({
            namespace: currentResources.namespace,
            calmType: currentResources.calmType,
        });
    }

    return (
        <>
            <Navbar />
            {breadcrumbInitialised && (
                <div className="breadcrumbs ms-3 text-sm" data-testid="breadcrumb">
                    <ul>
                        <li className="text-accent">
                            <a onClick={resetBreadcrumbToNamespace}>Namespaces</a>
                        </li>
                        {currentResources.namespace && (
                            <li className="text-accent">
                                <a onClick={resetBreadcrumbToCalmType}>
                                    {currentResources.namespace}
                                </a>
                            </li>
                        )}
                        {currentResources.calmType && (
                            <li className="text-accent">
                                <a onClick={resetBreadcrumbToResourceIDs}>
                                    {currentResources.calmType}
                                </a>
                            </li>
                        )}
                        {currentResources.resourceID && <li>{currentResources.resourceID}</li>}
                        {currentResources.version && <li> Version {currentResources.version} </li>}
                        {currentResources.revision && (
                            <li> Revision {currentResources.revision} </li>
                        )}
                    </ul>
                </div>
            )}

            <div className="flex flex-row h-[90%] overflow-auto">
                <div className="flex flex-row w-1/4">{displaySideBar()}</div>
                {currentResources.calmType !== 'ADRs' ? (
                    <div className="p-5 flex-1 overflow-auto bg-[#eee] border-t-1 border-gray-300">
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
                ) : adrData ? (
                    <AdrRenderer adrDetails={adrData} />
                ) : (
                    <div className="p-5 flex-1  bg-[#eee] text-center">
                        Please select an ADR to load.
                    </div>
                )}
            </div>
        </>
    );
}

export default Hub;
