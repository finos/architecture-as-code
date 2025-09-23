import { useState } from 'react';
import { JsonRenderer } from './components/json-renderer/JsonRenderer.js';
import { TreeNavigation } from './components/tree-navigation/TreeNavigation.js';
import { Data, Adr } from '../model/calm.js';
import { Navbar } from '../components/navbar/Navbar.js';
import { AdrRenderer } from './components/adr-renderer/AdrRenderer.js';
import { useNavigate } from 'react-router-dom';
import './Hub.css';

function Hub() {
    const navigate = useNavigate();
    const [data, setData] = useState<Data | undefined>();
    const [adrData, setAdrData] = useState<Adr | undefined>();

    function handleVisualize(data: Data) {
        navigate('/visualizer', { state: data });
    }

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
            <div className="flex flex-row h-[95%] overflow-auto">
                <div className="w-1/4">
                    <TreeNavigation onDataLoad={handleDataLoad} onAdrLoad={handleAdrLoad} />
                </div>
                {adrData ? (
                    <AdrRenderer adrDetails={adrData} />
                ) : (
                    <div className="p-5 flex-1 overflow-auto bg-[#eee] border-t-1 border-gray-300">
                        {data && (
                            <button
                                className="bg-primary hover:bg-blue-500 text-white font-bold py-2 px-4 rounded float-right visualize-button"
                                onClick={() => handleVisualize(data)}
                            >
                                Visualize
                            </button>
                        )}
                        <JsonRenderer json={data} />
                    </div>
                )}
            </div>
        </>
    );
}

export default Hub;
