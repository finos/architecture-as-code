import { useState } from 'react';
import './App.css';
import Drawer from './components/drawer/Drawer';
import Navbar from './components/navbar/Navbar';
import { CALMInstantiation } from '../../shared/src/types';
import React from 'react';
import { ZoomProvider } from './components/zoom-context.provider';

function App() {
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [instance, setCALMInstance] = useState<CALMInstantiation | undefined>(undefined);
    const [isConDescActive, setConDescActive] = React.useState(false);
    const [isNodeDescActive, setNodeDescActive] = React.useState(false);

    async function handleFile(instanceFile: File) {
        const title = instanceFile.name;
        const file = await instanceFile.text();
        const instance = JSON.parse(file);

        setTitle(title);
        setCALMInstance(instance);
    }

    return (
        <ZoomProvider>
            <div className="h-screen flex flex-col">
                <Navbar
                    handleUpload={handleFile}
                    isGraphRendered={instance ? true : false}
                    toggleNodeDesc={() => setNodeDescActive((isNodeDescActive) => !isNodeDescActive)}
                    toggleConnectionDesc={() => setConDescActive((isConDescActive) => !isConDescActive)}
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

export default App;
