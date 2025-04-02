import { useEffect, useState } from 'react';
import './Visualizer.css';
import Drawer from './components/drawer/Drawer.js';
import Navbar from '../components/navbar/Navbar.js';
import React from 'react';
import { ZoomProvider } from './components/zoom-context.provider.js';
import { CALMArchitecture } from '../../../shared/src/types.js';
import Menu from './components/menu/Menu.js';
import { useLocation } from "react-router-dom";

function Visualizer() {
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [instance, setCALMInstance] = useState<CALMArchitecture | undefined>(undefined);
    const [isConDescActive, setConDescActive] = React.useState(false);
    const [isNodeDescActive, setNodeDescActive] = React.useState(false);
    const [isFileUpload, setIsFileUpload] = React.useState(false);
    const location = useLocation();
    const data = location.state || {};
    const [fileInstance, setFileInstance] = useState<any>(undefined); 
    const [fileTitle, setFileTitle] = useState<String>("");

    async function handleFile(instanceFile: File) {
        setFileTitle(instanceFile.name);
        const file = await instanceFile.text();
        setFileInstance(JSON.parse(file));
    }
    
    useEffect(() => {
        console.log(isFileUpload)
        setTitle(fileTitle ? fileTitle: data?.name)
        setCALMInstance(fileInstance? fileInstance : data?.data);
      }, [data, fileInstance, fileTitle]);

    return (
        <ZoomProvider>
            <div className="h-screen flex flex-col">
                <Navbar />
                <Menu
                    handleUpload={handleFile}
                    isGraphRendered={instance ? true : false}
                    toggleNodeDesc={() =>
                        setNodeDescActive((isNodeDescActive) => !isNodeDescActive)
                    }
                    toggleConnectionDesc={() =>
                        setConDescActive((isConDescActive) => !isConDescActive)
                    }
                />
                <Drawer
                    isNodeDescActive={isNodeDescActive}
                    isConDescActive={isConDescActive}
                    calmInstance={instance}
                    title={title}
                />
            </div>
        </ZoomProvider>
    );
}

export default Visualizer;
