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
                        <div className="p-5 bg-[#eee]">
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
        <div className="tabs tabs-box w-full overflow-auto">
            <input type="radio" name="view-tabs" className="tab" aria-label="JSON" defaultChecked />
            <div className="tab-content">
                <div className="p-5 bg-[#eee]">
                    <JsonRenderer json={data} />
                </div>
            </div>
            <input type="radio" name="view-tabs" className="tab" aria-label="Diagram" />
            <div className="tab-content">
                <Drawer calmInstance={data?.data} title={''} data={data} />
            </div>
        </div>
    );
}
