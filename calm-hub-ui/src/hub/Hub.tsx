import { useState } from 'react';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { Data, Adr } from '../model/calm.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import './Hub.css';
import { Drawer } from '../visualizer/components/drawer/Drawer.js';

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
        <div className="flex flex-col h-screen">
            <Navbar />
            <div className="flex flex-row flex-1 overflow-hidden">
                <div className="w-1/4">
                    <TreeNavigation onDataLoad={handleDataLoad} onAdrLoad={handleAdrLoad} />
                </div>
                {adrData ? (
                    <AdrRenderer adrDetails={adrData} />
                ) : (
                    <div className="w-full h-full overflow-auto">
                        {adrData && <AdrRenderer adrDetails={adrData} />}
                        {data?.calmType === 'Architectures' && <ArchitectureSection data={data} />}
                        {data?.calmType !== 'Architectures' && !adrData && (
                            <div className="p-5 bg-base-200 h-full">
                                <JsonRenderer json={data} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ArchitectureSection({ data }: { data: Data & { calmType: 'Architectures' } }) {
    return (
        <div className="relative w-full h-full flex flex-col">
            <div className="tabs w-full flex-1 flex flex-col">
                <input
                    type="radio"
                    name="view-tabs"
                    className="tab absolute top-4 right-25 z-[100] backdrop-blur-sm shadow-lg rounded-lg px-4 py-2 border border-base-300 bg-base-100/90 checked:!bg-[#007dff] checked:!text-white hover:bg-base-200/90"
                    aria-label="JSON"
                />
                <div className="tab-content flex-1">
                    <div className="h-full bg-base-200">
                        <JsonRenderer json={data} />
                    </div>
                </div>
                <input
                    type="radio"
                    name="view-tabs"
                    className="tab absolute top-4 right-4 z-[100] backdrop-blur-sm shadow-lg rounded-lg px-4 py-2 border border-base-300 bg-base-100/90 checked:!bg-[#007dff] checked:!text-white hover:bg-base-200/90"
                    aria-label="Diagram"
                    defaultChecked
                />
                <div className="tab-content flex-1">
                    <Drawer data={data} />
                </div>
            </div>
        </div>
    );
}
