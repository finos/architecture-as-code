import { useState } from 'react';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { Data, Adr } from '../model/calm.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { DocumentDetailSection } from './components/document-detail-section/DocumentDetailSection.js';
import { ArchitectureSection } from './components/architecture-section/ArchitectureSection.js';
import './Hub.css';

export default function Hub() {
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();

    function handleDataLoad(data: Data) {
        setData(data);
        setAdrData(undefined);
    }

    function handleAdrLoad(adr: Adr) {
        setAdrData(adr);
        setData(undefined);
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Navbar />
            <div className="flex flex-row flex-1 overflow-hidden bg-base-300">
                <div className="w-1/4 p-4 pr-2">
                    <div className="h-full bg-base-100 rounded-2xl overflow-hidden shadow-xl">
                        <TreeNavigation onDataLoad={handleDataLoad} onAdrLoad={handleAdrLoad} />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {adrData ? (
                        <AdrRenderer adrDetails={adrData} />
                    ) : (
                        <>
                            {data?.calmType === 'Architectures' && (
                                <ArchitectureSection data={data} />
                            )}
                            {data?.calmType !== 'Architectures' && !adrData && (
                                <DocumentDetailSection data={data} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
