import { useState } from 'react';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { Data, Adr } from '../model/calm.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
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
        <>
            <Navbar />
            <div className="flex flex-row h-[95%]">
                <div className="w-1/4">
                    <TreeNavigation onDataLoad={handleDataLoad} onAdrLoad={handleAdrLoad} />
                </div>
                <div className="w-full h-full overflow-auto">
                    {adrData && <AdrRenderer adrDetails={adrData} />}
                    {data?.calmType === 'Architectures' && <ArchitectureSection data={data!} />}
                    {data?.calmType !== 'Architectures' && !adrData && (
                        <div className="p-5 bg-[#eee] h-full">
                            <JsonRenderer json={data} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function ArchitectureSection({ data }: { data: Data }) {
    return (
        <div className="relative w-full h-full overflow-auto">
            <div className="tabs tabs-box w-full h-full">
                <input
                    type="radio"
                    name="view-tabs"
                    className="tab absolute top-4 right-25 z-10 backdrop-blur-sm shadow-lg rounded-lg px-4 py-2 border border-gray-200 bg-white/90 checked:!bg-[#007dff] checked:!text-white hover:bg-gray-100/90"
                    aria-label="JSON"
                    defaultChecked
                />
                <div className="tab-content h-full">
                    <div className="h-full bg-[#eee]">
                        <JsonRenderer json={data} />
                    </div>
                </div>
                <input
                    type="radio"
                    name="view-tabs"
                    className="tab absolute top-4 right-4 z-10 backdrop-blur-sm shadow-lg rounded-lg px-4 py-2 border border-gray-200 bg-white/90 checked:!bg-[#007dff] checked:!text-white hover:bg-gray-100/90"
                    aria-label="Diagram"
                />
                <div className="tab-content h-full">
                    <Drawer calmInstance={data?.data} title={''} data={data} />
                </div>
            </div>
        </div>
    );
}
