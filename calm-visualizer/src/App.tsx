import { useState } from 'react';
import './App.css';
import Drawer from './components/drawer/Drawer';
import Navbar from './components/navbar/Navbar';
import { CALMInstantiation } from '../../shared/src/types';
import React from 'react';

function App() {
    const [title, setTitle] = useState<string | undefined>(undefined);
    const [instance, setCALMInstance] = useState<CALMInstantiation | undefined>(undefined);
    const [isDescActive, setDescriptionsActive] = React.useState(false);

    async function handleFile(instanceFile: File) {
        const title = instanceFile.name;
        const file = await instanceFile.text();
        const instance = JSON.parse(file);

        setTitle(title);
        setCALMInstance(instance);
    }

    return (
        <div className="h-screen flex flex-col">
            <Navbar
                handleUpload={handleFile}
                calmInstance={instance}
                toggleDescriptions={() => setDescriptionsActive((isDescActive) => !isDescActive)}
            />
            <Drawer isDescActive={isDescActive} calmInstance={instance} title={title} />
        </div>
    );
}

export default App;
