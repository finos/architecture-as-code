import { useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { Data, Adr } from '../model/calm.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { DocumentDetailSection } from './components/document-detail-section/DocumentDetailSection.js';
import { DiagramSection } from './components/diagram-section/DiagramSection.js';
import './Hub.css';

export default function Hub() {
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
                <div className={`${isSidebarOpen ? 'w-1/4' : 'w-12'} p-4 pr-2 transition-all duration-300`}>
                    <div className="h-full bg-base-100 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                        {isSidebarOpen ? (
                            <>
                                <div className="flex items-center justify-end px-2 pt-2">
                                    <button
                                        aria-label="Collapse sidebar"
                                        className="btn btn-ghost btn-xs btn-circle"
                                        onClick={() => setIsSidebarOpen(false)}
                                    >
                                        <IoChevronBackOutline />
                                    </button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <TreeNavigation onDataLoad={handleDataLoad} onAdrLoad={handleAdrLoad} />
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center pt-3">
                                <button
                                    aria-label="Expand sidebar"
                                    className="btn btn-ghost btn-xs btn-circle"
                                    onClick={() => setIsSidebarOpen(true)}
                                >
                                    <IoChevronForwardOutline />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {adrData ? (
                        <AdrRenderer adrDetails={adrData} />
                    ) : (data?.calmType === 'Architectures' || data?.calmType === 'Patterns') ? (
                        <DiagramSection data={data} />
                    ) : (
                        <DocumentDetailSection data={data} />
                    )}
                </div>
            </div>
        </div>
    );
}
