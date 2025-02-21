import { useEffect, useState } from 'react';
import { ValueTable } from './components/value-table.js';
import { JsonRenderer } from './components/json-view.js';
import Navbar from '../components/navbar/Navbar.js';

type Namespace = string;
type PatternID = string;
type Version = string;
type Pattern = string;

function Hub() {
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [currentNamespace, setCurrentNamespace] = useState<Namespace | undefined>();
    const [patternIDs, setPatternIDs] = useState<PatternID[]>([]);
    const [currentPatternID, setCurrentPatternID] = useState<PatternID | undefined>();
    const [versions, setVersions] = useState<Version[]>([]);
    const [currentVersion, setCurrentVersion] = useState<Version | undefined>();
    const [pattern, setPattern] = useState<Pattern | undefined>();

    useEffect(() => {
        fetch('/calm/namespaces')
            .then((res) => res.json())
            .then((data) => {
                setNamespaces(data.values);
            })
            .catch(console.log);
    }, []);

    function loadPatternIDs(namespace: string) {
        fetch(`/calm/namespaces/${namespace}/patterns`)
            .then((res) => res.json())
            .then((data) => {
                setPatternIDs(data.values.map((num: number) => num.toString()));
            })
            .catch(console.log);
    }

    function loadVersions(namespace: string, patternID: string) {
        fetch(`/calm/namespaces/${namespace}/patterns/${patternID}/versions`)
            .then((res) => res.json())
            .then((data) => {
                setVersions(data.values);
            })
            .catch(console.log);
    }

    function loadPattern(namespace: string, patternID: string, version: string) {
        fetch(`/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`)
            .then((res) => res.json())
            .then((data) => {
                setPattern(data);
            })
            .catch(console.log);
    }

    return (
        <>
            <Navbar />
            <div className="flex flex-col h-full flex-1">
                <div className="flex flex-row h-[90%]">
                    <div className="flex flex-row w-1/3">
                        <ValueTable
                            header="Namespaces"
                            values={namespaces}
                            callback={(namespace) => {
                                if (namespace !== currentNamespace) {
                                    setPattern(undefined);
                                    setCurrentPatternID(undefined);
                                    setCurrentVersion(undefined);
                                    setVersions([]);
                                    setCurrentNamespace(namespace);
                                    loadPatternIDs(namespace);
                                }
                            }}
                            currentValue={currentNamespace}
                        />
                        <ValueTable
                            header="Patterns"
                            values={patternIDs}
                            callback={(patternID) => {
                                if (patternID !== currentPatternID) {
                                    setPattern(undefined);
                                    setCurrentVersion(undefined);
                                    setCurrentPatternID(patternID);
                                    loadVersions(currentNamespace || '', patternID);
                                }
                            }}
                            currentValue={currentPatternID}
                        />
                        <ValueTable
                            header="Versions"
                            values={versions}
                            callback={(version) => {
                                setCurrentVersion(version);
                                loadPattern(
                                    currentNamespace || '',
                                    currentPatternID || '',
                                    version
                                );
                            }}
                            currentValue={currentVersion}
                        />
                    </div>
                    <JsonRenderer jsonString={pattern} />
                </div>
            </div>
        </>
    );
}

export default Hub;
