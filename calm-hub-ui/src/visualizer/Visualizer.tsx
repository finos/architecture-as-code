import { useEffect, useMemo, useState } from 'react';
import './Visualizer.css';
import { Drawer } from './components/drawer/Drawer.js';
import { Navbar } from '../components/navbar/Navbar.js';
import React from 'react';
import { Menu } from './components/menu/Menu.js';
import { useLocation } from 'react-router-dom';
import { CalmArchitectureSchema } from '@finos/calm-shared/src/types/core-types.js';

function Visualizer() {
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [instance, setCALMInstance] = useState<CalmArchitectureSchema | undefined>(undefined);
    const [isConDescActive, setConDescActive] = React.useState(true);
    const [isNodeDescActive, setNodeDescActive] = React.useState(true);
    const location = useLocation();
    const data = useMemo(() => location.state || {}, [location.state]);
    const [fileInstance, setFileInstance] = useState<string | undefined>(undefined);
    const [fileTitle, setFileTitle] = useState<string | undefined>(undefined);
    const toggleState = (setter: React.Dispatch<React.SetStateAction<boolean>>) => () =>
        setter((prev) => !prev);

    async function handleFile(instanceFile: File) {
        setFileTitle(instanceFile.name);
        const file = await instanceFile.text();
        setFileInstance(JSON.parse(file));
    }

    useEffect(() => {
        setTitle(fileTitle ?? data?.name);
        setCALMInstance(fileInstance ?? data?.data);
    }, [fileInstance, fileTitle, data]);

    return (
        <div className="h-screen flex flex-col">
            <Navbar />
            <Menu
                handleUpload={handleFile}
                isGraphRendered={!!instance}
                toggleNodeDesc={toggleState(setNodeDescActive)}
                toggleConnectionDesc={toggleState(setConDescActive)}
                isNodeDescActive={isNodeDescActive}
                isConDescActive={isConDescActive}
            />
            <Drawer
                isNodeDescActive={isNodeDescActive}
                isConDescActive={isConDescActive}
                calmInstance={instance}
                title={title}
            />
        </div>
    );
}

export default Visualizer;
